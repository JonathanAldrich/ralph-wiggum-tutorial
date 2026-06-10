# Feature: CLI Homework Auditor

## Feature Description
A standalone Python command-line tool (`hw_auditor.py`) that, given a student's Andrew ID, automatically:
1. Downloads that student's homework submission from Canvas LMS.
2. Sends the submission text to the GitHub Models API (via the `openai` SDK) with an engineered prompt.
3. Writes a Markdown file `<andrew_id>.md` containing a list of probing comprehension questions the instructor can use to assess whether the student genuinely understands their (possibly AI-assisted) solution.

The tool is self-contained — no Flask app, no database, no frontend. It reads all secrets from a `.env` file and accepts the target student's Andrew ID as a positional CLI argument.

## User Story
As a DevOps instructor
I want to run `python hw_auditor.py <andrew_id>` and get a Markdown file of comprehension questions
So that I can efficiently audit whether a student understands the homework they submitted

## Problem Statement
Manually crafting per-submission comprehension questions is slow. Without tooling, instructors either skip oral checks entirely or spend 10–15 minutes per student crafting questions — both bad outcomes in a class where AI use is permitted but understanding is required.

## Solution Statement
A CLI script integrates Canvas LMS (to fetch the student's submission) with the GitHub Models inference API (to generate targeted questions), producing a ready-to-use Markdown question sheet per student. The GitHub Models API is accessed using the instructor's GitHub fine-grained personal access token with `models:read` scope, using the `openai` Python SDK pointed at `https://models.github.ai`.

---

## Environment Variables (`.env`)

| Variable | Description |
|---|---|
| `CANVAS_API_TOKEN` | Canvas LMS API token (generated in Canvas Account Settings → Approved Integrations) |
| `CANVAS_ASSIGNMENT_URL` | Full URL of the Canvas assignment, e.g. `https://canvas.cmu.edu/courses/12345/assignments/67890` |
| `GITHUB_TOKEN` | GitHub fine-grained personal access token with `models:read` scope — used to authenticate against the GitHub Models inference API |

Optional:
| `GITHUB_MODEL` | GitHub Models model ID to use (default: `openai/gpt-4o-mini`) |
| `QUESTION_COUNT` | Default number of questions to generate (default: `12`) |

---

## Relevant Files

- **`hw_auditor.py`** — Main CLI entry point. Parses args, loads `.env`, orchestrates the pipeline. *(new)*
- **`auditor/canvas_client.py`** — Canvas LMS API client: resolves Andrew ID (email local-part) → Canvas user ID via teacher `search_users`, downloads the submitted `.zip`, and extracts text/code files. *(new)*
- **`auditor/github_models_client.py`** — GitHub Models inference client: wraps `openai.OpenAI` pointed at `https://models.github.ai/inference`, sends prompt, returns question list. *(new)*
- **`auditor/question_generator.py`** — Constructs the system prompt; bridges `canvas_client` → `github_models_client` → output. *(new)*
- **`auditor/output_writer.py`** — Renders questions as a Markdown file `<andrew_id>.md`. *(new)*
- **`pyproject.toml`** — Add `"."` to `[tool.pytest.ini_options] pythonpath` so root-level `auditor` package imports in tests. *(modify)*
- **`requirements.txt`** — Add `openai>=1.0.0`, `python-dotenv>=1.0.0`, `requests>=2.31.0`. *(modify)*
- **`.env.example`** — Document all required env vars. *(modify)*
- **`tests/test_canvas_client.py`** — Unit tests for Canvas client with mocked HTTP. *(new)*
- **`tests/test_question_generator.py`** — Unit tests for prompt construction and question parsing with mocked LLM. *(new)*
- **`tests/test_github_models_client.py`** — Unit test asserting the `/inference` base URL is used. *(new)*

### New Files (summary)

```
hw_auditor.py                       # CLI entry point
auditor/
    __init__.py
    canvas_client.py                # Canvas LMS REST API wrapper
    github_models_client.py         # GitHub Models inference wrapper
    question_generator.py           # Prompt logic + pipeline orchestration
    output_writer.py                # Markdown output formatter
tests/
    test_canvas_client.py
    test_question_generator.py
    test_github_models_client.py
```

---

## Canvas API Integration

### Parsing the Assignment URL
The `CANVAS_ASSIGNMENT_URL` follows the pattern:
```
https://<canvas-domain>/courses/<course_id>/assignments/<assignment_id>
```
Parse `canvas_domain`, `course_id`, and `assignment_id` with `urllib.parse` + a regex or path split.

### Resolving Andrew ID → Canvas User ID
**Andrew IDs are the email local-part** — i.e. `andrewid`, NOT `andrewid@andrew.cmu.edu`.
The CLI argument and the value matched against Canvas is the bare `andrewid`.

The instructor's Canvas token is a **teacher** token (not an account admin). Teachers
can see the `login_id` of students enrolled in their own course, but the
`GET /users/sis_login_id:<id>` shortcut typically requires SIS-read permission that
teachers do **not** have. Therefore, **prefer `search_users` and match on `login_id`**:
```
GET https://<canvas-domain>/api/v1/courses/<course_id>/search_users
    ?search_term=<andrew_id>
    &enrollment_type=student
Authorization: Bearer <CANVAS_API_TOKEN>
```
Match a returned user whose `login_id` equals `andrew_id` (case-insensitive). Because
Canvas may store the login as either the bare local-part or the full email, accept a
match when `login_id` equals `andrew_id` **or** `login_id` splits on `@` to `andrew_id`.

As a secondary fallback (in case the teacher token *does* have SIS access), try the
direct lookup, URL-encoding the ID:
```
GET https://<canvas-domain>/api/v1/courses/<course_id>/users/sis_login_id:<url-encoded andrew_id>
Authorization: Bearer <CANVAS_API_TOKEN>
```
Raise a clear error if the student is not found by either method.

> **Note:** the `include[]=login_id` param is NOT a documented include for
> `search_users`; `login_id` is returned by default to a teacher for students in
> their course. Do not rely on the undocumented include.

### Fetching the Submission
```
GET https://<canvas-domain>/api/v1/courses/<course_id>/assignments/<assignment_id>/submissions/<user_id>
    ?include[]=submission_comments
Authorization: Bearer <CANVAS_API_TOKEN>
```
*(Do not pass `include[]=full_rubric_assessment` — it is not a valid include value
and is unused. Valid submission includes include `submission_comments`,
`rubric_assessment`, `submission_history`, etc.)*

**Submissions are `online_upload` of a single `.zip` archive.** The primary extraction
path is therefore: download the attachment, unzip it in memory, and pull out the
**text and code files** (other file types are ignored). Extraction logic, in priority order:

1. **`attachments[*]` (the expected case)** — For each attachment:
   - Download with a bare `requests.get(url)` — do NOT send the `Authorization` header.
     Canvas attachment URLs are pre-signed and 302-redirect to S3/instructure-uploads;
     an extra `Authorization` header triggers `400 Only one auth mechanism allowed`.
   - If the attachment is a `.zip` (by `filename`/`content-type`), open it with
     `zipfile.ZipFile(io.BytesIO(content))` and iterate members:
     - Skip directories, `__MACOSX/` entries, and dotfiles.
     - Keep only **text/code files** — match by extension allow-list (see below).
     - Decode each kept file as UTF-8 (`errors="replace"`); skip files that are clearly
       binary (decode produces a high ratio of replacement chars) or exceed a per-file
       size cap.
     - Prefix each file's content with a header line `### <path-in-zip>` so the LLM
       (and the instructor) can see which file each construct came from.
   - If the attachment is itself a single text/code file (not a zip), decode it directly.
2. **`body`** — If present (online text entry), strip HTML tags and include it.
3. **`url`** — Website-URL submissions: record the URL as the solution text (do not scrape).

**Text/code extension allow-list** (case-insensitive; extend as needed):
```
.txt .md .rst
.py .js .ts .tsx .jsx .java .c .cc .cpp .h .hpp .cs .go .rs .rb .php .swift .kt .scala
.sh .bash .zsh .ps1
.yml .yaml .json .toml .ini .cfg .env .conf
.tf .tfvars .hcl
.dockerfile Dockerfile .dockerignore
.gitignore .gitlab-ci.yml .editorconfig
.sql .html .css .xml .csv
.mk Makefile .gradle .properties
```
Files with no extension but a well-known name (`Dockerfile`, `Makefile`, `Procfile`)
are also treated as text.

Concatenate all kept file blocks into a single string, separated by blank lines. If the
submission is unsubmitted, or the zip contains no text/code files, exit with a clear
error message.

---

## GitHub Models API Integration

The GitHub Models inference API is OpenAI-compatible. Use the `openai` Python SDK:

> **IMPORTANT (verified against the official GitHub REST API spec):** the inference
> endpoint is `POST https://models.github.ai/inference/chat/completions`. The `openai`
> SDK appends `/chat/completions` to `base_url`, so the base URL **must include the
> `/inference` suffix** — otherwise every request 404s.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://models.github.ai/inference",
    api_key=github_token,          # fine-grained PAT with models:read scope
)

