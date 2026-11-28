"""Make the tutorial suite a strict ``agentware.eval-suite.v1`` file.

The tutorials' local runner reads a looser dialect of the format: case ids
use underscores and the content check is called ``contains``. Agentware's
strict loader (``python/src/evals/suite.py``) rejects both. The course shows
the strict format, so ``to_agentware_v1`` renames those two things and
nothing else, and ``validate_v1`` applies the loader's rules.
"""

from __future__ import annotations

import copy
import re
from typing import Any

SCHEMA = "agentware.eval-suite.v1"
# Both patterns are copied from Agentware's python/src/evals/suite.py.
CASE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
SUITE_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)+$")

SUITE_KEYS = {"schema", "suite", "kind", "system_prompt", "system_prompt_file", "tools", "repeats", "cases"}
CASE_KEYS = {"id", "prompt", "context", "expect"}
EXPECT_KEYS = {"tool", "args", "required_arg_keys", "forbidden_arg_keys", "forbidden_tools", "deny", "content"}
CONTENT_KEYS = {"contains_all", "contains_any", "regex", "not_contains"}


class SuiteError(ValueError):
    """The suite breaks a rule of Agentware's strict v1 loader."""


def to_agentware_v1(tutorial_suite: dict[str, Any]) -> dict[str, Any]:
    """Rename underscore case ids and ``content.contains`` to the v1 names."""
    suite = copy.deepcopy(tutorial_suite)
    for case in suite["cases"]:
        case["id"] = case["id"].replace("_", "-")
        content = case.get("expect", {}).get("content")
        if content and "contains" in content:
            content = {"contains_all": content.pop("contains"), **content}
            case["expect"]["content"] = content
    return suite


def _unknown(value: dict[str, Any], allowed: set[str], where: str) -> None:
    extra = set(value) - allowed
    if extra:
        raise SuiteError(f"{where}: unknown keys {sorted(extra)}")


def validate_v1(suite: dict[str, Any]) -> None:
    """Raise SuiteError for anything Agentware's v1 loader rejects."""
    _unknown(suite, SUITE_KEYS, "suite")
    if suite.get("schema") != SCHEMA:
        raise SuiteError(f"schema must be {SCHEMA}")
    if not SUITE_NAME_PATTERN.match(suite.get("suite", "")):
        raise SuiteError("suite must be dotted <repo>.<agent>")
    if suite.get("kind") not in ("agent", "skill"):
        raise SuiteError("kind must be agent or skill")
    if ("system_prompt" in suite) == ("system_prompt_file" in suite):
        raise SuiteError("exactly one of system_prompt or system_prompt_file is required")
    names = [tool["function"]["name"] for tool in suite["tools"]]
    if len(set(names)) != len(names):
        raise SuiteError("tool names must be unique")
    if not isinstance(suite.get("repeats", 1), int) or suite.get("repeats", 1) < 1:
        raise SuiteError("repeats must be an integer >= 1")
    cases = suite.get("cases") or []
    if not cases:
        raise SuiteError("a suite needs at least one case")
    ids = [case.get("id", "") for case in cases]
    if len(set(ids)) != len(ids):
        raise SuiteError("case ids must be unique")
    for case in cases:
        where = f"case {case.get('id')!r}"
        _unknown(case, CASE_KEYS, where)
        if not CASE_ID_PATTERN.match(case.get("id", "")):
            raise SuiteError(f"{where}: id must match {CASE_ID_PATTERN.pattern}")
        if not case.get("prompt"):
            raise SuiteError(f"{where}: prompt is required")
        expect = case.get("expect")
        if not isinstance(expect, dict):
            raise SuiteError(f"{where}: expect is required")
        _unknown(expect, EXPECT_KEYS, f"{where}.expect")
        _unknown(expect.get("content", {}), CONTENT_KEYS, f"{where}.expect.content")
        tool = expect.get("tool")
        if (expect.get("args") or expect.get("required_arg_keys") or expect.get("forbidden_arg_keys")) and tool is None:
            raise SuiteError(f"{where}: args checks need expect.tool")
        if tool is not None and tool in expect.get("forbidden_tools", []):
            raise SuiteError(f"{where}: expect.tool is also forbidden")
        allowed = case.get("context", {}).get("allowed_tools")
        for name in [tool, *expect.get("forbidden_tools", []), *(allowed or [])]:
            if name is not None and name not in names:
                raise SuiteError(f"{where}: {name!r} is not a suite tool")
        if expect.get("deny"):
            if allowed is None:
                raise SuiteError(f"{where}: expect.deny needs context.allowed_tools")
            if tool in allowed:
                raise SuiteError(f"{where}: expect.deny but expect.tool is allowed")
        for pattern in expect.get("content", {}).get("regex", []):
            try:
                re.compile(pattern)
            except re.error as exc:
                raise SuiteError(f"{where}: invalid regex {pattern!r}: {exc}") from exc
