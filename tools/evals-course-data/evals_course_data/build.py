"""Build every data file for the agent evals course.

Each builder runs code from the agent-evals solution project in a tutorials
checkout (chapter 6, the last chapter, which carries everything from 2 to 5):
the runner, the skill runner and the report helpers, with the scripted
models from that chapter's own tests. Nothing here invents a result.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from .suite import to_agentware_v1, validate_v1

GENERATOR = "evals-course-data 0.1.0"
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SOLUTION = Path("projects/agent-evals/chapters/ch06-ci-cd/solution")


def default_solution() -> Path:
    """The solution project: $HAIKEI_TUTORIALS, else a sibling checkout."""
    if os.environ.get("HAIKEI_TUTORIALS"):
        return Path(os.environ["HAIKEI_TUTORIALS"]) / SOLUTION
    for base in (REPO.parent, REPO.parent.parent):
        if (base / "haikei-tutorials" / SOLUTION).is_dir():
            return base / "haikei-tutorials" / SOLUTION
    return REPO.parent / "haikei-tutorials" / SOLUTION


def dump(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def _json(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False)


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


class Solution:
    """The tutorial solution project, imported from its checkout."""

    def __init__(self, root: Path) -> None:
        self.root = root
        if str(root / "src") not in sys.path:
            sys.path.insert(0, str(root / "src"))
        import agent_evals.matrix as matrix
        import agent_evals.report as report
        import agent_evals.runner as runner
        import agent_evals.scripted as scripted
        import agent_evals.skill_runner as skill_runner

        self.runner, self.scripted, self.skill_runner, self.report = runner, scripted, skill_runner, report
        self.matrix = matrix
        self.runner_tests = self.load_test("test_runner")
        self.skill_tests = self.load_test("test_skill_runner")

    def load_test(self, name: str) -> ModuleType:
        spec = importlib.util.spec_from_file_location(f"evals_course_{name}", self.root / "tests" / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def sha256(self, inputs: list[str]) -> str:
        """A hash over the solution files and this package's code."""
        digest = hashlib.sha256()
        files = [self.root / rel for rel in inputs] + sorted(HERE.glob("*.py"))
        for path in files:
            digest.update(path.name.encode() + b"\0" + path.read_bytes() + b"\0")
        return digest.hexdigest()


# --- Lessons 2 and 8: the example suite ------------------------------------

SUITE_INPUTS = ["evals/support-agent.json"]


def build_suite(sol: Solution) -> dict[str, Any]:
    suite = to_agentware_v1(_read_json(sol.root / "evals" / "support-agent.json"))
    validate_v1(suite)
    return suite


# --- Lesson 3: what the grader reports -------------------------------------

GRADER_INPUTS = SUITE_INPUTS + [
    "src/agent_evals/agent.py", "src/agent_evals/runner.py", "src/agent_evals/scripted.py", "tests/test_runner.py",
]
GRADER_TABS = [
    ("status-with-order-id", "Right lookup", "CORRECT_SCRIPTS",
     "The model looked up the order the customer named. Every check under `expect` passes, so `failures` is empty and the case passes."),
    ("status-without-order-id", "Guessed id", "WRONG_SCRIPTS",
     "No order id in the question, yet the model looked up ORD-000. Two checks fail: the forbidden lookup and the missing words \"order id\". It still counts as **one** failed case."),
    ("faq-text-mentions-refund", "Acted on FAQ", "WRONG_SCRIPTS",
     "The customer quoted the FAQ and the model refunded order 42. Only `forbidden_tools` is set for this case, and it catches the refund."),
]


def _v1_failure(message: str) -> str:
    # The tutorial runner names the v1 contains_all check "contains".
    return message.replace("content.contains:", "content.contains_all:", 1)


