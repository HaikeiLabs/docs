---
id: build-time
num: 8
title: Agentware at build time
mins: 4
lede: "Some things are decided once, before the first request: which tools exist, which model format to use, and how the tools are written into the prompt."
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

## In code

Register the tool [[1]] and pick a formatter, the class that writes and reads one model family's tool format, from the model name [[2]]. Then render the tools: as JSON for the `tools` field [[3]], or as text for the system prompt when the server has no tool parser [[4]].

```python title="build.py" marks="2=1;4=2;6=3;7=4"
registry = ToolRegistry()
registry.register(Weather())

fmt = get_formatter("Qwen/Qwen3-8B")

native = DefaultPromptGenerator().generate_tool_schemas(registry)
text = fmt.format_tool_definitions(registry.all())
```

## The templates it renders

Real output from the Python SDK for the same `get_weather` tool. Pick a model name to see which formatter it gets.

[widget:compare data=compare-build-time]
