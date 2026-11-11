---
title: How Haikei evals work
description: "How HaikeiLabs tests skills and agents: table-test cases, deterministic checks, the CI gate and nightly sweep, and the models that run them."
type: reference
product: agentware
nav_group: Reference
---

Haikei tests what it ships with two eval systems. Both grade with deterministic checks and no LLM judge. One tests skills: does a coding agent find, load and follow a [Haikei Skill](/skills/)? The other tests agents: does a model call the right tool with the right arguments?

| | Skill evals | Agentware evals |
| --- | --- | --- |
| Question | Does the skill change what the agent does? | Does the model call the right tool with the right arguments? |
| Cases | `evals.json` per skill in the HaikeiLabs/skills repo | `agentware.eval-suite.v1` suites in the repo that owns the agent |
| Runner | `scripts/run-evals.mjs` in HaikeiLabs/skills | `python -m evals.main` in HaikeiLabs/Agentware |
| What runs | A real coding agent, headless | The runner's own tool loop with mock executors |

## Skill evals

Each case pairs a prompt with what a good answer contains. The `expectations` text documents the answer for humans. The `checks` are what gets scored: `contains_all`, `contains_any`, `regex`, `not_contains`, all case-insensitive, one check per expectation.

The runner creates two scratch projects per case, one with the skill installed and one without. Only the skill's teaching content is staged; the answer key never is. The sandbox denies shell, edits, web search, subagents and reads outside the scratch project, so the score measures what the skill teaches, not what the model can find on disk. The harness is headless opencode; `--harness claude`, `codex` and `pi` exist for local runs.

## Agentware evals

An Agentware suite maps prompts to expected tool calls: the first tool called, its exact arguments, required and forbidden argument keys, tools that must never be called, content checks on the reply, and deny cases. When a case sets `allowed_tools`, the runner builds a real default-deny Kei policy: a disallowed call is refused by the middleware, so a deny case tests the policy, not the model's manners.

The loader is strict: an unknown key or a deny case without `allowed_tools` is rejected before a model is called. There is no LLM grader. Exit codes: 0 every suite at or above threshold, 1 a suite below it, 2 a run that did not complete, never scored.

## Models and determinism

The checks are deterministic; the answers are sampled. The model profiles fix the sampling:

- GLM-5.3-Flash samples at temperature 0 with a fixed seed (42), thinking on.
- Qwen3.8-27B uses its recommended thinking-mode sampling (temperature 0.6, top_p 0.95, top_k 20) with the same seed, because greedy sampling makes it loop with thinking on.

A run can still miss a check and a rerun can pass. The nightly sweep repeats each case 3 times and averages: a suite scores passed runs over total runs. One miss is not a regression; what matters is whether the same case fails across runs.

## The CI gate

Each repository carries a copy of the same workflow template.

- **On a pull request:** the suites the pull request changes, once per case, a 30-minute job limit. The gate fails when a suite scores below 90% per model in the skills repo (95% in the Agentware repo). A sticky comment holds the suite-by-model table.
- **Nightly at 09:00 UTC:** every suite, 3 repeats per case, a 110-minute job limit. That averaged sweep is the record. A failing sweep opens or updates a nightly-issue; a passing one closes it.
- **The grader is pinned** to a commit, so a pull request can change its suites but not the code that grades them.
- **While a pull request carries the `evals:tuning` label, nothing runs** and the gate fails until the label is removed. Remove it only when the suite reaches the local bar on both models at 3 repeats.
- **A model server that does not answer is "models unreachable", never a score.**

Suites are split into shards so each job fits its timeout. The jobs run on self-hosted runner scale sets in the Kei cluster, on a runner image built from kei `infra/images/agent-evals-runner`: node, python with uv, opencode 1.18.32.

## Long cases

Cases marked with a `long` flag will run nightly only; a pull request opts in with the `evals:long` label. This is being added; until it lands, pull requests run long cases too.

## Run your own

Every skill in HaikeiLabs/skills ships its cases in `evals.json`; [docs/evals.md in that repository](https://github.com/HaikeiLabs/skills/blob/main/docs/evals.md) is the full write-up of the skill system, the model profiles and the gate. [HaikeiLabs/Agentware](https://github.com/HaikeiLabs/agentware) publishes the runner, the suite format and examples. To test an agent you build, see the table-test format in the Agentware repository, or start with [Get started with Agentware](/agentware/getting-started/overview).
