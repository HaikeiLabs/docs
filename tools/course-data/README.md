# Course data

This folder generates the widget data for the Agentware course at
`/agentware/course/`. Every file in `content/agentware/course/data/` comes from
here. Don't edit those files by hand: change a generator or a source file, then
run the command below.

## Regenerate the data

From the repository root, with [uv](https://docs.astral.sh/uv/) installed:

```sh
uv run --project tools/course-data python tools/course-data/generate.py
```

The command installs the pinned Agentware release in `tools/course-data/.venv`
and rewrites every JSON file in `content/agentware/course/data/`. Then run
`npm run check:course` and `npm run build` to check the result.

## What makes each file

| Data file | Lesson | Made by |
| --- | --- | --- |
| `logs.json` | 1, 7 | `agent_loop_mock.py`: one scripted agent loop in three wire formats |
| `debugger.json` | 7 | `sources/debugger.json` (loop code and help text) plus the render and parse functions from `agent_loop_mock.py` |
| `runtime-trace.json` | 9 | `runtime_trace.py`: a real Agentware run with a scripted model, plus the loop in `sources/runtime_loop.py` |
| `compare-build-time.json` | 8 | `aw_templates.py`: real Agentware formatter output, for the models in `sources/build-time.json` |
| `gaps.json` | 10 | `sources/gaps.json` plus output from `aw_templates.py`: fields written as `{"capture": "<key>"}` in the source, and `repro.entries`: one REPL reproduction per open gap, run against the installed SDK (an entry is dropped when its gap is deleted from the source); `repro.sdk_version` is the installed Agentware version |
| `compare-*.json`, `api-*.json` (others) | 3 to 6 | copied from `sources/` |

The file shapes are defined by `schemas/course/*.schema.json`.

## Updating to a new Agentware release

`pyproject.toml` pins `haikeilabs-agentware`. Lessons 8 to 10 show real output
from that release, so when a new release ships:

1. Change the version in `pyproject.toml`.
2. Run the command above. `uv` updates `uv.lock`.
3. Review the diff in `content/agentware/course/data/`. When a release fixes a
   gap, delete that entry from `sources/gaps.json` and regenerate.

The generators set `PYTHONHASHSEED=0`, so two runs against the same release
write the same bytes.
