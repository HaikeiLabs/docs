---
id: reading-a-report
num: 6
title: "How do you read an eval report?"
seo_title: "How do you read an eval report? Regression or flake"
description: "Read an eval report case by case, not just by its pass rate. Compare each case with the baseline to tell a regression from a flake or a fix."
mins: 5
updated: 2026-11-27
lede: "A pass rate can go up while an important case breaks. Read the report one case at a time and compare each case with the run before it."
quiz:
  q: The pass rate rose, but the refund case now fails 3 of 3 attempts after passing 3 of 3 before. Flake or regression?
  opts:
    - "A regression: it passed every attempt before and fails every attempt now"
    - "A flake: the overall score went up"
    - "Noise: the other cases cancel it out"
    - "Neither: 50% beats 41.7%"
  a: 0
  why: A flake mixes passes and failures under the same settings. Passing 3 of 3 before and failing 3 of 3 now is a consistent change, so it's a regression.
---

## The score went up. What broke?

These are two saved reports for the same four cases, each run three times. The **baseline** is the earlier result you compare against, here the main branch. The candidate is the pull request.

Add up the passes. Main passes 3 + 0 + 2 + 0 = 5 of 12 attempts, about 41.7%. The pull request passes 0 + 3 + 3 + 0 = 6 of 12, or 50%. The score went up, yet `refund-policy` went from 3/3 to 0/3. Each case counts the same in the average, so fixing the greeting hides a broken refund answer.

[widget:compare data=compare-reports]

## Consistent miss or flake?

A **flake** is a case that both passes and fails under the same settings: more than 0 passes but fewer than all of them. A **regression** is a behavior that passed reliably and now fails reliably.

So `compare` labels a case [[1]] `noise` if it is flaky on either side, because a case that flips can't prove a change. It labels a case [[2]] `regression` when it passed every attempt before and fails every attempt now. That's `refund-policy`. The extra pass from `edge-case`, 2 of 3 before and 3 of 3 now, is noise, not a fix: to trust it, run that case more times on the same profile.

```python title="report.py" marks="1=1;3=2"
if b["flaky"] or c["flaky"]:
    label = "noise"
elif b["passed"] and not c["passed"]:
    label = "regression"
elif not b["passed"] and c["passed"]:
    label = "fixed"
elif not b["passed"]:
    label = "still failing"
else:
    label = "unchanged"
```
