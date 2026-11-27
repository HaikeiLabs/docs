# Evals course data

This folder generates the recorded data for the agent evals course at
`/evals/course/`. Every file in `content/evals/course/data/` comes from here.
Don't edit those files by hand: change the generator, then run the command
below.

## Regenerate the data

The generator runs the agent-evals solution project from a
[HaikeiLabs/tutorials](https://github.com/HaikeiLabs/tutorials) checkout
(`projects/agent-evals/chapters/ch06-ci-cd/solution`). It looks for the
checkout in `$HAIKEI_TUTORIALS`, then next to this repository. From the
repository root, with [uv](https://docs.astral.sh/uv/) installed:

```sh
uv run --project tools/evals-course-data python tools/evals-course-data/generate.py
```

Add `--check` to report stale files without writing. Then run
`npm run check:course -- content/evals/course` and `npm run build`.

## What makes each file

| Data file | Lesson | Made by |
| --- | --- | --- |
| `support-agent-suite.json` | 2, 8 | The tutorial suite `evals/support-agent.json`, made strict `agentware.eval-suite.v1`: case ids use `-` instead of `_`, and `content.contains` becomes `contains_all`. Nothing else changes. |
| `compare-graders.json` | 3 | The tutorial runner (`runner.run_case`) on three cases, with the correct and wrong scripted models from `tests/test_runner.py` |
| `compare-skill-runs.json` | 4 | The skill runner on the refund-policy skill, with the follow and ignore scripts from `tests/test_skill_runner.py` |
| `compare-profiles.json` | 5 | `matrix.run_matrix` with the four profiles from `tests/test_matrix.py`, 3 repeats |
| `compare-reports.json` | 6 | `results/example-main.json`, `results/example-pr.json` and `report.compare` |
| `manifest.json` | — | One entry per file: the generator version and a sha256 over its inputs. `agentware` is null: none of this data comes from the Agentware SDK. |

The tutorial runner names the `contains_all` check `contains`, so the
generator renames that one word in the grader's failure messages too.

## Tests

```sh
uv run --project tools/evals-course-data --directory tools/evals-course-data pytest -q
```

One test also loads the suite with Agentware's own strict loader. It runs
when `AGENTWARE_SRC` points at an Agentware checkout's `python/src` (it needs
`pydantic`, for example `uv run --with pydantic pytest -q`).
