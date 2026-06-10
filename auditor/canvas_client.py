"""Canvas LMS REST API client."""
import html
import io
import re
import zipfile
from urllib.parse import quote, urlparse

import requests

TEXT_EXTENSIONS = {
    ".txt", ".md", ".rst",
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".c", ".cc", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala",
    ".sh", ".bash", ".zsh", ".ps1",
    ".yml", ".yaml", ".json", ".toml", ".ini", ".cfg", ".env", ".conf",
    ".tf", ".tfvars", ".hcl",
    ".dockerfile", ".dockerignore", ".gitignore", ".editorconfig",
    ".sql", ".html", ".css", ".xml", ".csv",
    ".mk", ".gradle", ".properties",
}
TEXT_FILENAMES = {"dockerfile", "makefile", "procfile", ".gitignore", ".gitlab-ci.yml"}
MAX_FILE_BYTES = 256 * 1024  # skip any single file larger than 256 KB


def _is_text_file(name: str) -> bool:
    base = name.rsplit("/", 1)[-1]
    if base.lower() in TEXT_FILENAMES:
        return True
    dot = base.rfind(".")
    return dot != -1 and base[dot:].lower() in TEXT_EXTENSIONS


def _decode(raw: bytes) -> str | None:
    """Decode bytes as UTF-8; return None if it looks binary."""
    text = raw.decode("utf-8", errors="replace")
    if text.count("\ufffd") > max(8, len(text) // 20):  # >5% replacement chars
        return None
    return text


class CanvasClient:
    def __init__(self, api_token: str, assignment_url: str) -> None:
        parsed = urlparse(assignment_url)
        self.base_url = f"{parsed.scheme}://{parsed.netloc}"
        m = re.search(r"/courses/(\d+)/assignments/(\d+)", parsed.path)
        if not m:
            raise ValueError(f"Cannot parse course/assignment IDs from URL: {assignment_url}")
        self.course_id = m.group(1)
        self.assignment_id = m.group(2)
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {api_token}"})

    def resolve_user_id(self, andrew_id: str) -> str:
        """Return Canvas user_id for the given Andrew ID (email local-part).

        Teacher tokens: prefer search_users matching login_id; fall back to the
        SIS direct lookup in case the token happens to have SIS-read access.
        """
        target = andrew_id.lower()
        search_url = f"{self.base_url}/api/v1/courses/{self.course_id}/search_users"
        resp = self._session.get(
            search_url,
            params={"search_term": andrew_id, "enrollment_type": "student", "per_page": "50"},
        )
        if resp.status_code == 200:
            for user in resp.json():
                login = (user.get("login_id") or "").lower()
                # Accept bare local-part or full-email login forms.
                if login == target or login.split("@", 1)[0] == target:
                    return str(user["id"])

        # Secondary fallback: SIS direct lookup.
        sis_url = (f"{self.base_url}/api/v1/courses/{self.course_id}"
                   f"/users/sis_login_id:{quote(andrew_id, safe='')}")
        resp = self._session.get(sis_url)
        if resp.status_code == 200:
            return str(resp.json()["id"])

        raise ValueError(f"Student '{andrew_id}' not found in course {self.course_id}")

    def fetch_submission_text(self, user_id: str) -> str:
        """Download the submission and return its text/code content as one string."""
        url = (f"{self.base_url}/api/v1/courses/{self.course_id}"
               f"/assignments/{self.assignment_id}/submissions/{user_id}")
        resp = self._session.get(url, params={"include[]": "submission_comments"})
        resp.raise_for_status()
        submission = resp.json()

        if submission.get("workflow_state") in ("unsubmitted", None):
            raise ValueError("Student has not submitted this assignment.")

        parts: list[str] = []

        # Expected case: file upload (typically a single .zip archive).
        # Download with a bare requests.get (NO Authorization header): Canvas
        # attachment URLs are pre-signed and redirect to S3, which rejects a
        # second auth mechanism.
        for attachment in submission.get("attachments", []):
            dl = requests.get(attachment["url"])
            dl.raise_for_status()
            filename = attachment.get("filename", "file")
            content = dl.content
            if filename.lower().endswith(".zip") or zipfile.is_zipfile(io.BytesIO(content)):
                parts.extend(self._extract_zip(content))
            elif _is_text_file(filename):
                decoded = _decode(content)
                if decoded is not None:
                    parts.append(f"### {filename}\n{decoded.strip()}")

        # Online text body (rare for this assignment, but handle it).
        if submission.get("body"):
            clean = re.sub(r"<[^>]+>", "", submission["body"])
            parts.append(html.unescape(clean).strip())

        # URL submission.
        if submission.get("url") and not parts:
            parts.append(f"Student submitted URL: {submission['url']}")

        if not parts:
            raise ValueError(
                "Submission contains no text/code files to assess "
                "(zip may be empty or contain only binary files)."
            )

        return "\n\n".join(parts)

    @staticmethod
    def _extract_zip(content: bytes) -> list[str]:
        """Return a list of '### path\n<content>' blocks for text/code files in a zip."""
        blocks: list[str] = []
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            for info in zf.infolist():
                name = info.filename
                if info.is_dir() or name.startswith("__MACOSX/"):
                    continue
                if name.rsplit("/", 1)[-1].startswith("."):  # skip dotfiles except allow-listed
                    if name.rsplit("/", 1)[-1].lower() not in TEXT_FILENAMES:
                        continue
                if info.file_size > MAX_FILE_BYTES or not _is_text_file(name):
                    continue
                decoded = _decode(zf.read(info))
                if decoded is not None:
                    blocks.append(f"### {name}\n{decoded.strip()}")
        return blocks
