---
id: reasoning
num: 5
title: "How do reasoning models handle tool calls?"
mins: 4
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

## On, out, and back

You turn reasoning on in the request, find it in the reply, and send it back the way the model family expects. Pick a family to see all three.

[widget:compare data=compare-reasoning]

## Strip it before you parse tool calls

Models often draft a tool call inside their thinking. If you search the whole output for `<tool_call>`, you'll run the draft. Pull the reasoning out first [[1]], then parse what's left [[2]].

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