response = client.chat.completions.create(
    model=model_id,                # e.g. "openai/gpt-4o-mini"
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": solution_text},
    ],
    temperature=0.7,
    max_tokens=2048,
)
```

The token must be a GitHub **fine-grained personal access token** (or a GitHub App token) with the `models:read` permission. Classic PATs with `repo` scope are NOT sufficient.

**Token**: set in `.env` as `GITHUB_TOKEN`.

### Available Models (examples)
| Model ID | Notes |
|---|---|
| `openai/gpt-4o-mini` | Default — fast, cheap, good quality |
| `openai/gpt-4.1` | Higher quality for complex solutions |
| `meta/llama-3.3-70b-instruct` | Open-source alternative |

---

## Implementation Plan

### Phase 1: Foundation
- Add dependencies to `requirements.txt`.
- Update `.env.example`.
- Implement `canvas_client.py` (URL parsing, user lookup, submission download).
- Implement `github_models_client.py` (OpenAI SDK wrapper for GitHub Models endpoint).

### Phase 2: Core Implementation
- Implement `question_generator.py` with the engineered system prompt.
- Implement `output_writer.py` (Markdown renderer).
- Implement `hw_auditor.py` CLI entry point.

### Phase 3: Tests and Polish
- Write unit tests (mocked Canvas and LLM).
- Test end-to-end with a real Canvas submission and real GitHub token (manual smoke test).

---

## Step by Step Tasks

### Step 1: Add dependencies (`requirements.txt`, `.env.example`)
- Append to `requirements.txt`:
  ```
  openai>=1.0.0
  requests>=2.31.0
  python-dotenv>=1.0.0
  ```
  *(python-dotenv is already present; skip the duplicate. The `openai` SDK uses
  `httpx`, not `requests`, so `requests` must be declared explicitly for the Canvas client.)*
- Update `.env.example` to add:
  ```
  # Canvas LMS
  CANVAS_API_TOKEN=your-canvas-token-here
  CANVAS_ASSIGNMENT_URL=https://canvas.cmu.edu/courses/COURSE_ID/assignments/ASSIGNMENT_ID

  # GitHub Models inference (fine-grained PAT with models:read scope)
  GITHUB_TOKEN=github_pat_...
  GITHUB_MODEL=openai/gpt-4o-mini

  # Optional
  QUESTION_COUNT=12
  ```

### Step 1b: Make the new package importable under pytest (CRITICAL)
The repo's `pyproject.toml` sets `pythonpath = ["src"]` and `testpaths = ["tests"]`.
Because `auditor/` lives at the **repo root** (not under `src/`), placing the new
tests in `tests/` causes a collection-time `ModuleNotFoundError: No module named
'auditor'` under the bare `pytest tests/` invocation used by `script/test` — which
**aborts the entire existing suite** (a regression).

Fix: add the repo root to the pytest path in `pyproject.toml`:
```toml
[tool.pytest.ini_options]
pythonpath = ["src", "."]
```
This keeps all tests in `tests/` and makes `script/test`, bare `pytest`, and
`PYTHONPATH=src pytest tests/` all resolve both `app` (from `src/`) and `auditor`
(from root). The existing `tests/conftest.py` Flask fixtures (`app`, `client`,
`runner`) only run when a test requests them, so they do not interfere with the
new CLI tests.

### Step 2: Create `auditor/` package (`auditor/__init__.py`)
- Empty `__init__.py` to make it a package.

### Step 3: Implement `auditor/canvas_client.py`

Resolves the Andrew ID (email local-part) to a Canvas user via `search_users`
(teacher token), downloads the submitted `.zip`, and extracts text/code files.

```python
"""Canvas LMS REST API client."""
import html
import io
import re
import zipfile
from urllib.parse import quote, urlparse
import requests

