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
