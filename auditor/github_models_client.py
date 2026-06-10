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
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