# Files we care about inside a submission zip. Match by extension (lowercased)
# or by exact filename for extension-less well-known files.
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
MAX_FILE_BYTES = 256 * 1024   # skip any single file larger than 256 KB


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
            params={"search_term": andrew_id, "enrollment_type": "student", "per_page": 50},
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
        """Return a list of '### path\\n<content>' blocks for text/code files in a zip."""
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
```

### Step 4: Implement `auditor/github_models_client.py`

```python
"""GitHub Models inference client (OpenAI-compatible API)."""
from openai import OpenAI


class GitHubModelsClient:
    # NOTE: the /inference suffix is required — the OpenAI SDK appends
    # /chat/completions, giving the real endpoint
    # POST https://models.github.ai/inference/chat/completions
    BASE_URL = "https://models.github.ai/inference"

    def __init__(self, github_token: str, model: str = "openai/gpt-4o-mini") -> None:
        self._client = OpenAI(base_url=self.BASE_URL, api_key=github_token)
        self.model = model

    def chat(self, system_prompt: str, user_message: str, max_tokens: int = 2048) -> str:
        """Send a chat completion request and return the assistant reply text."""
        response = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.7,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
```

### Step 5: Implement `auditor/question_generator.py`

Key responsibilities:
- Truncate the submission to a safe token budget (see below).
- Build the system prompt (see **Prompt Design** below).
- Call `GitHubModelsClient.chat()`.
- Parse the numbered list returned by the LLM into a `list[str]`.

**Exact function signature** (the LLM client must be passed in — `generate_questions`
does not construct its own client):
```python
def generate_questions(
    client: "GitHubModelsClient",
    solution_text: str,
    question_count: int = 12,
) -> list[str]:
    ...
