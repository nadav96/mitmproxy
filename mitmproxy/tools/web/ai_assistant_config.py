from __future__ import annotations

from typing import Any

AI_ASSISTANT_MODEL = "gpt-5"

AI_ASSISTANT_SYSTEM_PROMPT = "You are an AI assistant embedded in mitmweb. Be concise, helpful, and focus on analyzing HTTP traffic and proxy behavior."

AI_ASSISTANT_TOOLS: list[dict[str, Any]] = []
