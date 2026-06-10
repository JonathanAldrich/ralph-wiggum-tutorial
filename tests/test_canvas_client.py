"""Unit tests for auditor.canvas_client (all HTTP mocked — no real network calls)."""
from __future__ import annotations

import io
import zipfile
from unittest.mock import MagicMock, patch

from typing import Any

import pytest

from auditor.canvas_client import CanvasClient


ASSIGNMENT_URL = "https://canvas.cmu.edu/courses/12345/assignments/67890"


def _make_client() -> CanvasClient:
    return CanvasClient("fake-token", ASSIGNMENT_URL)


def _make_zip(files: dict[str, bytes]) -> bytes:
    """Build an in-memory zip containing the given {path: content} mapping."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


# ── URL parsing ──────────────────────────────────────────────────────────────

def test_parses_course_and_assignment_from_url() -> None:
    client = _make_client()
    assert client.course_id == "12345"
    assert client.assignment_id == "67890"


def test_invalid_url_raises_value_error() -> None:
    with pytest.raises(ValueError, match="Cannot parse"):
        CanvasClient("tok", "https://canvas.cmu.edu/not/a/valid/path")


# ── resolve_user_id ───────────────────────────────────────────────────────────

def test_resolve_user_id_search_match() -> None:
    client = _make_client()
    search_resp = MagicMock()
    search_resp.status_code = 200
    search_resp.json.return_value = [{"id": 42, "login_id": "jdoe"}]

    with patch.object(client._session, "get", return_value=search_resp):
        assert client.resolve_user_id("jdoe") == "42"


def test_resolve_user_id_email_login_match() -> None:
    """login_id stored as full email — match via @ split."""
    client = _make_client()
    search_resp = MagicMock()
    search_resp.status_code = 200
    search_resp.json.return_value = [{"id": 99, "login_id": "jdoe@andrew.cmu.edu"}]

    with patch.object(client._session, "get", return_value=search_resp):
        assert client.resolve_user_id("jdoe") == "99"


def test_resolve_user_id_sis_fallback() -> None:
    """search_users returns no match; SIS lookup succeeds."""
    client = _make_client()
    no_match = MagicMock()
    no_match.status_code = 200
    no_match.json.return_value = []  # no matching user in search

    sis_resp = MagicMock()
    sis_resp.status_code = 200
    sis_resp.json.return_value = {"id": 77}

    with patch.object(client._session, "get", side_effect=[no_match, sis_resp]):
        assert client.resolve_user_id("jdoe") == "77"


def test_resolve_user_id_not_found() -> None:
    """Both search and SIS return no result → ValueError."""
    client = _make_client()
    no_match = MagicMock()
    no_match.status_code = 200
    no_match.json.return_value = []

    not_found = MagicMock()
    not_found.status_code = 404

    with patch.object(client._session, "get", side_effect=[no_match, not_found]):
        with pytest.raises(ValueError, match="not found"):
            client.resolve_user_id("nobody")


# ── fetch_submission_text ─────────────────────────────────────────────────────

def test_fetch_submission_extracts_zip() -> None:
    """Zip with .py, .txt, .png, __MACOSX/ → only .py and .txt extracted."""
    client = _make_client()

    zip_bytes = _make_zip({
        "solution.py": b"print('hello')",
        "notes.txt": b"My notes here",
        "image.png": b"\x89PNG\r\n\x1a\n" + b"\x00" * 100,
        "__MACOSX/._solution.py": b"garbage",
    })

    submission_resp = MagicMock()
    submission_resp.raise_for_status = MagicMock()
    submission_resp.json.return_value = {
        "workflow_state": "submitted",
        "attachments": [{"url": "https://s3.example.com/file.zip", "filename": "submission.zip"}],
    }

    dl_resp = MagicMock()
    dl_resp.raise_for_status = MagicMock()
    dl_resp.content = zip_bytes

    captured_requests: list[dict[str, Any]] = []

    def fake_requests_get(url: str, **kwargs: Any) -> MagicMock:
        captured_requests.append({"url": url, "kwargs": kwargs})
        return dl_resp

    with patch.object(client._session, "get", return_value=submission_resp):
        with patch("auditor.canvas_client.requests.get", side_effect=fake_requests_get):
            result = client.fetch_submission_text("42")

    assert "### solution.py" in result
    assert "print('hello')" in result
    assert "### notes.txt" in result
    assert "My notes here" in result
    assert "image.png" not in result
    assert "__MACOSX" not in result

    # Assert no Authorization header on attachment download.
    for req in captured_requests:
        headers: dict[str, Any] = (req.get("kwargs") or {}).get("headers", {})
        assert "Authorization" not in headers, "Authorization header must NOT be sent for attachment download"


def test_fetch_submission_zip_no_text_files() -> None:
    """Zip containing only binary files → ValueError."""
    client = _make_client()

    zip_bytes = _make_zip({
        "image.png": b"\x89PNG\r\n\x1a\n" + b"\xff\xfe" * 200,
        "data.bin": bytes(range(256)),
    })

    submission_resp = MagicMock()
    submission_resp.raise_for_status = MagicMock()
    submission_resp.json.return_value = {
        "workflow_state": "submitted",
        "attachments": [{"url": "https://s3.example.com/file.zip", "filename": "submission.zip"}],
    }

    dl_resp = MagicMock()
    dl_resp.raise_for_status = MagicMock()
    dl_resp.content = zip_bytes

    with patch.object(client._session, "get", return_value=submission_resp):
        with patch("auditor.canvas_client.requests.get", return_value=dl_resp):
            with pytest.raises(ValueError, match="no text/code files"):
                client.fetch_submission_text("42")


def test_fetch_submission_unsubmitted() -> None:
    client = _make_client()

    submission_resp = MagicMock()
    submission_resp.raise_for_status = MagicMock()
    submission_resp.json.return_value = {"workflow_state": "unsubmitted", "attachments": []}

    with patch.object(client._session, "get", return_value=submission_resp):
        with pytest.raises(ValueError, match="not submitted"):
            client.fetch_submission_text("42")


def test_fetch_submission_plain_text_file() -> None:
    """Non-zip text attachment is decoded directly."""
    client = _make_client()

    submission_resp = MagicMock()
    submission_resp.raise_for_status = MagicMock()
    submission_resp.json.return_value = {
        "workflow_state": "submitted",
        "attachments": [{"url": "https://s3.example.com/notes.txt", "filename": "notes.txt"}],
    }

    dl_resp = MagicMock()
    dl_resp.raise_for_status = MagicMock()
    dl_resp.content = b"Some plain text content"

    with patch.object(client._session, "get", return_value=submission_resp):
        with patch("auditor.canvas_client.requests.get", return_value=dl_resp):
            result = client.fetch_submission_text("42")

    assert "### notes.txt" in result
    assert "Some plain text content" in result
