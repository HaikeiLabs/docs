---
id: runtime
num: 9
title: "What does Agentware check on every tool call?"
mins: 8
lede: "Before a tool runs, Agentware strips the model's reasoning, validates the reply, checks policy and records an audit entry. Step through a real run under a debugger; it pauses at each of those gates."
quiz:
  q: In lap 3 the model answered in plain text. What did Agentware do?
  opts:
    - Returned the answer to the user
    - Rejected it, nudged the model to call a tool, and retried in the same lap
    - Denied it by policy
    - Ended the run with an error
  a: 1
  why: With a response validator configured, every turn must be a tool call. Agentware keeps the plain-text answer in the history, adds a retry nudge after it (a short message telling the model what to fix), and the model then calls final_answer.
---

The agent has three tools: `get_weather`, `post_to_slack` (which policy denies) and `final_answer`, which it must call to finish. A response validator checks every reply and sends a retry nudge when the model names a tool that doesn't exist or answers in plain text. Each message's `meta` field is Agentware's label for it, such as `tool_result` or `retry_nudge`.

[widget:rtdebugger data=runtime-trace]
