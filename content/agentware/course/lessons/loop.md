---
id: loop
num: 7
title: "How does an agent loop work, step by step?"
mins: 12
lede: "An agent loop calls the model, runs the tools it asks for, appends the results and calls the model again until it answers in plain text. Step through a real loop under a debugger, in three formats: Claude's Messages API, GPT-OSS Harmony and Qwen3 ChatML."
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
