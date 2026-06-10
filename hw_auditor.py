"""CLI entry point for the Homework Auditor.

Usage:
    python hw_auditor.py <andrew_id> [--count N] [--output-dir DIR] [--env-file FILE] [--debug]
"""
from __future__ import annotations

import argparse
import os
import sys

import openai
from dotenv import load_dotenv

from auditor.canvas_client import CanvasClient
from auditor.github_models_client import GitHubModelsClient
from auditor.question_generator import generate_questions
from auditor.output_writer import write_questions


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="hw_auditor.py",
        description="Generate comprehension questions for a student's Canvas submission.",
    )
    parser.add_argument("andrew_id", help="Student's Andrew ID")
    parser.add_argument(
        "--count",
        metavar="N",
        type=int,
        default=None,
        help="Number of questions to generate (default: env QUESTION_COUNT or 12)",
    )
    parser.add_argument(
        "--output-dir",
        metavar="DIR",
        default=".",
        help="Directory to write the output .md file (default: current directory)",
    )
    parser.add_argument(
        "--env-file",
        metavar="FILE",
        default=".env",
        help="Path to .env file (default: .env)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Re-raise exceptions with full traceback instead of clean exit messages.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    debug: bool = args.debug

    # Load environment variables from .env file.
    try:
        load_dotenv(args.env_file, override=True)
    except FileNotFoundError:
        print(f"Error: .env file not found: {args.env_file}", file=sys.stderr)
        sys.exit(1)

    # Validate required environment variables.
    canvas_token = os.environ.get("CANVAS_API_TOKEN", "")
    canvas_url = os.environ.get("CANVAS_ASSIGNMENT_URL", "")
    github_token = os.environ.get("GITHUB_TOKEN", "")

    missing = [
        name
        for name, val in [
            ("CANVAS_API_TOKEN", canvas_token),
            ("CANVAS_ASSIGNMENT_URL", canvas_url),
            ("GITHUB_TOKEN", github_token),
        ]
        if not val
    ]
    if missing:
        print(
            f"Error: missing required environment variable(s): {', '.join(missing)}. "
            f"Set them in {args.env_file} or the environment.",
            file=sys.stderr,
        )
        sys.exit(1)

    github_model = os.environ.get("GITHUB_MODEL", "openai/gpt-4o-mini")
    question_count: int = args.count if args.count is not None else int(
        os.environ.get("QUESTION_COUNT", "12")
    )

    andrew_id: str = args.andrew_id

    try:
        # Step 1: resolve Canvas user ID.
        canvas_client = CanvasClient(canvas_token, canvas_url)
    except ValueError as exc:
        if debug:
            raise
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        print(f"Resolving Canvas user ID for '{andrew_id}'…")
        user_id = canvas_client.resolve_user_id(andrew_id)
    except ValueError as exc:
        if debug:
            raise
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        if debug:
            raise
        print(f"Error contacting Canvas API: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        print("Fetching submission…")
        submission_text = canvas_client.fetch_submission_text(user_id)
    except ValueError as exc:
        if debug:
            raise
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        if debug:
            raise
        print(f"Error downloading submission: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        print(f"Generating {question_count} comprehension questions via GitHub Models…")
        llm_client = GitHubModelsClient(github_token, github_model)
        questions = generate_questions(llm_client, submission_text, question_count)
    except openai.AuthenticationError:
        if debug:
            raise
        print(
            "Error: GitHub token authentication failed. "
            "Ensure GITHUB_TOKEN is a fine-grained PAT with the 'models:read' scope.",
            file=sys.stderr,
        )
        sys.exit(1)
    except openai.RateLimitError:
        if debug:
            raise
        print(
            "Error: GitHub Models API rate limit exceeded. Wait a moment and try again.",
            file=sys.stderr,
        )
        sys.exit(1)
    except ValueError as exc:
        if debug:
            raise
        print(f"Error generating questions: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        if debug:
            raise
        print(f"Error calling GitHub Models API: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        output_path = write_questions(andrew_id, questions, args.output_dir)
    except Exception as exc:
        if debug:
            raise
        print(f"Error writing output file: {exc}", file=sys.stderr)
        sys.exit(1)

    print(str(output_path))


if __name__ == "__main__":
    main()
