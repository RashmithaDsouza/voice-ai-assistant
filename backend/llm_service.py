"""
LLM Service — Ollama chat completions with conversation context
"""

import logging
import time
from typing import AsyncGenerator

import httpx

from config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT,
    OLLAMA_SYSTEM_PROMPT,
    MAX_CONVERSATION_TURNS,
)

logger = logging.getLogger(__name__)


class ConversationManager:
    """Maintains per-session conversation history."""

    def __init__(self, max_turns: int = MAX_CONVERSATION_TURNS):
        self._sessions: dict[str, list[dict]] = {}
        self._max_turns = max_turns

    def get_messages(self, session_id: str) -> list[dict]:
        return self._sessions.setdefault(session_id, [])

    def add_user_message(self, session_id: str, text: str):
        history = self.get_messages(session_id)
        history.append({"role": "user", "content": text})
        self._trim(session_id)

    def add_assistant_message(self, session_id: str, text: str):
        history = self.get_messages(session_id)
        history.append({"role": "assistant", "content": text})
        self._trim(session_id)

    def clear(self, session_id: str):
        self._sessions.pop(session_id, None)

    def _trim(self, session_id: str):
        history = self._sessions.get(session_id, [])
        if len(history) > self._max_turns * 2:
            self._sessions[session_id] = history[-(self._max_turns * 2):]


conversation_manager = ConversationManager()


def _build_payload(session_id: str) -> list[dict]:
    """Build the full messages array with system prompt + conversation history."""
    messages = [{"role": "system", "content": OLLAMA_SYSTEM_PROMPT}]
    messages.extend(conversation_manager.get_messages(session_id))
    return messages


async def check_health() -> dict:
    """Check if Ollama is reachable and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            models = [m["name"] for m in data.get("models", [])]
            model_ready = any(OLLAMA_MODEL in m for m in models)
            return {
                "online": True,
                "model": OLLAMA_MODEL,
                "model_available": model_ready,
                "available_models": models,
            }
    except Exception as exc:
        logger.warning("Ollama health check failed: %s", exc)
        return {"online": False, "model": OLLAMA_MODEL, "error": str(exc)}


async def chat(session_id: str, user_text: str) -> dict:
    """
    Send user text to Ollama and get full response (non-streaming).

    Returns dict with: response, latency, model
    """
    messages = _build_payload(session_id)
    messages.append({"role": "user", "content": user_text})

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.ConnectError:
        raise ConnectionError(
            "Cannot connect to Ollama. Make sure Ollama is running: `ollama serve`"
        )
    except httpx.TimeoutException:
        raise TimeoutError(f"Ollama timed out after {OLLAMA_TIMEOUT}s")
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"Ollama error {exc.response.status_code}: {exc.response.text}")

    assistant_text = data.get("message", {}).get("content", "").strip()
    elapsed = time.time() - start

    conversation_manager.add_user_message(session_id, user_text)
    conversation_manager.add_assistant_message(session_id, assistant_text)

    logger.info(
        "LLM response: model=%s latency=%.2fs length=%d",
        OLLAMA_MODEL, elapsed, len(assistant_text),
    )

    return {
        "response": assistant_text,
        "model": OLLAMA_MODEL,
        "latency": round(elapsed, 3),
    }


async def chat_stream(session_id: str, user_text: str) -> AsyncGenerator[str, None]:
    """
    Stream response tokens from Ollama for lower perceived latency.

    Yields text chunks as they arrive.
    """
    conversation_manager.add_user_message(session_id, user_text)
    messages = _build_payload(session_id)
    full_response = []

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    import json
                    chunk = json.loads(line)
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        full_response.append(token)
                        yield token
                    if chunk.get("done"):
                        break
    except httpx.ConnectError:
        yield "[Error: Cannot connect to Ollama. Is it running?]"
        return

    assistant_text = "".join(full_response)
    conversation_manager.add_assistant_message(session_id, assistant_text)
