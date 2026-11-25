---
id: gaps
num: 10
title: "Agentware tool-calling gaps: what doesn't work yet?"
mins: 4
lede: "A few things in Agentware don't match the real requests and formats from Lessons 3 to 5, or the loop from Lesson 9. Each one below was reproduced by running the Python SDK."
quiz:
  q: When does the Qwen3 parsing gap actually bite?
  opts:
    - Always
    - Only in text mode (raw completions, or no server tool parser)
    - Only with Claude
    - Only when streaming
  a: 1
  why: A server running a tool-call parser (for Qwen3, the hermes parser from Lesson 4) hands Agentware structured tool_calls, so the text parser never runs.
finish: true
---

## What doesn't match

The first two gaps affect runs that use `run_inference`: the missing tools on every request, the retry order whenever a reply is retried. The format gaps only matter in text mode: raw completions, or a server with no tool parser. Behind a correctly configured server, Agentware receives clean `tool_calls`.

[widget:gaps]
