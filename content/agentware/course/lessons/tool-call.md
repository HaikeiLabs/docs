---
id: tool-call
num: 1
title: "What is a tool call?"
seo_title: "How do LLM tool calls work? A tool call explained"
description: "Learn how LLM tool calls work: the model writes a request to run a function, your code runs it and sends back the result, and that loop is the whole agent."
mins: 4
lede: "A tool call is a message in which the model asks your code to run a function. The model only writes the request; your code runs the function and sends the result back."
quiz:
  q: Who runs get_weather?
  opts:
    - The model provider
    - "Your code, after reading the model's request"
    - The model itself
    - The tokenizer
  a: 1
  why: The model only writes the request. Your code runs it and sends back the result.
---

## How can a model look up the weather?

To answer “Do I need an umbrella in Tokyo?”, the model needs a weather report. You can give it a **tool**, a function your program makes available. A **tool call** is the model’s request to run that function with particular arguments.

Here `get_weather` accepts a city and an optional unit [[1]]. It looks up the city in a small table of sample weather [[2]] and returns a dictionary [[3]]. For Tokyo, the temperature is `22` and the sky is `rain`.

Your Python program runs the lookup. The model sees a description of the function and, once you send it back, the result.

```python title="tools.py" marks="1=1;3=2;4=3"
def get_weather(city: str, unit: str = "celsius") -> dict:
    fake = {"Tokyo": (22, "rain"), "Seoul": (17, "clear")}
    temp, sky = fake.get(city, (20, "unknown"))
    return {"city": city, "temp": temp, "sky": sky}
```

## Why does the model need another turn?

The first reply can ask for the weather. To use the result in its answer, the model needs a second request from your program. Each request to the model counts as one **lap** of the loop.

Press play and follow the arrows from the model to your code and back. Switch from Claude to GPT-OSS and watch the lap count. In this recording Claude asks for both cities together, while GPT-OSS asks for one city per turn and takes an extra lap.

[widget:cycle]

## What makes this loop an agent?

An agent can use one reply to decide what to do next. This loop starts with a **history**, the messages so far. `system` holds instructions for the model, and `question` holds the user’s request.

Send the history and the available tools to the model [[1]]. If the reply has no tool calls [[2]], return its text to the user. Otherwise, visit each requested call [[3]], run the named function with its arguments, and append the result [[4]] so the next request includes it.

```python title="loop.py" marks="3=1;4=2;6=3;7=4"
history = [system, question]
while True:
    reply = call_model(history, tools)
    if not reply.tool_calls:
        return reply.text
    for call in reply.tool_calls:
        history.append(run_tool(call.name, call.args))
```
