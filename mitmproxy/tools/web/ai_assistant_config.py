from __future__ import annotations

from typing import Any

# Custom OpenAI-compatible gateway
AI_ASSISTANT_BASE_URL = "https://eng-ai-model-gateway.sfproxy.devx-preprod.aws-esvc1-useast2.aws.sfdc.cl"

# Model for regular chat conversations
AI_ASSISTANT_MODEL = "gpt-5"

# Model for flow summary scanning (lighter/faster)
AI_ASSISTANT_SCAN_MODEL = "gpt-5-mini"

AI_ASSISTANT_SYSTEM_PROMPT = "You are an AI assistant embedded in mitmweb. Be concise, helpful, and focus on analyzing HTTP traffic and proxy behavior. When the user asks to set the Flow List Search, Highlight, or Intercept fields, call the appropriate tool (set_search_filter / set_highlight_filter / set_intercept_filter) with a valid mitmproxy filter expression. When applying filter/highlight/intercept, always say before what you are going to do, and the lines you are going to apply it to."

AI_ASSISTANT_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "set_search_filter",
            "description": "Set the mitmweb Flow List Search filter expression (mitmproxy filter language, supports regex operators like ~bq regex, ~hq regex, etc.). Syntax: \n" + """
~a Match asset in response: CSS, JavaScript, images, fonts.
~all Match all flows
~b regex Body
~bq regex Request body
~bs regex Response body
~c int HTTP response code
~comment regex Flow comment
~d regex Domain
~dns Match DNS flows
~dst regex Match destination address
~e Match error
~h regex Header
~hq regex Request header
~hs regex Response header
~http Match HTTP flows
~m regex Method
~marked Match marked flows
~marker regex Match marked flows with specified marker
~meta regex Flow metadata
~q Match request with no response
~replay Match replayed flows
~replayq Match replayed client request
~replays Match replayed server response
~s Match response
~src regex Match source address
~t regex Content-type header
~tcp Match TCP flows
~tq regex Request Content-Type header
~ts regex Response Content-Type header
~u regex URL
~udp Match UDP flows
~websocket Match WebSocket flows

regex Equivalent to ~u regex
! unary not
& and
| or
(...) grouping
            """,
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
    },
    {
        "type": "function",
        "function": {
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
    },
    {
        "type": "function",
        "function": {
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
    },
    {
        "type": "function",
        "function": {
            "name": "highlight_requests",
            "description": "Highlight specific requests by their RID (R1, R2, ...) from Smart Search. This is deterministic highlighting and does not use regex.",
            "parameters": {
                "type": "object",
                "properties": {
                    "rids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of RIDs to highlight, e.g. ['R1', 'R7'].",
                    }
                },
                "required": ["rids"],
                "additionalProperties": False,
            },
        },
    },
]
