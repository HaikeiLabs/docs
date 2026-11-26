---
title: "How do LLM tool calls work? A course from scratch"
seo_title: "How do LLM tool calls work? A free course from scratch"
description: "Learn how LLM tool calling works: one Python function, the OpenAI and Anthropic APIs, model chat templates, MCP, and a full agent loop, in ten short lessons."
type: read-and-use
product: agentware
nav_group: Start here
nav_order: 9
course: agentware
lessons:
  - tool-call
  - schema
  - api
  - tags
  - reasoning
  - mcp
  - loop
  - build-time
  - runtime
  - gaps
groups:
  - label: Foundations
    from: tool-call
  - label: Hands on
    from: loop
  - label: Agentware
    from: build-time
finish:
  primary:
    label: Python quick start
    href: /agentware/build/python
  secondary:
    label: Playground
    href: https://playground.haikeilabs.com
---

Should you pack an umbrella for Tokyo? To answer with a weather report, a large language model (LLM) can ask your program to look up the city. That request is a **tool call**. The model supplies the function name and arguments, your Python code runs the lookup, and you send the result back so the model can answer.

Start with a weather function small enough to read in one sitting. Follow its call through the OpenAI and Anthropic message formats, then see how a separate server can offer the same tool. In the debugger, step through the **agent loop**, the code that keeps asking the model what to do until it has an answer.

The last three lessons show how Agentware describes tools to different models, checks requests before running them, and handles formats its text parser can miss. Each of the ten lessons takes four to twelve minutes and ends with one question. If you can read Python, you can start with the first example. The recordings let you follow every call without a model or an API key.
