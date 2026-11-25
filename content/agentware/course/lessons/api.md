---
id: api
num: 3
title: "The API: where tools go"
mins: 4
lede: "Two APIs cover most models: the OpenAI-compatible Chat Completions API, which most model servers copy, and Anthropic's Messages API. They do the same three things with different field names."
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

## Same tool call, two APIs

Pick a moment. Highlighted lines are where the two APIs differ.

[widget:compare data=compare-api]

## Close the loop

`MODEL` is the model id, `URL` the server's `/v1/chat/completions` endpoint, and `TOOLS` your Lesson 2 tool in the OpenAI shape. Keep the assistant message exactly as returned [[1]]: the API keeps no state, so the model only sees its own tool calls if you send them back. Decode the arguments string [[2]], run the tool, and answer each call by its id [[3]]. If there were calls, go again [[4]].

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
