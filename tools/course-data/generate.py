"""Write the widget data files for the Agentware course, and their manifest.

Run from the repository root:

    uv run --project tools/course-data python tools/course-data/generate.py [flags]

With no flag it rewrites every file in content/agentware/course/data/. Flags:

    --lesson <id>        only the data that lesson reads
    --only <stems>       only these files, comma-separated stems (gaps,compare-build-time)
    --changed            only files whose generator inputs changed since the manifest
    --agentware <X.Y.Z>  run against that Agentware release instead of the pinned one
    --check              write nothing; exit 1 if a file is stale or was edited by hand

The data comes from two kinds of input:

- the three generators in this folder, which run real code:
  agent_loop_mock.py (lessons 1 and 7; a scripted loop, no Agentware), runtime_trace.py
  (lesson 9, real Agentware) and aw_templates.py (lessons 8 and 10, real Agentware);
- the checked-in files in sources/, for content no script produces
  (comparisons, API references, the gaps list and the code the debuggers show).

Every run also updates data/manifest.json: for each file it wrote, the Agentware
version it was generated with (null when the file doesn't depend on the SDK), the
generator, and source_sha256, a hash over the inputs that produced it. Entries for
files a run didn't write are kept, so lessons can describe different SDK versions.

Nothing in content/agentware/course/data/ is edited by hand: change a generator or
a source file, then run this command.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import inspect
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCES = HERE / "sources"
COURSE = ROOT / "content" / "agentware" / "course"
OUT = COURSE / "data"
MANIFEST = "manifest.json"

# The generators read Python's set and dict order, so pin the hash seed to
# make every run produce the same bytes.
ENV = {**os.environ, "PYTHONHASHSEED": "0"}

TOOLS = "tools/course-data"
GENERATE, LOCK = f"{TOOLS}/generate.py", f"{TOOLS}/uv.lock"


@dataclass(frozen=True)
class Output:
    """One data file: which producer writes it, from which inputs, and whether it runs the SDK."""

    producer: str
    inputs: list[str]
    sdk: bool


def _verbatim(name: str) -> Output:
    return Output("verbatim", [GENERATE, f"{TOOLS}/sources/{name}"], sdk=False)


# The single table of what produces each data file. source_sha256 hashes `inputs`;
# files produced by running the SDK also hash uv.lock, which pins its version.
OUTPUTS: dict[str, Output] = {
    **{
        name: _verbatim(name)
        for name in [
            "api-chat.json",
            "api-mcp.json",
            "compare-api.json",
            "compare-reasoning-minimax.json",
            "compare-reasoning.json",
            "compare-tags-more.json",
            "compare-tags.json",
        ]
    },
    "logs.json": Output("mock_loop", [GENERATE, f"{TOOLS}/agent_loop_mock.py"], sdk=False),
    "debugger.json": Output("mock_loop", [GENERATE, f"{TOOLS}/agent_loop_mock.py", f"{TOOLS}/sources/debugger.json"], sdk=False),
    "runtime-trace.json": Output(
        "runtime_trace", [GENERATE, f"{TOOLS}/runtime_trace.py", f"{TOOLS}/sources/runtime_loop.py", LOCK], sdk=True
    ),
    "compare-build-time.json": Output(
        "aw_templates", [GENERATE, f"{TOOLS}/aw_templates.py", f"{TOOLS}/sources/build-time.json", LOCK], sdk=True
    ),
    "gaps.json": Output("aw_templates", [GENERATE, f"{TOOLS}/aw_templates.py", f"{TOOLS}/sources/gaps.json", LOCK], sdk=True),
}

VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+$")


# ── hashing, manifest, selection and checks (pure; tested in test_generate.py) ──


def source_sha256(paths: Iterable[str], root: Path) -> str:
    """For each input in sorted order: path, NUL, sha256 of its bytes, newline; then sha256 of it all."""
    text = "".join(f"{p}\0{hashlib.sha256((root / p).read_bytes()).hexdigest()}\n" for p in sorted(paths))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def update_manifest(
    manifest: dict, written: Iterable[str], table: dict[str, Output], root: Path, version: str, generator: str
) -> dict:
    files = dict(manifest.get("files", {}))
    for name in written:
        output = table[name]
        files[name] = {
            "generated_with": {"agentware": version if output.sdk else None, "generator": generator},
            "source_sha256": source_sha256(output.inputs, root),
        }
    return {"files": dict(sorted(files.items()))}


def is_stale(name: str, table: dict[str, Output], manifest: dict, root: Path) -> bool:
    entry = manifest.get("files", {}).get(name)
    return entry is None or entry["source_sha256"] != source_sha256(table[name].inputs, root)


def select_outputs(
    table: dict[str, Output],
    manifest: dict,
    root: Path,
    *,
    lesson: str | None = None,
    only: str | None = None,
    changed: bool = False,
    data_for: Callable[[str], list[str]] | None = None,
) -> set[str]:
    selected = set(table)
    if lesson is not None:
        stems = (data_for or lesson_data_stems)(lesson)
        selected &= {f"{stem}.json" for stem in stems}
    if only is not None:
        wanted = {f"{stem.strip()}.json" for stem in only.split(",") if stem.strip()}
        unknown = sorted(wanted - set(table))
        if unknown:
            raise SystemExit(f"--only: no such data file: {', '.join(unknown)}")
        selected &= wanted
    if changed:
        selected = {name for name in selected if is_stale(name, table, manifest, root)}
    return selected


def check(
    table: dict[str, Output], manifest: dict, root: Path, data_dir: Path, produced: dict[str, str], installed: str
) -> list[str]:
    """Problems with the data on disk: missing entries, stale inputs, or bytes that differ from a fresh run."""
    problems = []
    for name in sorted(table):
        entry = manifest.get("files", {}).get(name)
        if entry is None:
            problems.append(f"{name}: no entry in data/{MANIFEST}; run generate.py")
            continue
        if is_stale(name, table, manifest, root):
            problems.append(f"{name}: stale, its generator inputs changed; run generate.py --changed")
            continue
        made_with = entry["generated_with"]["agentware"]
        if table[name].sdk and made_with != installed:
            continue  # generated with another SDK release on purpose; a fresh run here can't reproduce it
        on_disk = (data_dir / name).read_text(encoding="utf-8") if (data_dir / name).exists() else None
        if on_disk != produced[name]:
            problems.append(f"{name}: differs from a fresh run, so it was edited by hand or not regenerated")
    return problems


def isolated_command(version: str, argv: list[str]) -> list[str]:
    """The uv command that reruns this script against another Agentware release, leaving the pin alone."""
    if not VERSION_PATTERN.match(version):
        raise SystemExit(f"--agentware: expected X.Y.Z, got {version!r}")
    rest, skip = [], False
    for arg in argv:
        if skip:
            skip = False
        elif arg == "--agentware":
            skip = True
        elif not arg.startswith("--agentware="):
            rest.append(arg)
    return ["uv", "run", "--isolated", "--no-project", "--with", f"haikeilabs-agentware=={version}", "python", str(HERE / "generate.py"), *rest]


def lesson_data_stems(lesson: str) -> list[str]:
    """The data stems a lesson reads, from the course validator, so the widget grammar lives in one place."""
    result = subprocess.run(
        ["node", "scripts/course-validate.mjs", str(COURSE.relative_to(ROOT)), "--data-for", lesson],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def generator_label() -> str:
    match = re.search(r'^version\s*=\s*"([^"]+)"', (HERE / "pyproject.toml").read_text(encoding="utf-8"), re.M)
    return f"generate.py {match.group(1) if match else 'unknown'}"


# ── producers: each returns {file name: JSON text} ──


def sdk_version() -> str:
    return importlib.metadata.version("haikeilabs-agentware")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(value) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def run_script(name: str, cwd: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(HERE / name)], cwd=cwd, env=ENV, check=True, capture_output=True, text=True
    )
    return result.stdout


def verbatim(names: Iterable[str]) -> dict[str, str]:
    return {name: dump(read_json(SOURCES / name)) for name in names}


def mock_loop() -> dict[str, str]:
    sys.path.insert(0, str(HERE))
    import agent_loop_mock as mock

    styles = ["anthropic", "gpt-oss", "qwen"]
    logs = {style: mock.loop(style) for style in styles}

    # The debugger's "real render code" panel shows the functions that build
    # each request and handle each reply, taken from the script itself.
    fns = {
        "anthropic": [mock.anthropic_request, mock.anthropic_step],
        "gpt-oss": [mock.harmony_render, mock.harmony_step],
        "qwen": [mock.qwen_render, mock.qwen_step],
    }
    source = read_json(SOURCES / "debugger.json")
    debugger = {
        "code": source["code"],
        "help": source["help"],
        "fns": {style: [inspect.getsource(f).rstrip("\n") for f in funcs] for style, funcs in fns.items()},
    }
    return {"logs.json": dump(logs), "debugger.json": dump(debugger)}


def runtime_trace() -> dict[str, str]:
    with tempfile.TemporaryDirectory() as tmp:
        run_script("runtime_trace.py", Path(tmp))
        trace = read_json(Path(tmp) / "runtime_trace.json")
    code = (SOURCES / "runtime_loop.py").read_text(encoding="utf-8").rstrip("\n")
    return {"runtime-trace.json": dump({"code": code, "trace": trace})}


def captures(captured: dict) -> dict:
    """Gap fields that come from running the SDK, referenced in sources/gaps.json as {"capture": "<key>"}."""
    # The tools field an OpenAI-compatible request should carry, as the SDK itself
    # serializes it, with the JSON Schema shortened to keep the line readable.
    tools = json.loads(captured["schemas"])
    for tool in tools:
        tool["function"]["parameters"] = "…"
    sent = captured["tools_sent"]
    received = sent["backend_received"]
    return {
        "tools_wire": '"tools": ' + json.dumps(tools, ensure_ascii=False).replace('"…"', "…"),
        "tools_aw": (
            f"run_inference gets tool_specs {sent['tool_specs']} but calls "
            f"client.complete(messages); the backend receives tools={received!r}"
        ),
    }


def fill_captures(gap: dict, values: dict) -> dict:
    return {key: values[value["capture"]] if isinstance(value, dict) else value for key, value in gap.items()}


def aw_templates(version: str) -> dict[str, str]:
    with tempfile.TemporaryDirectory() as tmp:
        captured = json.loads(run_script("aw_templates.py", Path(tmp)))

    tabs = []
    for model in read_json(SOURCES / "build-time.json")["models"]:
        fmt = captured["fmt_" + model["model"]]
        defs = fmt["defs"]
        try:
            defs, lang = json.dumps(json.loads(defs), indent=2, ensure_ascii=False), "json"
        except json.JSONDecodeError:
            lang = "tokens"
        tabs.append(
            {
                "id": model["id"],
                "name": model["name"],
                "sub": "→ " + fmt["family"],
                "note": f'`get_formatter("{model["name"]}")` returns the **{fmt["family"]}** formatter.',
                "src": f"Captured by running haikeilabs-agentware {version}",
                "panes": [
                    {
                        "label": "Build time: tool definitions",
                        "file": "format_tool_definitions()",
                        "lang": lang,
                        "src": defs,
                    },
                    {
                        "label": "Runtime: tool result",
                        "file": "format_tool_result()",
                        "lang": "tokens",
                        "src": fmt["result"],
                    },
                ],
            }
        )

    gaps = [fill_captures(gap, captures(captured)) for gap in read_json(SOURCES / "gaps.json")]
    # One reproduction per open gap, run by aw_templates.py against the installed SDK.
    # Deleting a fixed gap from sources/gaps.json drops its reproduction too.
    open_areas = {gap["area"] for gap in gaps}
    entries = [
        {key: entry[key] for key in ("label", "code", "output")}
        for entry in captured["repro_entries"]
        if entry["gap"] in open_areas
    ]
    data = {"gaps": gaps}
    if entries:
        data["repro"] = {"sdk_version": version, "entries": entries}
    return {"compare-build-time.json": dump({"tabs": tabs}), "gaps.json": dump(data)}


def produce(names: set[str], version: str) -> dict[str, str]:
    """Run only the producers that make one of `names`; shared producers return all their files."""
    producers = {OUTPUTS[name].producer for name in names}
    produced: dict[str, str] = {}
    if "verbatim" in producers:
        produced.update(verbatim(name for name in names if OUTPUTS[name].producer == "verbatim"))
    if "mock_loop" in producers:
        produced.update(mock_loop())
    if "runtime_trace" in producers:
        produced.update(runtime_trace())
    if "aw_templates" in producers:
        produced.update(aw_templates(version))
    return produced


# ── command line ──


def read_manifest() -> dict:
    path = OUT / MANIFEST
    return read_json(path) if path.exists() else {"files": {}}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the Agentware course data and its manifest.")
    parser.add_argument("--lesson", help="only the data this lesson id reads")
    parser.add_argument("--only", help="only these data files, as comma-separated stems")
    parser.add_argument("--changed", action="store_true", help="only files whose generator inputs changed")
    parser.add_argument("--agentware", help="run against this Agentware release (X.Y.Z) instead of the pinned one")
    parser.add_argument("--check", action="store_true", help="write nothing; exit 1 if a file is stale or hand-edited")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.agentware and os.environ.get("COURSE_DATA_ISOLATED") != args.agentware:
        # Rerun in a throwaway environment with the requested release; the pin stays the default.
        return subprocess.run(isolated_command(args.agentware, argv), cwd=ROOT, env={**ENV, "COURSE_DATA_ISOLATED": args.agentware}).returncode

    version = sdk_version()
    if args.agentware and version != args.agentware:
        raise SystemExit(f"asked for haikeilabs-agentware {args.agentware}, but {version} is installed")
    print(f"haikeilabs-agentware {version}")
    manifest = read_manifest()

    if args.check:
        problems = check(OUTPUTS, manifest, ROOT, OUT, produce(set(OUTPUTS), version), version)
        for problem in problems:
            print(f"stale: {problem}")
        print("course data is up to date" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0

    selected = select_outputs(OUTPUTS, manifest, ROOT, lesson=args.lesson, only=args.only, changed=args.changed)
    if not selected:
        print("nothing to generate")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    produced = produce(selected, version)
    for name in sorted(selected):
        (OUT / name).write_text(produced[name], encoding="utf-8")
        print(f"wrote {(OUT / name).relative_to(ROOT)}")
    (OUT / MANIFEST).write_text(
        dump(update_manifest(manifest, selected, OUTPUTS, ROOT, version, generator_label())), encoding="utf-8"
    )
    print(f"wrote {(OUT / MANIFEST).relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
