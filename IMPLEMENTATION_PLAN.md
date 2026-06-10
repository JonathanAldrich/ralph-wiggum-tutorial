# Implementation Plan — CLI Homework Auditor

**Goal:** Deliver the standalone `hw_auditor.py` CLI tool described in
`specs/feature-hwq-cli-homework-auditor.md`.

**Status: COMPLETE (committed fa8c485 on branch `hw-auditor`)**

## Completed

All P0–P4 items implemented and passing:

- ✅ `pyproject.toml` pythonpath = ["src", "."] — auditor importable in tests
- ✅ `requirements.txt` — added openai>=1.0.0, requests>=2.31.0
- ✅ `.env.example` — documented CANVAS_API_TOKEN, CANVAS_ASSIGNMENT_URL, GITHUB_TOKEN, GITHUB_MODEL, QUESTION_COUNT
- ✅ `auditor/__init__.py` — empty package init
- ✅ `auditor/canvas_client.py` — URL parsing, resolve_user_id (search_users + SIS fallback), fetch_submission_text, _extract_zip, bare-requests-get for attachments (no Authorization header)
- ✅ `auditor/github_models_client.py` — OpenAI SDK at https://models.github.ai/inference (/inference suffix required)
- ✅ `auditor/question_generator.py` — LLMClient Protocol, 6000-word truncation, system prompt, numbered-list parser
- ✅ `auditor/output_writer.py` — Markdown file renderer
- ✅ `hw_auditor.py` — argparse CLI, dotenv loading, env validation, per-step error handling, --debug flag
- ✅ `tests/test_canvas_client.py` — 10 tests (URL parsing, user resolution, zip extraction, no-Authorization-header assertion, error paths)
- ✅ `tests/test_question_generator.py` — 7 tests (parsing, truncation, error paths)
- ✅ `tests/test_github_models_client.py` — /inference base URL regression guard

**Test results: 23/23 passing. flake8: clean. mypy strict: clean.**

## Notes / Learnings

- **No Authorization header on attachment download** — Canvas pre-signed S3 URLs reject a second auth mechanism (HTTP 400). Use bare `requests.get(url)`.
- **GitHub Models base URL** must include `/inference` — the OpenAI SDK appends `/chat/completions`; omitting it causes 404.
- **LLMClient Protocol** used instead of direct import to avoid circular imports and enable FakeClient in tests without subclassing.
- **types-requests** must be in `.pre-commit-config.yaml` mypy `additional_dependencies` (pre-commit runs mypy in an isolated env).
- **per_page param** passed as str (not int) to satisfy requests params typing under mypy strict + types-requests stubs.
