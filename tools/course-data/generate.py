"""Write every widget data file for the Agentware course.

Run from the repository root:

    uv run --project tools/course-data python tools/course-data/generate.py

It rewrites content/agentware/course/data/*.json from two kinds of input:

- the three generators in this folder, which run real code:
  agent_loop_mock.py (lessons 1 and 7), runtime_trace.py (lesson 9, real
  Agentware) and aw_templates.py (lessons 8 and 10, real Agentware);
- the checked-in files in sources/, for content no script produces
  (comparisons, API references, the gaps list and the code the debuggers show).

Nothing in content/agentware/course/data/ is edited by hand: change a
generator or a source file, then run this command.
"""
from __future__ import annotations

import importlib.metadata
import inspect
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
OUT = HERE.parent.parent / "content" / "agentware" / "course" / "data"

# Copied verbatim from sources/ to data/.
VERBATIM = [
    "compare-api.json",
    "compare-tags.json",
    "compare-tags-more.json",
    "compare-reasoning.json",
    "compare-reasoning-minimax.json",
    "api-chat.json",
    "api-mcp.json",
]

# The generators read Python's set and dict order, so pin the hash seed to
# make every run produce the same bytes.
ENV = {**os.environ, "PYTHONHASHSEED": "0"}


def sdk_version() -> str:
    return importlib.metadata.version("haikeilabs-agentware")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(name: str, value) -> None:
    text = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    (OUT / name).write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(HERE.parent.parent) / name}")


def run_script(name: str, cwd: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(HERE / name)], cwd=cwd, env=ENV, check=True, capture_output=True, text=True
    )
    return result.stdout


def logs_and_debugger() -> None:
    sys.path.insert(0, str(HERE))
    import agent_loop_mock as mock

    styles = ["anthropic", "gpt-oss", "qwen"]
    write_json("logs.json", {style: mock.loop(style) for style in styles})

    # The debugger's "real render code" panel shows the functions that build
    # each request and handle each reply, taken from the script itself.
    fns = {
        "anthropic": [mock.anthropic_request, mock.anthropic_step],
        "gpt-oss": [mock.harmony_render, mock.harmony_step],
        "qwen": [mock.qwen_render, mock.qwen_step],
    }
    source = read_json(SOURCES / "debugger.json")
    write_json(
        "debugger.json",
        {
            "code": source["code"],
            "help": source["help"],
            "fns": {style: [inspect.getsource(f).rstrip("\n") for f in funcs] for style, funcs in fns.items()},
        },
    )


def runtime_trace() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        run_script("runtime_trace.py", Path(tmp))
        trace = read_json(Path(tmp) / "runtime_trace.json")
    code = (SOURCES / "runtime_loop.py").read_text(encoding="utf-8").rstrip("\n")
    write_json("runtime-trace.json", {"code": code, "trace": trace})


def build_time_and_gaps(version: str) -> None:
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
                        "label": "Build time: tool definitions (text mode)",
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
    write_json("compare-build-time.json", {"tabs": tabs})

    write_json(
        "gaps.json",
        {
            "gaps": read_json(SOURCES / "gaps.json"),
            "repro": {
                "qwen_parse_official": captured["qwen_parse_official"],
                "reason_thinking_tag": captured["reason_thinking_tag"],
                "reason_think_tag": captured["reason_think_tag"],
                "minimax_family": captured["fmt_MiniMax-M2"]["family"],
                "sdk_version": version,
            },
        },
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    version = sdk_version()
    print(f"haikeilabs-agentware {version}")
    for name in VERBATIM:
        write_json(name, read_json(SOURCES / name))
    logs_and_debugger()
    runtime_trace()
    build_time_and_gaps(version)


if __name__ == "__main__":
    main()
