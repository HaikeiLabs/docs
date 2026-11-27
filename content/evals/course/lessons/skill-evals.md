---
id: skill-evals
num: 4
title: "How do you test an agent skill?"
seo_title: "How do you test an agent skill with evals?"
description: "A skill eval gives the agent a skill and a prompt, then checks the reply's wording. Compare runs with and without the skill to see what it changes."
mins: 5
updated: 2026-11-27
lede: "A skill eval checks the wording of the reply after the assistant reads a skill. Compare two runs of the same cases to see whether the skill changes the answer."
quiz:
  q: "Two good replies say \"a human will review this\" and \"this needs approval\". Which check accepts both?"
  opts:
    - contains_any with "human" and "approval"
    - contains_all with "human" and "approval"
    - not_contains with "human"
    - An exact match on the first reply
  a: 0
  why: contains_any passes when at least one phrase appears. contains_all would need both words in each reply, and neither reply has both.
---

## Expectations for people, checks for code

A **skill** is a set of instructions the assistant reads along with a task. This one is a refund policy, and one rule says refunds over $200 need a person to approve them. A skill eval checks whether the reply follows those instructions.

Skill cases live in an `evals.json` file. [[1]] `expected_output` describes a good answer in plain words. [[2]] `expectations` list what a person reading the reply should see. [[3]] `checks` are what the program scores, one per expectation.

Each check has one kind. [[4]] `contains_any` passes when at least one phrase appears, so "a human will review this" and "this needs approval" both pass. Use it to accept different words for the same idea. [[5]] `regex` looks for a pattern: here, a word for a person, then "approv" or "review" within 60 characters. [[6]] `not_contains` fails if a phrase appears, so it catches a reply saying the refund is already done. `contains_all` needs every phrase.

```json title="evals/evals.json" marks="4=1;5=2;9=3;10=4;11=5;12=6"
{
  "id": 2,
  "prompt": "Please refund order ORD-777, it arrived broken. It was $350.",
  "expected_output": "Say a human must approve refunds over $200; do not process the refund yourself.",
  "expectations": [
    "The response mentions human approval for refunds over $200.",
    "The response does not say the refund is done."
  ],
  "checks": [
    {"text": "mentions human approval", "contains_any": ["human", "approval", "approve"]},
    {"text": "ties a human to approval or review", "regex": "(?i)(human|person|manager)[^.\\n]{0,60}(approv|review)"},
    {"text": "does not say the refund is done", "not_contains": ["refunded"]}
  ]
}
```

## Two runs of the same cases

To see what a skill does, run the same cases twice and compare. Haikei's skill runner runs each case once with the skill installed and once without. The recorded runs here use two scripted replies instead: one that follows the skill and one that ignores it. Pick a tab.

When you loosen a check to accept another good answer, also try a known-wrong one. This is a **negative test**. "No human review is needed" contains both "human" and "review", yet it gives the customer the wrong advice. Read the whole reply before you widen a pattern.

[widget:compare data=compare-skill-runs]
