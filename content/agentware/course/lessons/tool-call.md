---
id: tool-call
num: 1
title: What a tool call is
mins: 4
lede: A model can only write text. A tool call is text that asks your code to run a function.
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

## Start with a plain function

This is the whole tool. Nothing about it is AI-specific. [[1]] takes arguments, [[2]] does the work, [[3]] returns data the model can read.

The model never sees this code. It only sees a description of it, which you'll write in Lesson 2.

```python title="tools.py" marks="1=1;3=2;4=3"
def get_weather(city: str, unit: str = "celsius") -> dict:
    fake = {"Tokyo": (22, "rain"), "Seoul": (17, "clear")}
    temp, sky = fake.get(city, (20, "unknown"))
    return {"city": city, "temp": temp, "sky": sky}
```

## Watch the loop run

Press play. Every arrow is one message. Your code sits in the middle and does all the routing. The rings count laps: each lap is one call to the model. Switch the model to see the count change.

[widget:cycle]

## That loop is the agent

Call the model [[1]]. If it didn't ask for a tool [[2]], you're done. Otherwise run what it asked for [[3]], add the results to the conversation, and go around again [[4]].

```python title="loop.py" marks="3=1;4=2;6=3;7=4"
history = [system, question]
while True:
    reply = call_model(history, tools)
    if not reply.tool_calls:
        return reply.text
    for call in reply.tool_calls:
        history.append(run(call))
```
