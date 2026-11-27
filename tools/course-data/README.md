# Course data

This folder generates the widget data for the Agentware course at
`/agentware/course/`. Every file in `content/agentware/course/data/` comes from
here, including `manifest.json`. Don't edit those files by hand: change a
generator or a source file, then run one of the commands below.

## Regenerate the data

From the repository root, with [uv](https://docs.astral.sh/uv/) installed:

```sh
uv run --project tools/course-data python tools/course-data/generate.py
```

The command installs the pinned Agentware release in `tools/course-data/.venv`,
rewrites every JSON file in `content/agentware/course/data/`, and updates
`data/manifest.json`. Then run `npm run check:course` and `npm run build` to
check the result.

To regenerate less, add a flag (after `generate.py`):

| Flag | What it writes |
| --- | --- |
| `--lesson <id>` | Only the data that lesson reads, for example `--lesson gaps`. The list comes from `node scripts/course-validate.mjs content/agentware/course --data-for <id>`. |
| `--only <stems>` | Only these files, as comma-separated stems: `--only gaps,compare-build-time`. |
| `--changed` | Only files whose generator inputs changed since the manifest was written. |
| `--agentware <X.Y.Z>` | Runs against that Agentware release in a throwaway environment, without changing the pin. Combine it with `--lesson` or `--only` to move one lesson to a new release. |
| `--check` | Writes nothing. Exits 1 if a file is stale (its inputs changed) or differs from a fresh run (edited by hand). |

A run that writes only some files keeps the manifest entries of the others, so
lessons can describe different Agentware releases.

## When you change a lesson

Set `updated: YYYY-MM-DD` in the lesson's front matter whenever its prose, quiz,
or the data it shows changes in a way a reader would notice. A typo fix can keep
the date. `npm run check:updated` warns when a lesson or its data changed but
`updated` did not.

A lesson that shows SDK-derived data (a file whose manifest entry has a non-null
`generated_with.agentware`) also needs `agentware: X.Y.Z`, equal to that version.
The page renders "Updated <date> · Agentware <version>" from these fields, so
never write the SDK version in lesson prose.

## The manifest

`data/manifest.json` has one entry per data file:

- `generated_with.agentware`: the installed Agentware version for files made by
  running the SDK (`runtime-trace.json`, `compare-build-time.json`, `gaps.json`),
  and `null` for the rest. `logs.json` and `debugger.json` are `null`: they come
  from the scripted loop in `agent_loop_mock.py`, which uses no Agentware code.
- `generated_with.generator`: `generate.py` and the version in `pyproject.toml`.
- `source_sha256`: a hash over the inputs that produced the file: for each input
  path in sorted order, `path`, a NUL byte, the sha256 of its bytes and a newline,
  then the sha256 of the whole string. The inputs are listed in `OUTPUTS` at the
  top of `generate.py`; files made by running the SDK also include `uv.lock`.

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
2. Run the command above. `uv` updates `uv.lock`, which marks the SDK files as
   changed.
3. Review the diff in `content/agentware/course/data/`. When a release fixes a
   gap, delete that entry from `sources/gaps.json` and regenerate.
4. Set `agentware` and `updated` on lessons 8 to 10.

To move one lesson first, run with `--lesson <id> --agentware <X.Y.Z>` and update
that lesson's `agentware` and `updated`.

## Tests

```sh
uv run --project tools/course-data python -m unittest discover -s tools/course-data -p "test_*.py"
```

The generators set `PYTHONHASHSEED=0`, so two runs against the same release
write the same bytes.