```

**Truncation (required).** The GitHub Models free tier caps input at ~8000 tokens.
Before building the prompt, truncate `solution_text` to the first ~6000 words; if
truncated, append a visible notice (e.g. `\n\n[NOTE: submission truncated for length]`)
so the instructor knows the questions only cover part of the solution:
```python
MAX_WORDS = 6000

def _truncate(text: str) -> str:
    words = text.split()
    if len(words) <= MAX_WORDS:
        return text
    return " ".join(words[:MAX_WORDS]) + "\n\n[NOTE: submission truncated for length]"
```

#### Prompt Design
The system prompt must instruct the LLM to:
1. Act as a DevOps instructor assessing whether the student truly understands their submission (which may be AI-generated).
2. Generate exactly `{question_count}` questions, numbered 1–N, one per line, no preamble or postamble.
3. Prioritize questions that expose shallow understanding:
   - **Line-level explanation**: "What does line X do, and why was it written that way?"
   - **AI-idiomatic constructs**: Focus on flags, options, library calls, shell idioms, Terraform/Kubernetes/Docker patterns, CI pipeline syntax, or other constructs that frequently appear in AI-generated DevOps solutions but that students who wrote it themselves would be able to explain instinctively.
   - **Counterfactual reasoning**: "What would happen if you removed / changed X?"
   - **Conceptual depth**: "What does `<concept/tool>` do, and how does it relate to the larger goal in this solution?"
   - **Design rationale**: "Why was `<approach>` chosen over `<common alternative>`?"
   - **Edge cases / failure modes**: "What happens if X fails or is missing?"
   - **Dependency reasoning**: "Why does step Y need to run before step Z?"
4. Questions must **go beyond re-reading the text** — a student who only skimmed the solution should not be able to answer.
5. Cover a **diversity** of question types: conceptual, procedural, debugging, alternative-approach, trade-off.
6. Questions should be concise and unambiguous — suitable for a 5-minute oral quiz.

Template:
```
You are a DevOps instructor assessing whether a student understands the homework solution they submitted.
The solution may have been generated by an AI assistant; your job is to produce questions that expose
whether the student has genuine understanding or merely copied output.

