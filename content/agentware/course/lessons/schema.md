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

## How does the model know when to call a function?

Give the model a **tool declaration**, a description it can use to choose a function and supply its arguments. For the weather lookup, you send three things.

The **name** [[1]] gives the model the exact spelling to request, `get_weather`. The **description** [[2]] tells it when that function is useful, such as when someone asks about the weather in a city.

The **parameters** [[3]] use JSON Schema, a way to describe the shape and allowed values of JSON data. Here `enum` [[4]] lists the two allowed spellings for `unit`. The `required` list [[5]] means the model must supply `city` and may leave out `unit`.

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

## How does a tool name become a Python call?

Your program needs a way to turn the string `get_weather` into the function you wrote. A **registry** is the dictionary that pairs each available name with its function.

When the model asks for a tool, `run_tool` looks up its name [[1]]. For a known name, `fn(**args)` passes the arguments by keyword [[2]]. A request with `city` set to `Tokyo` becomes `get_weather(city="Tokyo")`.

An unknown name produces an error message in JSON. If a required argument is missing, Python raises `TypeError`, which this code also returns as JSON [[3]]. The next time you call the model, it can read the error and try again.

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
