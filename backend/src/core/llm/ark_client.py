from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ARK_API_URL = os.getenv(
    "ARK_API_URL",
    "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
).strip()
ARK_API_KEY = os.getenv("ARK_API_KEY", "0be5a086-269c-4c87-a09a-83a9be7a9af4").strip()
ARK_MODEL = os.getenv("ARK_MODEL", "ep-20260326175057-hslfh").strip()


class ArkClientError(RuntimeError):
    """Raised when the Ark API call fails."""


def ark_chat(
    *,
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 512,
    timeout: int = 30,
) -> str:
    """Call Volcengine Ark chat completions API."""

    if not ARK_API_KEY:
        raise ArkClientError("ARK_API_KEY is not configured.")

    payload: dict[str, Any] = {
        "model": model or ARK_MODEL,
        "thinking.type": "disabled",
        "reasoning_effort": "minimal",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        ARK_API_URL,
        data=raw,
        headers={
            "Authorization": f"Bearer {ARK_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ArkClientError(f"Ark HTTP {exc.code}: {detail[:500]}") from exc
    except URLError as exc:
        raise ArkClientError(f"Ark connection failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ArkClientError("Ark request timed out.") from exc

    try:
        data = json.loads(response_body)
        return str(data["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise ArkClientError(f"Unexpected Ark response: {response_body[:500]}") from exc