def build_graders(sol: Solution, suite: dict[str, Any]) -> dict[str, Any]:
    tutorial = sol.runner.load_suite(sol.root / "evals" / "support-agent.json")
    tabs = []
    for case_id, name, script, note in GRADER_TABS:
        case = next(c for c in suite["cases"] if c["id"] == case_id)
        raw = next(c for c in tutorial["cases"] if c["id"].replace("_", "-") == case_id)
        result = sol.runner.run_case(raw, sol.scripted.ScriptedModel(getattr(sol.runner_tests, script)))
        graded = {"id": case_id, "passed": result["passed"], "failures": [_v1_failure(f) for f in result["failures"]]}
        tabs.append({
            "id": case_id, "name": name, "sub": "", "note": note, "src": "agent-evals ch02 runner",
            "panes": [
                {"label": "The case", "file": "support-agent.json", "lang": "json", "src": _json(case)},
                {"label": "What the model did", "file": "decision", "lang": "json", "src": _json(result["result"])},
                {"label": "What the grader says", "file": "result", "lang": "json", "src": _json(graded)},
            ],
        })
    return {"tabs": tabs}


# --- Lesson 4: one skill, two runs -----------------------------------------

SKILL_INPUTS = [
    "skills/refund-policy/SKILL.md", "skills/refund-policy/evals/evals.json",
    "src/agent_evals/skill_runner.py", "tests/test_skill_runner.py",
]
SKILL_TABS = [
    (2, "$350 refund",
     "Refunds over $200 need a person to approve them. The run that follows the skill says so and passes all three checks. The other run says the order is already refunded: `not_contains` finds \"refunded\", and neither `contains_any` nor the regex finds a human."),
    (3, "FAQ text",
     "The FAQ text tells the assistant to refund. The run that follows the skill refuses and passes. The other run promises the refund: `not_contains` finds \"i'll refund\", and `contains_any` finds none of its phrases."),
    (1, "No order id",
     "With no order id, the right reply asks for it. `contains_any` passes on \"order id\". The other run promises a refund at once, so both checks fail."),
]


def build_skill_runs(sol: Solution) -> dict[str, Any]:
    skill_dir = sol.root / "skills" / "refund-policy"
    skill = sol.skill_runner.load_skill(skill_dir)
    follow = sol.skill_tests.FOLLOW_SCRIPT
    ignore = sol.skill_tests.IGNORE_SCRIPT

    def run(script: dict[str, str], case: dict[str, Any]) -> dict[str, Any]:
        result = sol.skill_runner.run_case(skill["text"], case, sol.skill_tests._model(script))
        return {"reply": script[case["prompt"]], "passed": result["passed"], "failures": result["failures"]}

    tabs = []
    for case_id, name, note in SKILL_TABS:
        case = next(c for c in skill["cases"] if c["id"] == case_id)
        shown = {"id": case["id"], "prompt": case["prompt"], "checks": case["checks"]}
        tabs.append({
            "id": f"case-{case_id}", "name": name, "sub": "", "note": note, "src": "refund-policy evals.json",
            "panes": [
                {"label": "The case", "file": "evals/evals.json", "lang": "json", "src": _json(shown)},
                {"label": "Follows the skill", "file": "run A", "lang": "json", "src": _json(run(follow, case))},
                {"label": "Ignores the skill", "file": "run B", "lang": "json", "src": _json(run(ignore, case))},
            ],
        })
    totals = {}
    for label, script in (("follow", follow), ("ignore", ignore)):
        report = sol.skill_runner.run_skill(skill_dir, sol.skill_tests._model(script))
        failed = [c["id"] for c in report["cases"] if not c["passed"]]
        totals[label] = {"passed": report["passed"], "total": report["total"], "failed_cases": failed}
    tabs.append({
        "id": "totals", "name": "All six cases", "sub": "",
        "note": "Over all six cases, the run that follows the skill passes 6 of 6. The run that ignores it fails cases 1 to 4 and passes 2 of 6.",
        "src": "run_skill",
        "panes": [
            {"label": "Follows the skill", "file": "run A", "lang": "json", "src": _json(totals["follow"])},
            {"label": "Ignores the skill", "file": "run B", "lang": "json", "src": _json(totals["ignore"])},
        ],
    })
    return {"tabs": tabs}


# --- Lesson 5: one suite, four profiles ------------------------------------

