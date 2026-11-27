---
id: runtime
num: 9
title: "What does Agentware check on every tool call?"
seo_title: "What does Agentware check on every tool call?"
description: "Step through a real Agentware run and see each check on a tool call: reasoning removal, response validation and retry, policy allow or deny, and audit."
mins: 8
updated: 2026-11-27
agentware: 0.18.1
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

Follow the weather lookup to see why a tool request might never run. Agentware first separates the model’s reasoning from its reply. A **response validator** then checks whether the reply is a tool call this agent can accept. On the first lap, `weather_lookup` fails that check because the registered name is `get_weather`.

Once a call passes validation, **policy** decides whether this agent has permission to run it. The weather lookups are allowed. On lap 2, `post_to_slack` is a valid call, but the rule requires approval, so the post is denied. An **audit record** logs each decision before an allowed tool runs.

On lap 3, the model gives a weather report in plain text. This agent requires a tool call to finish. The validator finds no call in the text, so Agentware keeps the reply in the history and adds a **retry nudge**, a message explaining what to fix. Look for `retry_nudge` in the message’s `meta` field. The model tries again in the same lap and calls `final_answer`.

[widget:rtdebugger data=runtime-trace]
