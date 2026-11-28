---
id: what-to-evaluate
num: 1
title: "What should an agent eval check?"
seo_title: "What should an AI agent eval check?"
description: "An agent eval should check the decision: which tool the agent chose and which arguments it passed. Code can grade that exactly, with no judge model."
mins: 4
updated: 2026-11-27
lede: "Check the decision the assistant makes: the tool it picks and the arguments it passes. Code can compare those exactly. Words like friendly or helpful need a judgment."
quiz:
  q: Which of these can code grade without a judge?
  opts:
    - The lookup used ORD-123
    - The reply was friendly
    - The reply was helpful
    - The reply was clear
  a: 0
  why: Code can compare the order id with ORD-123 exactly. Friendly, helpful and clear are judgments, not values code can compare.
---

## Grade the decision, not the prose

An agent eval should check what the assistant decided to do. A customer asks "Where is my order ORD-123?" Before any tool runs, the assistant proposes a decision: [[1]] which tool to use and [[2]] which arguments to pass. It also writes [[3]] a reply.

An **eval** gives the assistant a task and checks what it does. A **case** is one situation you want to try, like this question. An **expectation** says how you'll recognize success: here, the assistant chose `lookup_order` and passed `ORD-123`.

The reply can sound right while the lookup is wrong. If the assistant asked for ORD-321, the customer would get a real shipping status for someone else's order.

```json title="decision" marks="2=1;4=2;6=3"
{
  "tool": "lookup_order",
  "args": {
    "order_id": "ORD-123"
  },
  "text": "Order ORD-123 is shipped."
}
```

## Which checks can code grade?

Code can compare exact values: the tool name [[1]] and the order id [[2]]. A swapped digit, ORD-132, fails the second check. `decide` asks the model for one decision, and `model` here is a **scripted model**: a stand-in that returns an answer prepared in advance, so the test runs without a model server.

"Friendly", "helpful" and "clear" are judgments. Code can't compare them with a value. The evals in this course use only checks code can run: the tool, its arguments, and words that must or must not appear in the reply. They use no judge model, which is a second model asked to grade the first one's answer.

```python title="test_agent.py" marks="2=1;3=2"
result = decide("Where is my order ORD-123?", model)
assert result["tool"] == "lookup_order"
assert result["args"] == {"order_id": "ORD-123"}
```
