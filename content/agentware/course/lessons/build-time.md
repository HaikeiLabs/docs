---
id: build-time
num: 8
title: "How does Agentware format tools for each model?"
seo_title: "How does Agentware format tools for each model?"
description: "See how the Agentware SDK picks a tool-call formatter from the model name and writes your tools for Claude, Qwen3, GPT-OSS and MiniMax, with real output."
mins: 4
updated: 2026-11-27
agentware: 0.18.1
lede: "Agentware picks a formatter from the model name once, when you build the agent. The formatter writes your tools into the request, or into the prompt as text when the server can't parse tool calls."
quiz:
  q: When does get_formatter(model_name) run?
  opts:
    - On every model response
    - Once, when you build the agent
    - Only when a tool fails
    - Inside the model
  a: 1
  why: "The model format doesn't change mid-run, so the formatter is picked once."
---

## How does Agentware prepare a tool for a model?

You can keep one weather function even when two models need different instructions for calling it. At build time, when you put the agent together, register `Weather()` [[1]] so Agentware can find the tool. Then choose a **formatter**, the code that reads and writes a model family’s tool format. `get_formatter` uses the model name [[2]] and runs once when you build the agent.

The last two lines show two ways to describe that tool. In **native mode**, the server handles structured tool calls. `generate_tool_schemas` builds the OpenAI-style list for the request’s `tools` field [[3]].

In **text mode**, the program supplies the tool instructions as part of the prompt and reads calls from the reply text. `format_tool_definitions` writes the instructions for that model [[4]]. Use this form when the server leaves tool calls as text.

```python title="build.py" marks="2=1;4=2;6=3;7=4"
registry = ToolRegistry()
registry.register(Weather())

fmt = get_formatter("Qwen/Qwen3-8B")

native = DefaultPromptGenerator().generate_tool_schemas(registry)
text = fmt.format_tool_definitions(registry.all())
```

## What does the weather tool look like in each format?

Choose Qwen3 and look for `get_weather` inside the `<tools>` tags. Below the declaration, the formatter gives the model an example of how to ask for a function inside `<tool_call>` tags.

Switch to Claude and find the same city argument under `input_schema`. GPT-OSS gets an OpenAI-style JSON declaration, and MiniMax M2 gets the generic JSON formatter in this version of the Python SDK. The second pane in each tab shows how that formatter writes the result after the lookup.

[widget:compare data=compare-build-time]
