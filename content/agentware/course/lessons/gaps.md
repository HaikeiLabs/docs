---
id: gaps
num: 10
title: "Agentware: gaps to fix"
mins: 4
lede: "A few Agentware 0.17.0 templates don't match the real wire formats from Lessons 4 and 5. Each one below was reproduced by running the Python SDK."
quiz:
  q: When does the Qwen3 parsing gap actually bite?
  opts:
    - Always
    - Only in text mode (raw completions, or no server tool parser)
    - Only with Claude
    - Only when streaming
  a: 1
  why: A server running --tool-call-parser hermes hands Agentware structured tool_calls, so the text parser never runs.
finish: true
---

## What doesn't match

These only matter in text mode: raw completions, or a server with no tool parser. Behind a correctly configured server, Agentware receives clean `tool_calls`.

[widget:gaps]
