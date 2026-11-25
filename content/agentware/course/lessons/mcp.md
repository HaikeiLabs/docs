---
id: mcp
num: 6
title: "What is MCP?"
mins: 5
lede: "MCP (Model Context Protocol) is a standard way for a separate server to offer tools to your agent. Your harness, the code that runs the loop, speaks MCP; the model never does."
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

An MCP server lists its tools and runs them when your harness asks. It uses JSON-RPC 2.0: every request is a JSON object with a method name and parameters. After the `initialize` handshake, you only need these two methods.

[widget:api data=api-mcp]

## Translate for your model

An MCP tool isn't tied to any model, so converting it is just a rename: [[1]] for OpenAI-compatible APIs, [[2]] for Anthropic.

Agentware, the SDK in Lessons 8 to 10, does this in its Go MCP server (`go/mcp`). It runs one process per user, so every call still goes through policy (allow or deny) and audit (a record of each call).

```python title="mcp_bridge.py" marks="4=1;8=2"
def mcp_to_openai(t):
    return {"type": "function", "function": {
        "name": t["name"], "description": t["description"],
        "parameters": t["inputSchema"]}}

def mcp_to_anthropic(t):
    return {"name": t["name"], "description": t["description"],
            "input_schema": t["inputSchema"]}
```
