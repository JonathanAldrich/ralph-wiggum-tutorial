# Implementation Plan — CLI Homework Auditor

**Goal:** Deliver the standalone `hw_auditor.py` CLI tool described in
`specs/feature-hwq-cli-homework-auditor.md`: given a student's Andrew ID, download
their Canvas submission, generate comprehension questions via the GitHub Models API,
and write `<andrew_id>.md`.

**Status (verified against current source on branch `hw-auditor`):** The feature is
**entirely unimplemented**. Confirmed by code search:
- No `auditor/` package and no `hw_auditor.py` at repo root.
- `requirements.txt` has `python-dotenv` but **lacks `openai` and `requests`**.
- `.env.example` has only DB/Flask/Vite vars — no `CANVAS_*` / `GITHUB_*` vars.
- `pyproject.toml` sets `pythonpath = ["src"]` (root-level `auditor` not importable under `pytest`).
- `tests/` contains only `test_game_view.py` + Flask `conftest.py`; no auditor tests.
- No shared `src/lib` standard-library dir exists; this feature is intentionally standalone
  (root-level `auditor/` package, no Flask/DB/frontend changes), so no `src/lib` consolidation applies.

There is no prior `IMPLEMENTATION_PLAN.md`; this file establishes the plan.

---

## Items To Implement (priority order)

### P0 — Foundation / unblock the test suite (must come first)
- [ ] **Fix pytest path so root-level `auditor` is importable (regression guard).**
      Change `pyproject.toml` `[tool.pytest.ini_options] pythonpath = ["src"]` →
      `["src", "."]`. Without this, adding tests that `import auditor` causes a
      collection-time `ModuleNotFoundError` that aborts the **entire** existing Flask
      suite under bare `pytest tests/` (used by `script/test`). Acceptance criterion #9.
- [ ] **Add runtime dependencies** to `requirements.txt`: `openai>=1.0.0`,
      `requests>=2.31.0` (keep existing `python-dotenv>=1.0.0`; do not duplicate).
      Then `pip install openai requests` so the env actually has them.
- [ ] **Document new env vars** in `.env.example`: `CANVAS_API_TOKEN`,
      `CANVAS_ASSIGNMENT_URL`, `GITHUB_TOKEN`, `GITHUB_MODEL` (default
      `openai/gpt-4o-mini`), `QUESTION_COUNT` (default `12`). Do not commit real secrets.
- [ ] **Create `auditor/__init__.py`** (empty) to make the root-level package.

### P1 — Core library modules (the pipeline)
- [ ] **`auditor/canvas_client.py` — `CanvasClient`.**
      - Parse `CANVAS_ASSIGNMENT_URL` → `base_url`, `course_id`, `assignment_id`
        (`urlparse` + regex `/courses/(\d+)/assignments/(\d+)`; `ValueError` if no match).
      - `resolve_user_id(andrew_id)`: prefer `GET .../courses/<id>/search_users`
        (`search_term`, `enrollment_type=student`, `per_page=50`) and match `login_id`
        equal to the bare andrew_id **or** its `@`-split local-part (case-insensitive);
        secondary fallback `GET .../users/sis_login_id:<url-encoded id>`; `ValueError`
        if neither resolves.
      - `fetch_submission_text(user_id)`: `GET .../submissions/<user_id>?include[]=submission_comments`;
        raise on `workflow_state in ("unsubmitted", None)`. Extract in priority order:
        (1) `attachments[*]` — download with a **bare `requests.get(url)` (NO Authorization
        header)** because Canvas URLs are pre-signed and redirect to S3; unzip `.zip` in
        memory, else decode single text/code file; (2) `body` — strip HTML + unescape;
        (3) `url` — record only if nothing else. `ValueError` if no text/code content.
      - Zip extraction (`_extract_zip`): skip dirs, `__MACOSX/`, non-allowlisted dotfiles,
        files > `MAX_FILE_BYTES` (256 KB), non-text files; decode UTF-8 with binary
        detection (`_decode` → `None` if > ~5% replacement chars); prefix each kept file
        with `### <path-in-zip>`.
      - Helpers/constants: `TEXT_EXTENSIONS`, `TEXT_FILENAMES`, `_is_text_file`, `_decode`.
        Full type annotations (mypy `strict = true`).
- [ ] **`auditor/github_models_client.py` — `GitHubModelsClient`.**
      - Wrap `openai.OpenAI(base_url="https://models.github.ai/inference", api_key=token)`.
        **The `/inference` suffix is mandatory** (SDK appends `/chat/completions`); this is
        the known C1-class regression to guard with a test.
      - `chat(system_prompt, user_message, max_tokens=2048)` → returns
        `response.choices[0].message.content or ""`; `temperature=0.7`.
