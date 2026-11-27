---
id: same-cases-many-models
num: 5
title: "How do you compare LLMs on the same eval?"
seo_title: "How do you compare LLMs on the same agent eval?"
description: "To compare LLMs fairly, keep the eval cases and checks fixed, change only the model profile, and repeat each case. Per-case counts show what an average hides."
mins: 5
updated: 2026-11-27
lede: "Keep the cases and checks fixed, change only the model profile, and repeat each case. Then a change in the score comes from the model, and repeats show answers that vary."
quiz:
  q: You changed the model and the cases at the same time. The score went up. What do you know?
  opts:
    - Not which change raised the score
    - The new model is better
    - The new cases are easier
    - The old model was flaky
  a: 0
  why: Two things changed at once, so either one could explain the new score. Hold the cases fixed and change only the profile.
---

## Hold the cases fixed

A **profile** names a model and the settings used to call it. **Temperature** controls how much variety the model adds: 0 favors the most likely text. A fixed **seed** asks for the same starting point for random choices, where the server supports it. Some profiles also turn the model's thinking on or off.

To compare two models, give both the same cases and the same checks, and change only the profile. If you change the model and the cases together, you can't tell which change moved the score.

A **repeat** is another try at the same case with the same settings. The runner [[1]] takes each case, [[2]] runs it `repeats` times and counts the passes. A case that both passes and fails is [[3]] **flaky**. [[4]] The pass rate is the share of all attempts that passed.

```python title="matrix.py (simplified)" marks="1=1;3=2;6=3;7=4"
for case in suite["cases"]:
    passes = 0
    for _ in range(repeats):
        if run_case(case, model)["passed"]:
            passes += 1
    cases.append({"id": case["id"], "passes": passes, "flaky": 0 < passes < repeats})
pass_rate = sum(c["passes"] for c in cases) / (len(cases) * repeats)
```

## One lookup can hide a wrong argument

Here one three-case suite runs three times on four profiles, so each profile has nine attempts. Each profile also has a **threshold**: the lowest pass rate you'll accept, here 80%.

The weak profile's lookup runs every time, but with ORD-000 instead of ORD-123. A lookup that runs isn't a lookup that's right: only the `args` check sees the wrong order. The flaky profile clears 80% overall, yet its `faq` case passed 2 of 3. Look at the per-case counts, not just the average.

[widget:compare data=compare-profiles]
