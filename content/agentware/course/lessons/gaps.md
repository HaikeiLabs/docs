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

## When can Agentware miss a tool call or change a result?

If you can see a weather request in the reply but the tool never runs, check who reads the reply. In **native mode**, a server with the matching tool parser hands Agentware structured `tool_calls`. In **text mode**, Agentware has to recognize the model’s own spelling of a call. This happens with raw completions or when the server has no tool parser.

Look at the two parsing examples from the recorded Python SDK version. GPT-OSS addresses its call to `functions.get_weather` in Harmony text. MiniMax M2 wraps its call in `<minimax:tool_call>` tags. Both examples produce `[]`, an empty list of recognized calls. The MiniMax gap matters only when Agentware has to parse that text itself.

The last example follows a lookup that *did* run. `InferenceExecutor`, the component running the tool loop here, puts `Tool get_weather result:` before the weather data in the message it sends back. You can see the temperature and sky in that message, along with the extra words.

[widget:gaps]
