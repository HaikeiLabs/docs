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

A tool call is a message in which the model asks your code to run a function: it writes the function's name and arguments, and your code runs it and sends the result back. Repeat that until the model answers in plain text, and you have an agent.

These ten lessons follow one tool call from a plain Python function through the OpenAI and Anthropic APIs, the text formats models read, and MCP, to a full agent loop you can step through under a debugger. The last three lessons show what Agentware does at build time and at runtime, and where it still differs from the real formats.

Each lesson takes four to twelve minutes and ends with one question. You need some Python. You don't need a model or an API key: every example runs on recorded data.
