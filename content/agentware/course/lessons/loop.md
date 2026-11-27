---
id: loop
num: 7
title: "How does an agent loop work, step by step?"
seo_title: "How does an agent loop work? Step through one"
description: "Step through an agent loop under a debugger and see how tool calls, tool results and messages flow in Claude, GPT-OSS Harmony and Qwen3 ChatML formats."
mins: 12
updated: 2026-11-27
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

To see how the model learns which city is warmer, follow one weather result into the next request. The debugger lets you pause the Python loop and inspect its history. The model replies are scripted so you can replay the same calls.

Start with Claude. Its first reply asks for Tokyo and Seoul together. Step past `run_tool` for both cities, then past `tool_results`. The next request carries both `tool_result` blocks in one user message. Qwen3 also asks for both cities together and puts two `<tool_response>` blocks in one user turn.

Switch to GPT-OSS. In this run it asks for Tokyo first and Seoul on the next lap, so each result goes back alone. For GPT-OSS and Qwen3, compare **Messages · chat API**, the conversation as chat messages, with **Raw tokens**, the text those messages become for the model.

[widget:debugger]