- [ ] **`auditor/question_generator.py` — `generate_questions(client, solution_text, question_count=12)`.**
      - Signature takes the LLM client as a parameter (does **not** construct its own).
      - Truncate to first `MAX_WORDS = 6000` words, appending a visible
        `[NOTE: submission truncated for length]` notice when truncated.
      - Build the engineered system prompt (see spec "Prompt Design": DevOps-instructor
        persona; exactly N numbered questions, one per line, no preamble/postamble;
        target AI-idiomatic DevOps constructs; ≥1 question per category — conceptual,
        design rationale, counterfactual, edge/failure, alternative approach).
      - Call `client.chat(...)`, parse the numbered list (strip leading `N.` numbering and
        blanks) into `list[str]`; raise on empty response; warn if fewer than requested.
- [ ] **`auditor/output_writer.py` — `write_questions(andrew_id, questions, output_dir=".")`.**
      - Render Markdown with `# Comprehension Questions: <andrew_id>` heading + intro
        paragraph + numbered list; write `<output_dir>/<andrew_id>.md`; return the `Path`.

### P2 — CLI entry point
- [ ] **`hw_auditor.py`.**
      - `argparse`: positional `andrew_id`; options `--count N`, `--output-dir DIR`,
        `--env-file FILE` (default `.env`), `--debug`.
      - `load_dotenv(env_file, override=True)`; validate `CANVAS_API_TOKEN`,
        `CANVAS_ASSIGNMENT_URL`, `GITHUB_TOKEN` are set (clear error + `sys.exit(1)` if not).
      - Orchestrate: `CanvasClient` → `resolve_user_id` → `fetch_submission_text` →
        `GitHubModelsClient(GITHUB_TOKEN, GITHUB_MODEL)` →
        `generate_questions(client, text, count)` → `write_questions(...)` → print path.
      - Default count from `QUESTION_COUNT` env or `12`.
      - Catch recoverable errors at each step → descriptive message + `sys.exit(1)` (no
        stack trace); `--debug` re-raises full traceback. Handle `openai.AuthenticationError`
        (missing `models:read`), `openai.RateLimitError`, missing `.env` (`FileNotFoundError`).
      - Full type annotations (mypy strict).

### P3 — Tests (all external I/O mocked; no real network; no new dev deps)
- [ ] **`tests/test_canvas_client.py`** — URL parsing; `resolve_user_id` search match,
      email `@`-split match, SIS fallback, not-found `ValueError`; zip extraction (only
      `.py`/`.txt` kept, `### <path>` prefixes, `.png` & `__MACOSX/` ignored, **assert no
      `Authorization` header on attachment download**); zip-with-only-binary → `ValueError`;
      unsubmitted → `ValueError`; plain-text (non-zip) attachment decoded directly.
      Build in-memory zips with `zipfile`; mock HTTP with `unittest.mock.patch`.
- [ ] **`tests/test_question_generator.py`** — fake client returning a known numbered list:
      parses 12 questions; strips leading numbers; custom count propagates to prompt;
      `> 6000`-word input triggers truncation notice in text sent to `chat`; empty
      response raises.
- [ ] **`tests/test_github_models_client.py`** — patch `openai.OpenAI`; assert constructed
      with `base_url="https://models.github.ai/inference"` (guards the C1 regression).

### P4 — Validation & polish (run after each implementation step)
- [ ] `pytest tests/ -v` and `script/test` — existing Flask suite + new CLI tests, **zero
      collection errors** (depends on the P0 pythonpath fix). Acceptance #8, #9.
- [ ] `flake8 hw_auditor.py auditor/` — clean (max-line-length 120).
- [ ] `mypy hw_auditor.py auditor/` — clean under `strict = true` (full annotations required).
- [ ] Manual smoke test with real credentials (out of CI):
      `python hw_auditor.py <andrew_id> --count 5` → produces `<andrew_id>.md` with 5 questions.

---

## Acceptance Criteria (from spec — done = all true)
1. `python hw_auditor.py <andrew_id>` writes `<andrew_id>.md` in the cwd.
2. Output is a numbered list of comprehension questions (default 12).
3. Exit 0 on success, exit 1 on recoverable error with a human-readable message.
4. `--count N` changes the number of questions.
5. `--output-dir` writes to the given directory.
6. `CANVAS_API_TOKEN`, `CANVAS_ASSIGNMENT_URL`, `GITHUB_TOKEN` read from `.env`/env; none hard-coded.
7. GitHub Models called via `https://models.github.ai/inference` with the `openai` SDK.
8. All unit tests pass with no real network calls.
9. `script/test` (bare `pytest tests/`) still runs the Flask suite with zero collection errors.

## Notes / Risks
- **No `src/lib` involvement:** the spec mandates a standalone root-level `auditor/`
  package with no Flask/DB/frontend changes; there is no shared standard-library code to reuse.
- **Highest-risk regression:** the `pyproject.toml` `pythonpath` change (P0) — skipping it
  breaks the whole suite. Do it before adding any `import auditor` test.
- **Second-highest:** the GitHub Models base URL must include `/inference` (covered by a dedicated test).
- Out of scope for v1: `media_recording`/`student_annotation` submissions; batch `--all`
  mode; per-submission question caching (listed as future ideas in the spec).
