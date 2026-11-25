---
id: steps
num: 2
title: Steps
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

## Declare

Fixture lesson.

```json title="tool.json" marks="1=GPT-OSS"
{"name":"a very long fixture line that exercises horizontal scrolling inside the code block without causing the entire document to overflow on mobile devices"}
```

## Call

```tokens title="call.txt"
<|call|>
```

## Return

```bash title="result.sh"
echo done
```
