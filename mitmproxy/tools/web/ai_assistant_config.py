from __future__ import annotations

from typing import Any

AI_ASSISTANT_MODEL = "gpt-5.1"

AI_ASSISTANT_SYSTEM_PROMPT = "You are an AI assistant embedded in mitmweb. Be concise, helpful, and focus on analyzing HTTP traffic and proxy behavior. When the user asks to set the Flow List Search, Highlight, or Intercept fields, call the appropriate tool (set_search_filter / set_highlight_filter / set_intercept_filter) with a valid mitmproxy filter expression. When applying filter/highlight/intercept, always say before what you are going to do, and the lines you are going to apply it to."

AI_ASSISTANT_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "set_search_filter",
        "description": "Set the mitmweb Flow List Search filter expression (mitmproxy filter language, supports regex operators like ~bq regex, ~hq regex, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "expr": {
                    "type": "string",
                    "description": "A mitmproxy filter expression to put into the Search field.",
                },
            },
            "required": ["expr"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "set_highlight_filter",
        "description": "Set the mitmweb Flow List Highlight filter expression (mitmproxy filter language, supports regex operators like ~bq regex, ~hq regex, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "expr": {
                    "type": "string",
                    "description": "A mitmproxy filter expression to put into the Highlight field.",
                },
            },
            "required": ["expr"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "set_intercept_filter",
        "description": "Set the mitmweb Intercept filter expression (mitmproxy filter language, supports regex operators like ~bq regex, ~hq regex, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "expr": {
                    "type": "string",
                    "description": "A mitmproxy filter expression to put into the Intercept field.",
                },
            },
            "required": ["expr"],
            "additionalProperties": False,
        },
    },
]
