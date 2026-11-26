---
id: loop
num: 7
title: "How does an agent loop work, step by step?"
mins: 12
lede: "An agent loop calls the model, runs the tools it asks for, appends the results and calls the model again until it answers in plain text. Step through a recorded loop under a debugger, in three formats: Claude's Messages API, GPT-OSS Harmony and Qwen3 ChatML."
quiz:
  q: The model asks for two tools at once. How does each format send the two results back?
  opts:
    - "Claude: one user message with two tool_result blocks. Qwen3: one user turn with two tool_response blocks. GPT-OSS: never two at once here."
    - "Claude: two user messages, one tool_result each. Qwen3: two user turns, one tool_response each. GPT-OSS: two commentary messages."
    - "All three: one tool message per result, in call order, the same as the Chat Completions API from Lesson 3."
    - "Claude: both results inside the assistant message. Qwen3: both inside the assistant turn. GPT-OSS: both on the analysis channel."
  a: 0
  why: "Claude and Qwen3 group results from one turn into one message. GPT-OSS calls one tool per turn in this run, so each result goes back alone."
---

The model's replies are scripted, and every request is built exactly as you would send it. Claude and Qwen3 ask for both cities at once; GPT-OSS asks for one city per turn, so it never sends back two results together. When two results come back, Claude puts both `tool_result` blocks in one user message, and Qwen3 puts both `<tool_response>` blocks in one user turn. **Messages · chat API** shows the conversation as the OpenAI-compatible Chat Completions API from Lesson 3 holds it, and **Raw tokens** shows the text GPT-OSS and Qwen3 actually read.

[widget:debugger]
