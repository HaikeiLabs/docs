---
id: release-gate
num: 7
title: "How do you gate a release on evals?"
seo_title: "How do you gate a release on agent evals in CI?"
description: "Gate a release on evals with a quick check on each pull request and a wider nightly sweep with repeats. An unreachable model is blocked, never scored as 0%."
mins: 5
updated: 2026-11-27
lede: "Run a quick eval check on every pull request and a wider sweep with repeats every night. When the model server doesn't answer, the gate reports blocked, not 0%."
quiz:
  q: The model server timed out on the pull request run. What should the gate report?
  opts:
    - "Blocked, exit 2: there was no answer, so there is no score"
    - "0%, exit 1: every case failed"
    - "Pass, exit 0: no check failed"
    - "Retry until it passes, then report the pass"
  a: 0
  why: A timeout means there was no answer to grade. The gate reports the profile as blocked with exit 2, never as a 0% score.
---

## A quick check and a nightly sweep

A **gate** is a rule that turns results into a decision: go on or stop. You usually want two of them.

On a pull request, someone is waiting, so the check is quick. It runs only the suites the change touches, once per case. In the tutorial's example workflow the bar is 90%. Haikei's own gate uses 90% for skills and 95% for Agentware. One attempt can catch an assistant looking up the wrong order.

Every night, a wider sweep runs every suite with three repeats per case and a 95% bar. Repeats show whether a miss comes and goes. The code that grades is **pinned** to one commit, so a pull request can change its cases but not the grader.

The gate checks in a fixed order: [[1]] no profiles at all, then [[2]] a blocked profile, then [[3]] a profile below its threshold.

```python title="gate.py (shortened)" marks="3=1;6=2;10=3"
def gate(matrix_result, mode):
    profiles = matrix_result.get("profiles", {})
    if not profiles:
        return 2, f"[{mode}] blocked: no profiles were run"
    blocked = sorted(n for n, p in profiles.items() if p.get("status") == "blocked")
    if blocked:
        return 2, f"[{mode}] blocked: model endpoint did not answer for: {', '.join(blocked)} (not scored)"
    failed = sorted(n for n, p in profiles.items()
                    if p.get("status") == "scored" and not p.get("passed"))
    if failed:
        return 1, f"[{mode}] below threshold: {', '.join(failed)}"
    return 0, f"[{mode}] pass: every profile at or above its threshold"
```

## Pass, fail, or no evidence

The exit code tells the next person what happened. **0** means every scored profile met its threshold. **1** means at least one fell short: you have an answer to investigate.

**2** means a profile was blocked, or no profile ran. A model server that doesn't answer gives you no evidence about the model, so it is never a 0% score. Haikei's own gate reports it as "models unreachable". Get the missing results before you judge that run.

```python title="exit codes"
gate({"profiles": {"local": {"status": "scored", "passed": True}}}, "pr")
# (0, '[pr] pass: every profile at or above its threshold')
gate({"profiles": {"local": {"status": "scored", "passed": False}}}, "pr")
# (1, '[pr] below threshold: local')
gate({"profiles": {"local": {"status": "blocked"}}}, "pr")
# (2, '[pr] blocked: model endpoint did not answer for: local (not scored)')
```
