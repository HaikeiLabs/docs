---
id: mcp
num: 6
title: "What is MCP?"
seo_title: "What is MCP? Model Context Protocol tools explained"
description: "Learn what MCP (Model Context Protocol) is: how a tool server lists and runs tools over JSON-RPC, and how to convert MCP tools for OpenAI and Anthropic."
mins: 5
updated: 2026-11-27
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

## How do you find and run a tool on an MCP server?

A weather function can live in a separate program. **Model Context Protocol (MCP)** gives your agent loop and that tool server a shared way to communicate. Your **harness**, the code that runs the loop, acts as the client.

The client and server use JSON-RPC, a format for naming an operation in a JSON message and getting its result. They first use `initialize` to agree on the protocol version and supported features.

Select `tools/list` to see how the harness discovers the available names and arguments. Then select `tools/call` to see how it asks the server to run a named tool. The model still exchanges messages with your harness through its usual model API.

[widget:api data=api-mcp]

## How do you describe an MCP tool to OpenAI or Anthropic?

Use the declaration you got from `tools/list`. The name, description and rules for the arguments mean the same thing to both model APIs. Your harness puts them in the fields each API expects.

For OpenAI Chat Completions, wrap the declaration in `function` and copy the MCP tool’s `inputSchema` into `parameters` [[1]]. For Anthropic, put the same schema under `input_schema` next to the tool name [[2]]. In both cases, the harness can use the name in the model’s reply to call the right tool on the MCP server.

Agentware’s Go MCP server runs a process for each user. It sends calls through that user’s Agentware client, which checks whether the call is allowed and records the decision before the tool runs.

```python title="mcp_bridge.py" marks="4=1;8=2"
def mcp_to_openai(t):
    return {"type": "function", "function": {
        "name": t["name"], "description": t["description"],
        "parameters": t["inputSchema"]}}

def mcp_to_anthropic(t):
    return {"name": t["name"], "description": t["description"],
            "input_schema": t["inputSchema"]}
```
