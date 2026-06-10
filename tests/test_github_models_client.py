"""Unit tests for auditor.github_models_client."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_base_url_includes_inference_suffix() -> None:
    """Guard the C1-class regression: /inference suffix must be in base_url.

    The OpenAI SDK appends /chat/completions to base_url. If /inference is
    omitted the request goes to https://models.github.ai/chat/completions
    which does not exist — every call 404s.
    """
    with patch("auditor.github_models_client.OpenAI") as MockOpenAI:
        MockOpenAI.return_value = MagicMock()

        from auditor.github_models_client import GitHubModelsClient

        GitHubModelsClient(github_token="fake-token")

        MockOpenAI.assert_called_once()
        call_kwargs = MockOpenAI.call_args
        base_url = call_kwargs.kwargs.get("base_url") or call_kwargs.args[0] if call_kwargs.args else None
        # Prefer kwargs
        if call_kwargs.kwargs:
            base_url = call_kwargs.kwargs["base_url"]
        assert base_url == "https://models.github.ai/inference", (
            f"Expected base_url='https://models.github.ai/inference', got {base_url!r}. "
            "This is a C1 regression: omitting /inference causes all API calls to 404."
        )
