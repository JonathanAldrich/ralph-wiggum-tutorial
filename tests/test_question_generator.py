"""Unit tests for auditor.question_generator (LLM mocked)."""
from __future__ import annotations

import pytest

from auditor.question_generator import generate_questions, MAX_WORDS


class FakeClient:
    """Fake GitHubModelsClient for testing."""

    def __init__(self, response: str = "") -> None:
        self.response = response
        self.last_system_prompt: str = ""
        self.last_user_message: str = ""

    def chat(self, system_prompt: str, user_message: str, max_tokens: int = 2048) -> str:
        self.last_system_prompt = system_prompt
        self.last_user_message = user_message
        return self.response


def _make_numbered_list(n: int = 12) -> str:
    return "\n".join(f"{i}. What does step {i} do?" for i in range(1, n + 1))


def test_parses_numbered_list() -> None:
    client = FakeClient(_make_numbered_list(12))
    questions = generate_questions(client, "some solution text", question_count=12)
    assert len(questions) == 12


def test_strips_leading_numbers() -> None:
    client = FakeClient("1. What does the Dockerfile do?\n2. Why use alpine?")
    questions = generate_questions(client, "solution", question_count=2)
    assert questions[0] == "What does the Dockerfile do?"
    assert questions[1] == "Why use alpine?"


def test_custom_question_count() -> None:
    client = FakeClient(_make_numbered_list(5))
    questions = generate_questions(client, "solution text", question_count=5)
    assert len(questions) == 5
    assert "5" in client.last_system_prompt


def test_truncates_long_submission() -> None:
    long_text = " ".join(["word"] * (MAX_WORDS + 500))
    client = FakeClient(_make_numbered_list(12))
    generate_questions(client, long_text, question_count=12)
    assert "[NOTE: submission truncated for length]" in client.last_user_message


def test_no_truncation_for_short_submission() -> None:
    short_text = "short submission"
    client = FakeClient(_make_numbered_list(12))
    generate_questions(client, short_text, question_count=12)
    assert "[NOTE: submission truncated for length]" not in client.last_user_message


def test_raises_on_empty_response() -> None:
    client = FakeClient("")
    with pytest.raises(ValueError, match="empty response"):
        generate_questions(client, "solution")


def test_raises_on_whitespace_only_response() -> None:
    client = FakeClient("   \n\n   ")
    with pytest.raises(ValueError, match="empty response"):
        generate_questions(client, "solution")
