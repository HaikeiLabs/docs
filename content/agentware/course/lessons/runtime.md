---
id: runtime
num: 9
title: Agentware at runtime
mins: 8
lede: "Run a real Agentware loop under a debugger. It pauses at every gate: the model call, reasoning, validation, policy, audit, the tool, and the append."
quiz:
  q: In lap 3 the model answered in plain text. What did Agentware do?
  opts:
    - Returned the answer to the user
    - Rejected it, nudged the model to call a tool, and retried in the same lap
    - Denied it by policy
    - Ended the run with an error
  a: 1
  why: With a validator configured, every turn must be a tool call. Plain text gets a retry nudge, so the agent finishes by calling final_answer.
---

[widget:rtdebugger data=runtime-trace]