Generate exactly {question_count} questions about the solution below.
Rules:
- Number each question (1. 2. 3. ...), one per line, no blank lines between questions.
- No preamble, no postamble, no section headers — just the numbered list.
- Most questions should target constructs or patterns typical of AI-generated DevOps solutions
  (specific CLI flags, idiomatic YAML, library choices, networking concepts, security patterns, etc.)
  that a student who genuinely wrote the solution would explain without hesitation.
- At least one question per category: conceptual explanation, design rationale, counterfactual
  ("what if you removed X?"), edge case / failure mode, and alternative approach.
- Questions must go beyond re-reading the text; a student who skimmed it should not be able to answer.
```

Parse the response by splitting on newlines, stripping leading numbering (`1. `, `2. ` etc.) and blank lines.

### Step 6: Implement `auditor/output_writer.py`

```python
"""Writes questions to a Markdown file named <andrew_id>.md."""
import pathlib


def write_questions(andrew_id: str, questions: list[str], output_dir: str = ".") -> pathlib.Path:
    """Render questions as a Markdown file and write it to disk."""
    out = pathlib.Path(output_dir) / f"{andrew_id}.md"
    lines = [
        f"# Comprehension Questions: {andrew_id}\n",
        "",
        "The following questions are intended for an oral or written check to assess whether "
        "the student understands the homework solution they submitted.\n",
        "",
    ]
    for i, q in enumerate(questions, 1):
        lines.append(f"{i}. {q}")
    out.write_text("\n".join(lines), encoding="utf-8")
    return out
```

### Step 7: Implement `hw_auditor.py` (CLI entry point)

```
usage: hw_auditor.py [-h] [--count N] [--output-dir DIR] [--env-file FILE] andrew_id

positional arguments:
  andrew_id         Student's Andrew ID

optional arguments:
  --count N         Number of questions to generate (default: env QUESTION_COUNT or 12)
  --output-dir DIR  Directory to write the output .md file (default: current directory)
  --env-file FILE   Path to .env file (default: .env)
