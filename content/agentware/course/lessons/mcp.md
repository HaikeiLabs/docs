---
id: mcp
num: 6
title: "What is MCP?"
seo_title: "What is MCP? Model Context Protocol tools explained"
description: "Learn what MCP (Model Context Protocol) is: how a tool server lists and runs tools over JSON-RPC, and how to convert MCP tools for OpenAI and Anthropic."
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

An MCP server lists its tools and runs them when your harness asks. It uses JSON-RPC 2.0: every request is a JSON object with a method name and parameters. After `initialize`, where client and server agree on the protocol version and what each supports, you only need these two methods.

[widget:api data=api-mcp]

## Translate for your model

An MCP tool isn't tied to any model, so converting it is just a rename: [[1]] for OpenAI-compatible APIs, [[2]] for Anthropic.

Agentware, the SDK in Lessons 8 to 10, does this in its Go MCP server (`go/mcp`). It runs one process per user, and each process sends calls through that user's Agentware client, which checks policy (allow or deny) and writes an audit record (a log of each call) before the tool runs.

```python title="mcp_bridge.py" marks="4=1;8=2"
def mcp_to_openai(t):
    return {"type": "function", "function": {
        "name": t["name"], "description": t["description"],
        "parameters": t["inputSchema"]}}

def mcp_to_anthropic(t):
    return {"name": t["name"], "description": t["description"],
            "input_schema": t["inputSchema"]}
```
