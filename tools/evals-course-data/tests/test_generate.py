"""Tests for the evals course data generator.

The generator reads the agent-evals solution project in a tutorials checkout
and writes content/evals/course/data/. These tests need that checkout: set
HAIKEI_TUTORIALS, or keep haikei-tutorials next to this repository.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

from evals_course_data import build
from evals_course_data.suite import CASE_ID_PATTERN, SuiteError, to_agentware_v1, validate_v1

REPO = Path(__file__).resolve().parents[3]
DATA = REPO / "content" / "evals" / "course" / "data"


@pytest.fixture(scope="module")
def solution() -> Path:
    path = build.default_solution()
    if not path.is_dir():
        pytest.skip(f"tutorials solution not found at {path}; set HAIKEI_TUTORIALS")
    return path


@pytest.fixture(scope="module")
def files(solution: Path) -> dict[str, object]:
    return build.build_all(solution)


def test_suite_is_strict_agentware_v1(files: dict[str, object]) -> None:
    suite = files["support-agent-suite.json"]
    validate_v1(suite)
    assert all(CASE_ID_PATTERN.match(case["id"]) for case in suite["cases"])
    assert suite["cases"][1]["id"] == "status-without-order-id"
    assert suite["cases"][0]["expect"]["content"] == {"contains_all": ["ORD-123"]}


def test_tutorial_suite_is_not_v1_until_converted(solution: Path) -> None:
    raw = json.loads((solution / "evals" / "support-agent.json").read_text(encoding="utf-8"))
    with pytest.raises(SuiteError):
        validate_v1(raw)
    validate_v1(to_agentware_v1(raw))


def test_validator_rejects_loader_errors() -> None:
    base = {
        "schema": "agentware.eval-suite.v1", "suite": "a.b", "kind": "agent", "system_prompt": "x",
        "tools": [{"type": "function", "function": {"name": "t", "parameters": {}}}],
        "cases": [{"id": "c", "prompt": "p", "expect": {"tool": "t"}}],
    }
    validate_v1(base)
    bad = [
        {**base, "extra": 1},
        {**base, "cases": [{"id": "C_1", "prompt": "p", "expect": {}}]},
        {**base, "cases": [{"id": "c", "prompt": "p", "expect": {"args": {"a": 1}}}]},
        {**base, "cases": [{"id": "c", "prompt": "p", "expect": {"tool": "t", "forbidden_tools": ["t"]}}]},
        {**base, "cases": [{"id": "c", "prompt": "p", "expect": {"content": {"contains": ["x"]}}}]},
        {**base, "cases": [{"id": "c", "prompt": "p", "expect": {"deny": True}}]},
    ]
    for suite in bad:
        with pytest.raises(SuiteError):
            validate_v1(suite)


@pytest.mark.skipif(not os.environ.get("AGENTWARE_SRC"), reason="set AGENTWARE_SRC to an Agentware python/src checkout")
def test_suite_loads_with_the_agentware_loader(tmp_path: Path, files: dict[str, object]) -> None:
    sys.path.insert(0, os.environ["AGENTWARE_SRC"])
    from evals.suite import load_suite  # type: ignore[import-not-found]

    path = tmp_path / "suite.json"
    path.write_text(json.dumps(files["support-agent-suite.json"]), encoding="utf-8")
    assert len(load_suite(path).cases) == 8


def test_graders_show_one_failed_case_with_two_failures(files: dict[str, object]) -> None:
    tab = next(t for t in files["compare-graders.json"]["tabs"] if t["id"] == "status-without-order-id")
    result = json.loads(tab["panes"][-1]["src"])
    assert result["passed"] is False
    assert len(result["failures"]) == 2
    assert any("forbidden_tools" in f for f in result["failures"])


def test_skill_runs_compare_follow_and_ignore(files: dict[str, object]) -> None:
    tabs = {t["id"]: t for t in files["compare-skill-runs.json"]["tabs"]}
    assert "case-2" in tabs
    follow, ignore = (json.loads(p["src"]) for p in tabs["case-2"]["panes"][-2:])
    assert follow["passed"] is True and ignore["passed"] is False


def test_reports_label_the_refund_regression(files: dict[str, object]) -> None:
    tabs = {t["id"]: t for t in files["compare-reports.json"]["tabs"]}
    diff = json.loads(tabs["compare"]["panes"][-1]["src"])
    assert diff["regressions"] == ["refund-policy"]
    assert diff["noise"] == ["edge-case"]


def test_manifest_lists_every_file_with_no_sdk(files: dict[str, object]) -> None:
    manifest = files["manifest.json"]
    assert set(manifest["files"]) == {name for name in files if name != "manifest.json"}
    assert all(entry["generated_with"]["agentware"] is None for entry in manifest["files"].values())


def test_checked_in_data_is_current(files: dict[str, object]) -> None:
    on_disk = {p.name for p in DATA.glob("*.json")}
    assert on_disk == set(files), "regenerate content/evals/course/data"
    for name, value in files.items():
        assert (DATA / name).read_text(encoding="utf-8") == build.dump(value), f"{name} is stale; regenerate"


def test_profiles_show_weak_below_threshold_and_unreachable_blocked(files: dict[str, object]) -> None:
    tabs = {t["id"]: json.loads(t["panes"][0]["src"]) for t in files["compare-profiles.json"]["tabs"]}
    assert tabs["weak"]["passed"] is False and round(tabs["weak"]["pass_rate"], 3) == 0.667
    assert [c["id"] for c in tabs["flaky"]["cases"] if c["flaky"]] == ["faq"] and tabs["flaky"]["passed"] is True
    assert tabs["unreachable"]["status"] == "blocked" and tabs["unreachable"]["pass_rate"] is None
