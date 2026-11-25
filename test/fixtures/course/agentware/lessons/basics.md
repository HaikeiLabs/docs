---
id: basics
num: 1
title: Basics
mins: 4
lede: Fixture lesson.
quiz:
  q: Which answer is correct?
  opts:
    - First
    - Second
  a: 0
  why: The first answer is correct.
---

## Define a tool

Fixture lesson: name [[1]], input [[2]], result [[3]].

```python title="tools.py" marks="1=1;2=2;3=3"
def weather(city):
    return city
result = weather("Tokyo")
```

## Run the cycle

[widget:cycle]
