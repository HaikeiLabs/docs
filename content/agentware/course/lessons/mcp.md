---
id: mcp
num: 6
title: "MCP: tools from another process"
mins: 5
lede: MCP is a standard way for a separate server to offer tools. Your harness speaks MCP. The model never does.
quiz:
  q: Which side speaks MCP?
  opts:
    - The model
    - Your harness and the tool server
    - Only Claude
    - The chat template
  a: 1
  why: MCP sits between your harness and tool servers. The model still sees tools in its own format.
---

## Two methods matter

MCP is JSON-RPC 2.0. After `initialize`, you only need these two.

[widget:api data=api-mcp]

## Translate for your model

An MCP tool isn't tied to any model, so converting it is just a rename: [[1]] for OpenAI-compatible APIs, [[2]] for Anthropic.

Agentware's Go MCP server (`go/mcp`) serves a `ToolRegistry` this way, with one process per user, so every call still goes through policy and audit.

```python title="mcp_bridge.py" marks="4=1;8=2"
def mcp_to_openai(t):
    return {"type": "function", "function": {
        "name": t["name"], "description": t["description"],
        "parameters": t["inputSchema"]}}

def mcp_to_anthropic(t):
    return {"name": t["name"], "description": t["description"],
            "input_schema": t["inputSchema"]}
```
