---
id: schema
num: 2
title: "How do you describe a tool to an LLM?"
seo_title: "How do you describe a tool to an LLM? Name and JSON Schema"
description: "Learn how to describe a tool to an LLM with a name, a description and a JSON Schema for its parameters, and how to map tool names back to your functions."
mins: 4
lede: "You give the model a name, a description and a JSON Schema for the parameters. That's all it knows about your function."
quiz:
  q: What does the model receive about your tool?
  opts:
    - The Python source
    - The name, description and JSON Schema
    - Every possible return value
    - Your docstring, read automatically
  a: 1
  why: Only the declaration crosses the wire, which is why the description matters.
---

## Name, description, parameters

The model never sees your code. It sees only this declaration.

[[1]] **name** is what the model writes to call it.

[[2]] **description** is a prompt. It's how the model decides *when* to use the tool.

[[3]] **parameters** is JSON Schema, the standard way to describe the shape of JSON data.

[[4]] `enum` keeps values valid, and [[5]] `required` marks what can't be left out.

```python title="tools.py" marks="2=1;3=2;4=3;8=4;10=5"
TOOL = {
    "name": "get_weather",
    "description": "Get the current weather for a city.",
    "parameters": {
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "City name, e.g. Tokyo"},
            "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
        },
        "required": ["city"],
    },
}
```

## Map names to functions

This is the `run_tool` the Lesson 1 loop calls. Look up the name [[1]] and run it [[2]]: `**args` passes each key in the arguments dict as a keyword argument. Return errors as data [[3]]: the model can read the error and fix its arguments on the next lap, but a crash ends the run.

```python title="tools.py" marks="4=1;8=2;10=3"
REGISTRY = {"get_weather": get_weather}

def run_tool(name, args):
    fn = REGISTRY.get(name)
    if fn is None:
        return json.dumps({"error": f"unknown tool {name}"})
    try:
        return json.dumps(fn(**args))
    except TypeError as e:
        return json.dumps({"error": str(e)})
```
