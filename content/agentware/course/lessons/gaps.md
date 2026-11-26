---
id: gaps
num: 10
title: "Agentware tool-calling gaps: what doesn't work yet?"
seo_title: "Agentware tool-calling gaps: what doesn't work yet?"
description: "See where the Agentware SDK still differs from real tool-call formats, for GPT-OSS raw prompts, MiniMax tool calls and tool results, with each gap reproduced."
mins: 4
lede: "Agentware still differs from the real formats in a few places: GPT-OSS raw prompts, MiniMax tool calls, and the text it sends back after a tool runs. Each one below was reproduced by running the Python SDK."
quiz:
  q: When does the MiniMax parsing gap actually bite?
  opts:
    - Always
    - Only in text mode (raw completions, or no server tool parser)
    - Only with Claude
    - Only when streaming
  a: 1
  why: A server running a tool-call parser (for MiniMax M2, the minimax_m2 parser from Lesson 4) hands Agentware structured tool_calls, so the text parser never runs.
finish: true
---

## What doesn't match

The GPT-OSS and MiniMax gaps only matter in text mode: raw completions, or a server with no tool parser. Behind a correctly configured server, Agentware receives clean `tool_calls`. The tool result gap applies when you run tools through `InferenceExecutor`.

[widget:gaps]