```

Implementation steps:
1. Parse CLI arguments with `argparse`.
2. Load the specified `.env` file using `python-dotenv`'s `load_dotenv(override=True)`.
3. Validate that `CANVAS_API_TOKEN`, `CANVAS_ASSIGNMENT_URL`, and `GITHUB_TOKEN` are set; exit with clear error if not.
4. Instantiate `CanvasClient`, resolve Andrew ID to Canvas user ID.
5. Fetch submission text.
6. Instantiate `GitHubModelsClient` with `GITHUB_TOKEN` and `GITHUB_MODEL`.
7. Call `question_generator.generate_questions(client, submission_text, question_count)` — the client is passed in (see Step 5 signature).
8. Call `output_writer.write_questions(andrew_id, questions, output_dir)`.
9. Print the path of the output file to stdout.

Handle errors at each step with a descriptive `sys.exit(1)` message (no stack traces to stdout in normal use). The `--debug` flag (add it to the `argparse` usage above) re-raises with a full traceback for diagnosis.

All functions in `hw_auditor.py` and `auditor/` must be fully type-annotated — the
repo's `pyproject.toml` sets `[tool.mypy] strict = true`, so missing annotations fail
`script/typecheck`.

### Step 8: Write unit tests

#### `tests/test_canvas_client.py`
- `test_parses_course_and_assignment_from_url` — construct client with a known URL; assert `course_id` and `assignment_id` are parsed correctly.
- `test_resolve_user_id_search_match` — mock `search_users` returning a student whose `login_id` is the bare Andrew ID; assert correct ID returned.
- `test_resolve_user_id_email_login_match` — mock `search_users` returning `login_id="andrewid@andrew.cmu.edu"` for Andrew ID `andrewid`; assert the `@`-split match succeeds.
- `test_resolve_user_id_sis_fallback` — `search_users` returns no match, SIS lookup returns 200; assert ID returned.
- `test_resolve_user_id_not_found` — empty search + SIS 404; assert `ValueError` is raised.
- `test_fetch_submission_extracts_zip` — mock submission with a single `.zip` attachment; build an in-memory zip (via `zipfile`) containing `solution.py`, `notes.txt`, a `.png` (ignored), and a `__MACOSX/` entry (ignored); mock the bare `requests.get` to return the zip bytes; assert only the `.py` and `.txt` contents appear, each prefixed with `### <path>`, and assert **no `Authorization` header** was sent on the attachment download.
- `test_fetch_submission_zip_no_text_files` — zip with only binary files → `ValueError`.
- `test_fetch_submission_unsubmitted` — mock `workflow_state=unsubmitted`; assert `ValueError`.
- `test_fetch_submission_plain_text_file` — non-zip text attachment is decoded directly.

#### `tests/test_question_generator.py`
- Use a fake/mock `GitHubModelsClient` whose `chat` returns a known numbered list string.
- `test_parses_numbered_list` — assert 12 questions returned as clean strings.
- `test_strips_leading_numbers` — assert `"1. What does..."` becomes `"What does..."`.
- `test_custom_question_count` — assert correct count propagated to prompt.
- `test_truncates_long_submission` — pass a > 6000-word string; assert the truncation notice appears in the text sent to `client.chat`.
- `test_raises_on_empty_response` — mock returns empty string; assert exception raised.

#### `tests/test_github_models_client.py`
- `test_base_url_includes_inference_suffix` — patch `openai.OpenAI`; instantiate `GitHubModelsClient`; assert it was constructed with `base_url="https://models.github.ai/inference"`. *(This guards against the C1-class regression.)*

### Step 9: Run Validation Commands
See **Validation Commands** section below.

---

## Testing Strategy

### Unit Tests
- All external I/O (Canvas HTTP calls, OpenAI/GitHub Models API calls) is mocked with `unittest.mock.patch`. No new test dependency is introduced (avoid the `responses` library to keep `requirements-dev.txt` unchanged).
- No real network calls in the automated test suite.

### Edge Cases
- Andrew ID that does not exist in the course → clear error message, exit 1.
- Andrew ID stored as full email (`andrewid@andrew.cmu.edu`) while user passes `andrewid` → matched via `@`-split.
- Student has not submitted → clear error, exit 1.
- Submitted zip contains only binary files (images, PDFs, compiled artifacts) → `ValueError` "no text/code files to assess", exit 1.
- Zip contains `__MACOSX/` resource forks or dotfiles → silently skipped.
- A single file inside the zip exceeds `MAX_FILE_BYTES` (256 KB) → skipped (avoids a generated lockfile/binary blowing the token budget).
- Attachment is a single text/code file rather than a zip → decoded directly.
- `GITHUB_TOKEN` lacks `models:read` scope → `openai.AuthenticationError` caught, exit 1 with explanation.
- GitHub Models API rate limit hit → `openai.RateLimitError` caught, exit 1 with retry suggestion.
- LLM returns fewer questions than requested → use what was received, print a warning.
- Canvas URL missing course or assignment ID → `ValueError` on construction, exit 1.
- `.env` file not found → `FileNotFoundError` caught, exit 1 with helpful message.
- Very large submission (> ~8000 tokens) → truncate with a visible notice (rare: a typical submission is ~3 files totalling ~6 KB, far under the limit).

