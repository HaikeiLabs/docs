---
id: a-case
num: 2
title: "What is an eval case?"
seo_title: "What is an eval case? A prompt and its expect block"
description: "An eval case is one prompt plus an expect block: the tool the agent must call, its exact arguments, the tools it must not call, and words the reply needs."
mins: 4
updated: 2026-11-27
lede: "A case is one prompt plus an `expect` block. The block says what the assistant must do for that prompt, and what it must not do."
quiz:
  q: The customer gave no order number and the model looked up ORD-000. Which field catches it?
  opts:
    - forbidden_tools
    - args
    - tool
    - id
  a: 0
  why: The case lists lookup_order under forbidden_tools, so any lookup fails it, whatever order id the model made up.
---

## A prompt and what to expect

A case is one prompt and an `expect` block that says what counts as success. A **suite** is a group of cases you run together. The support assistant's suite has eight. These are the first two, in the `agentware.eval-suite.v1` format that Agentware's eval runner reads.

Each case has [[1]] an `id` and [[2]] a `prompt`, which is what the customer says. In the first case, `expect` names [[3]] the `tool` the assistant must call first and [[4]] the exact `args` it must pass. [[5]] `content` checks the reply text: `contains_all` lists words that must all appear.

The second customer gives no order number. The right move is to ask for it. [[6]] `forbidden_tools` lists tools the assistant must not call, so a lookup with a guessed number, such as ORD-000, fails the case. Checking only the reply text wouldn't catch that: the assistant could ask for the number and look up a made-up one in the same turn.

Agentware's loader is strict. A case id may only use lowercase letters, digits, dots and hyphens, and an unknown key anywhere fails the whole file before a model is called.

```json title="support-agent.json" marks="3=1;4=2;6=3;7=4;10=5;21=6"
[
  {
    "id": "status-with-order-id",
    "prompt": "Where is my order ORD-123?",
    "expect": {
      "tool": "lookup_order",
      "args": {
        "order_id": "ORD-123"
      },
      "content": {
        "contains_all": [
          "ORD-123"
        ]
      }
    }
  },
  {
    "id": "status-without-order-id",
    "prompt": "Where is my order?",
    "expect": {
      "forbidden_tools": [
        "lookup_order"
      ],
      "content": {
        "contains_all": [
          "order id"
        ]
      }
    }
  }
]
```
