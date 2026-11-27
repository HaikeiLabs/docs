---
id: graders
num: 3
title: "How does an eval grader score a case?"
seo_title: "How does an eval grader score an agent's answer?"
description: "An eval grader compares the agent's decision and reply with each check in the case. Every mismatch is a failure, and a case passes only when there are none."
mins: 5
updated: 2026-11-27
lede: "A grader is the code that compares what the assistant did with the case's `expect` block. Each mismatch adds a failure, and a case passes only when there are none."
quiz:
  q: Two checks fail in one case. How many failed cases is that?
  opts:
    - One
    - Two
    - None, the checks cancel out
    - It depends on the pass rate
  a: 0
  why: A case passes only when every check passes. Two failures in the same case still count as one failed case.
---

## Watch the grader score three answers

A grader is plain code. It runs each check under `expect` and adds a message to `failures` for every mismatch. An empty list means the case passed. Pick a tab to see the case, what the model did, and what the grader says.

In the second tab, one wrong reply breaks two checks: it calls the forbidden lookup and leaves out the words "order id". That is still **one** failed case. The suite counts cases, not checks: this wrong model fails two of the eight cases, so its **pass rate**, the share of cases that passed, is 6 of 8, or 75%.

[widget:compare data=compare-graders]

## No tool, or no assertion?

Two things look alike in a case but grade differently. If you leave `tool` out of `expect`, the grader doesn't check which tool was called. If you set [[1]] `"tool": null`, the assistant must not call any tool at all.

Content checks come in four kinds. `contains_all` needs every phrase. [[2]] `contains_any` passes when at least one phrase appears, so "order id" and "order number" are both fine. `not_contains` fails if a phrase appears, and `regex` looks for a pattern. All four ignore case.

Arguments are compared exactly. For the last case in the suite, the customer's order id is `pending-9`. If the assistant changed it to `PENDING-9`, the `args` check would fail.

```json title="expect" marks="3=1;5=2"
{
  "expect": {
    "tool": null,
    "content": {
      "contains_any": ["order id", "order number"]
    }
  }
}
```