---

## Acceptance Criteria
1. Running `python hw_auditor.py <andrew_id>` produces a file `<andrew_id>.md` in the current directory.
2. The output file contains a numbered list of comprehension questions (default 12).
3. The tool exits with code 0 on success and code 1 on any recoverable error, with a human-readable message.
4. The `--count N` flag changes the number of generated questions.
5. The `--output-dir` flag writes to the specified directory.
6. `CANVAS_API_TOKEN`, `CANVAS_ASSIGNMENT_URL`, and `GITHUB_TOKEN` are all read from the `.env` file (or environment); none are hard-coded.
7. The GitHub Models API is called using `https://models.github.ai/inference` as the base URL with the `openai` Python SDK.
8. All unit tests pass with no real network calls.
9. After adding the new files, `script/test` (bare `pytest tests/`) still runs the existing Flask suite with zero collection errors (verified by the `pythonpath = ["src", "."]` change in Step 1b).

---

## Validation Commands
Execute every command; all must exit with code 0.

```bash
# 1. Install new dependencies
pip install openai requests

# 2. Run full test suite — existing Flask tests + new CLI tests together.
#    (Requires the pyproject pythonpath = ["src", "."] change from Step 1b.)
pytest tests/ -v

# 3. Run via the repo script to confirm zero regressions through the real entrypoint
script/test

# 4. Lint the new files
flake8 hw_auditor.py auditor/

# 5. Type-check the new files (strict mode is set in pyproject; full annotations required)
mypy hw_auditor.py auditor/

# 6. Smoke test (manual — requires real credentials):
#    cp .env.example .env && fill in real values, then:
python hw_auditor.py andrewid123 --count 5
#    Expected: file "andrewid123.md" created with 5 questions
```

---

## Notes

- **GitHub Models API authentication**: The `GITHUB_TOKEN` must be a **fine-grained personal access token** (not a classic PAT) with the `models:read` permission. Instruct the instructor to create one at: Settings → Developer settings → Personal access tokens → Fine-grained tokens.
  - The token is used as the `api_key` in `OpenAI(base_url="https://models.github.ai/inference", api_key=...)`.
  - API version header `X-GitHub-Api-Version` is handled automatically by the SDK.

- **Canvas API pagination**: `search_users` may paginate. For small courses (< 50 students) a single page is sufficient. If the course is large, implement pagination by following the `Link: <...>; rel="next"` response header.

- **Submission format**: The assignment is submitted as `online_upload` of a **single `.zip` archive**. The zip may contain several file types, but only **text and code files** are extracted (allow-list in `canvas_client.py`); images, PDFs, and compiled artifacts are ignored. Each extracted file is prefixed with a `### <path-in-zip>` header so the LLM can cite which file a construct came from and the instructor can locate it. Other Canvas submission types (`online_text_entry`, `online_url`) are handled as secondary fallbacks; `media_recording` and `student_annotation` are out of scope for v1.

- **Token budget**: A typical submission is ~3 text/code files totalling ~6 KB (well under the GitHub Models free-tier 8K-input / 4K-output cap), so truncation almost never triggers. The truncation guard (first ~6000 words + visible notice) remains as a safety net for unusually large multi-file submissions. A per-file 256 KB cap in the zip extractor prevents a stray lockfile or binary from blowing the budget. `gpt-4o-mini` (default) and `gpt-4.1` both have ample context for the expected size.

- **No web app changes**: This feature is a standalone CLI tool and does not modify any Flask routes, templates, or React islands. The `auditor/` package lives at the repo root alongside `src/`.

- **Future ideas**: Batch mode (`python hw_auditor.py --all` iterates all submitted students), question-set caching per submission hash to avoid repeat API calls, configurable output template.
