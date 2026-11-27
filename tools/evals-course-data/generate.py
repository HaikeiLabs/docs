"""Write every data file for the agent evals course.

Run from the repository root:

    uv run --project tools/evals-course-data python tools/evals-course-data/generate.py

It reads the agent-evals solution project from a haikei-tutorials checkout
($HAIKEI_TUTORIALS, or a sibling checkout) and rewrites
content/evals/course/data/*.json. Pass --check to compare instead of write.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from evals_course_data import build  # noqa: E402

OUT = build.REPO / "content" / "evals" / "course" / "data"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--solution", type=Path, default=build.default_solution(), help="agent-evals ch06 solution directory")
    parser.add_argument("--check", action="store_true", help="exit 1 if a data file is missing or stale")
    args = parser.parse_args()
    files = build.build_all(args.solution)
    stale = [name for name, value in files.items() if not (OUT / name).is_file() or (OUT / name).read_text(encoding="utf-8") != build.dump(value)]
    if args.check:
        for name in stale:
            print(f"stale: content/evals/course/data/{name}")
        return 1 if stale else 0
    OUT.mkdir(parents=True, exist_ok=True)
    for name, value in files.items():
        (OUT / name).write_text(build.dump(value), encoding="utf-8")
        print(f"wrote content/evals/course/data/{name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
