---
id: api
num: 3
title: "OpenAI vs Anthropic tool calling"
seo_title: "OpenAI vs Anthropic tool calling: what differs"
description: "Compare OpenAI and Anthropic tool calling: how each API declares a tool, returns the model's tool call and takes the tool result back, field by field."
mins: 4
lede: "OpenAI-compatible APIs and Anthropic's Messages API do the same three things: declare the tool, return the model's call, and take the result back. Only the field names differ, and most model servers copy the OpenAI-compatible API."
quiz:
  q: In an OpenAI-compatible response, what type is function.arguments?
  opts:
    - An object
    - A JSON-encoded string
    - A list
    - It depends on the schema
  a: 1
  why: "It's a string you json.loads(). Anthropic's input is already an object."
---

## How do OpenAI and Anthropic represent the same tool call?

You can use the same weather function with either service. What changes is the **API**, the format your program uses to exchange requests and replies with the service.

Follow Tokyo through the three tabs. In the declaration, OpenAI Chat Completions puts the schema under `function.parameters`. Anthropic Messages uses `input_schema`. When the model asks for Tokyo, OpenAI puts the arguments in a JSON-encoded string, while Anthropic gives you an object in `input`.

After the lookup, OpenAI takes one `tool` message per result. Anthropic groups the `tool_result` blocks in a user message. Both include an ID so you can match each result to the call that requested it.

[widget:compare data=compare-api]

## How do you send the result back to OpenAI?

Include the model’s request and your tool’s result in the conversation you send next. In this example, `MODEL` identifies the model, `URL` points to `/v1/chat/completions`, and `TOOLS` holds the declarations in OpenAI’s format.

First, save the entire assistant message [[1]] so the next request includes the original calls and their IDs. Decode each `function.arguments` string with `json.loads` [[2]] to get the dictionary that `run_tool` expects.

Run the function and copy the call’s ID into `tool_call_id` on the result message [[3]]. That keeps the Tokyo result paired with the Tokyo lookup even if the model also asked for Seoul. The step returns `True` when there were tool calls [[4]], telling the caller to send the updated history again.

```python title="openai_step.py" marks="4=1;6=2;8=3;9=4"
def step(messages):
    body = {"model": MODEL, "messages": messages, "tools": TOOLS}
    msg = requests.post(URL, json=body).json()["choices"][0]["message"]
    messages.append(msg)
    for call in msg.get("tool_calls") or []:
        args = json.loads(call["function"]["arguments"])
        out = run_tool(call["function"]["name"], args)
        messages.append({"role": "tool", "tool_call_id": call["id"], "content": out})
    return bool(msg.get("tool_calls"))
```

# Reference

## Full API reference

Every tool-related field for both APIs, plus raw `/v1/completions`, where you build the prompt yourself.

[widget:api data=api-chat]
