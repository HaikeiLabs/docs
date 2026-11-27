---
id: reasoning
num: 5
title: "How do reasoning models handle tool calls?"
seo_title: "How do reasoning models handle tool calls?"
description: "Learn how reasoning models handle tool calls: how Claude, GPT-OSS and Qwen3 return their thinking, and why you strip it out before you parse tool calls."
mins: 4
updated: 2026-11-27
lede: "Reasoning models write out their thinking before they answer or call a tool. Each family puts that thinking somewhere different and has its own rules for sending it back."
quiz:
  q: "You're looping with Claude with extended thinking (its reasoning mode) turned on. What happens to the thinking block before you send the tool_result?"
  opts:
    - Delete it
    - Summarize it
    - Send it back exactly as received
    - Move it into the system prompt
  a: 2
  why: Thinking blocks are signed. In a tool-use turn they must be replayed unchanged.
---

## Which reasoning should you send back after a tool call?

When you send a weather result back, the next request must include the parts of the previous reply that the model’s format expects. For Claude with extended thinking enabled, that includes the original `thinking` block from the tool-use turn. The block carries a signature that lets the service check it came back unchanged. Editing or dropping it makes the next request fail.

Pick a model to follow its reasoning from the request through the reply and back into the history. GPT-OSS keeps its `analysis` messages while the tool calls are in progress. After the `final` answer, you leave that earlier analysis out of the next prompt.

[widget:compare data=compare-reasoning]

## Why separate reasoning before looking for tool calls?

A model can write a possible call to `get_weather` while deciding what to do. If your program searches the entire reply for a call, it can mistake that draft for a request to run the function.

In Qwen3’s text format, `<think>` and `</think>` enclose the reasoning. `split` collects the contents of those blocks [[1]] and removes the blocks from a copy of the reply. It returns both pieces [[2]] so you can search just the remaining text for `<tool_call>` tags.

```python title="parse.py" marks="4=1;6=2"
THINK = re.compile(r"<think>(.*?)</think>", re.S)

def split(output):
    reasoning = "\n".join(THINK.findall(output))
    visible = THINK.sub("", output).strip()
    return reasoning, visible
```

# Reference

## MiniMax

MiniMax M2 and M3, two more open models, mark their reasoning in their own ways.

[widget:compare data=compare-reasoning-minimax]