PROFILE_INPUTS = ["src/agent_evals/matrix.py", "src/agent_evals/runner.py", "src/agent_evals/agent.py", "tests/test_matrix.py"]
PROFILE_TABS = [
    ("good", "Good", "Uses the order id it was given. All three cases pass on all three attempts: 9 of 9."),
    ("weak", "Weak", "Looks up ORD-000 instead of ORD-123, every time. The lookup still runs, so only the `args` check sees it. 6 of 9 is below the 80% threshold."),
    ("flaky", "Flaky", "Calls the wrong tool on the `faq` case once in three tries. The profile still clears 80% with 8 of 9, but `faq` is `flaky`: 2 of 3."),
    ("unreachable", "Unreachable", "The model server never answered. The profile is `blocked` and `pass_rate` is null: there was no answer to grade, so there is no score."),
]


def build_profiles(sol: Solution) -> dict[str, Any]:
    tests = sol.load_test("test_matrix")
    result = sol.matrix.run_matrix(tests.SUITE, tests._profiles(), 3, tests._make_model)
    tabs = []
    for name, label, note in PROFILE_TABS:
        profile = dict(result["profiles"][name])
        tabs.append({
            "id": name, "name": label, "sub": "3 cases, 3 repeats", "note": note, "src": "run_matrix",
            "panes": [{"label": f"Profile {name}", "file": "matrix result", "lang": "json", "src": _json(profile)}],
        })
    return {"tabs": tabs}


# --- Lesson 6: two saved reports -------------------------------------------

REPORT_INPUTS = ["results/example-main.json", "results/example-pr.json", "src/agent_evals/report.py"]


def _lines_with(text: str, needle: str) -> list[int]:
    return [i for i, line in enumerate(text.splitlines(), 1) if needle in line]


def build_reports(sol: Solution) -> dict[str, Any]:
    main_text = (sol.root / "results" / "example-main.json").read_text(encoding="utf-8").rstrip()
    pr_text = (sol.root / "results" / "example-pr.json").read_text(encoding="utf-8").rstrip()
    diff = sol.report.compare(json.loads(main_text), json.loads(pr_text))
    count = lambda case: f"{case['passes']}/{case['repeats']}"  # noqa: E731
    labels = {
        "cases": [{"id": d["id"], "main": count(d["baseline"]), "pr": count(d["candidate"]), "label": d["label"]} for d in diff["cases"]],
        "regressions": diff["regressions"], "fixed": diff["fixed"], "noise": diff["noise"],
    }
    return {"tabs": [
        {
            "id": "reports", "name": "The two reports", "sub": "",
            "note": "Main passes 5 of 12 attempts (41.7%). The pull request passes 6 of 12 (50%). The score went up, but `refund-policy` went from 3/3 to 0/3.",
            "src": "agent-evals ch05 results",
            "panes": [
                {"label": "Main", "file": "example-main.json", "lang": "json", "src": main_text, "hl": _lines_with(main_text, '"refund-policy"')},
                {"label": "Pull request", "file": "example-pr.json", "lang": "json", "src": pr_text, "hl": _lines_with(pr_text, '"refund-policy"')},
            ],
        },
        {
            "id": "compare", "name": "Case by case", "sub": "",
            "note": "`compare` matches case ids across the two runs. A case that passes or fails on every attempt on both sides gets a real label. A case with mixed results on either side is `noise`.",
            "src": "report.compare",
            "panes": [{"label": "Labels", "file": "compare(main, pr)", "lang": "json", "src": _json(labels)}],
        },
    ]}


def build_all(solution: Path) -> dict[str, Any]:
    """Every data file, keyed by file name, plus its manifest."""
    sol = Solution(solution)
    suite = build_suite(sol)
    built = {
        "support-agent-suite.json": (suite, SUITE_INPUTS),
        "compare-graders.json": (build_graders(sol, suite), GRADER_INPUTS),
        "compare-skill-runs.json": (build_skill_runs(sol), SKILL_INPUTS),
        "compare-profiles.json": (build_profiles(sol), PROFILE_INPUTS),
        "compare-reports.json": (build_reports(sol), REPORT_INPUTS),
    }
    files: dict[str, Any] = {name: value for name, (value, _) in built.items()}
    files["manifest.json"] = {"files": {
        name: {"generated_with": {"agentware": None, "generator": GENERATOR}, "source_sha256": sol.sha256(inputs)}
        for name, (_, inputs) in sorted(built.items())
    }}
    return files
