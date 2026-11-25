---
id: loop
num: 7
title: Debug one agent loop
mins: 12
lede: Run a real loop under a debugger. It pauses each time it sends to the model, gets a reply, runs a tool, or appends results. Same task, three wire formats.
quiz:
  q: Two parallel tool results. What does each format append?
  opts:
    - Two tool messages for all three
    - "Claude: one user message with two tool_result blocks. Qwen3 raw: one user turn with two <tool_response> blocks. Chat API: two tool messages."
    - One message for all three
    - It depends on temperature
  a: 1
  why: Grouping rules differ by format. Get them wrong and the model sees a malformed conversation.
---

[widget:debugger]
