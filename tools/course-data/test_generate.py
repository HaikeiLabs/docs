"""Unit tests for generate.py's manifest, selection and check logic.

Run from the repository root:

    uv run --project tools/course-data python -m unittest discover -s tools/course-data -p "test_*.py"

The producers are faked, so these tests never run the Agentware SDK.
"""
from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import generate as g


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Repo:
    """A throwaway repo root with a few generator inputs and a data folder."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.data = self.root / "content/agentware/course/data"
        self.data.mkdir(parents=True)
        self.write("tools/course-data/generate.py", "gen v1")
        self.write("tools/course-data/sources/a.json", '{"a": 1}')
        self.write("tools/course-data/sdk_script.py", "sdk v1")
        self.write("tools/course-data/uv.lock", "lock v1")
        # Two files: "a" is copied from a source, "b" is produced by running the SDK.
        self.table = {
            "a.json": g.Output(producer="verbatim", inputs=["tools/course-data/generate.py", "tools/course-data/sources/a.json"], sdk=False),
            "b.json": g.Output(producer="sdk", inputs=["tools/course-data/generate.py", "tools/course-data/sdk_script.py", "tools/course-data/uv.lock"], sdk=True),
        }

    def write(self, rel: str, text: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def close(self) -> None:
        self._tmp.cleanup()


class SourceHashTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Repo()
        self.addCleanup(self.repo.close)

    def test_matches_the_contract_recipe(self) -> None:
        paths = ["tools/course-data/sources/a.json", "tools/course-data/generate.py"]
        expected_text = "".join(
            f"{p}\0{sha((self.repo.root / p).read_bytes())}\n" for p in sorted(paths)
        )
        self.assertEqual(g.source_sha256(paths, self.repo.root), sha(expected_text.encode()))

    def test_does_not_depend_on_input_order(self) -> None:
        paths = ["tools/course-data/sources/a.json", "tools/course-data/generate.py"]
        self.assertEqual(g.source_sha256(paths, self.repo.root), g.source_sha256(list(reversed(paths)), self.repo.root))

    def test_changes_when_an_input_changes(self) -> None:
        paths = ["tools/course-data/sources/a.json"]
        before = g.source_sha256(paths, self.repo.root)
        self.repo.write("tools/course-data/sources/a.json", '{"a": 2}')
        self.assertNotEqual(before, g.source_sha256(paths, self.repo.root))


class ManifestTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Repo()
        self.addCleanup(self.repo.close)

    def test_entry_marks_sdk_files_with_the_installed_version_and_others_with_null(self) -> None:
        manifest = g.update_manifest({"files": {}}, ["a.json", "b.json"], self.repo.table, self.repo.root, "0.18.1", "generate.py 0.1.0")
        self.assertEqual(manifest["files"]["a.json"]["generated_with"], {"agentware": None, "generator": "generate.py 0.1.0"})
        self.assertEqual(manifest["files"]["b.json"]["generated_with"], {"agentware": "0.18.1", "generator": "generate.py 0.1.0"})
        self.assertEqual(manifest["files"]["b.json"]["source_sha256"], g.source_sha256(self.repo.table["b.json"].inputs, self.repo.root))

    def test_keeps_entries_for_files_the_run_did_not_write(self) -> None:
        old = {"files": {"b.json": {"generated_with": {"agentware": "0.18.0", "generator": "generate.py 0.0.0"}, "source_sha256": "0" * 64}}}
        manifest = g.update_manifest(old, ["a.json"], self.repo.table, self.repo.root, "0.18.1", "generate.py 0.1.0")
        self.assertEqual(manifest["files"]["b.json"], old["files"]["b.json"])
        self.assertIn("a.json", manifest["files"])

    def test_keys_are_sorted_so_the_file_is_stable(self) -> None:
        manifest = g.update_manifest({"files": {}}, ["b.json", "a.json"], self.repo.table, self.repo.root, "0.18.1", "generate.py 0.1.0")
        self.assertEqual(list(manifest["files"]), ["a.json", "b.json"])


class SelectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Repo()
        self.addCleanup(self.repo.close)

    def test_no_flag_selects_every_file(self) -> None:
        self.assertEqual(g.select_outputs(self.repo.table, {"files": {}}, self.repo.root), {"a.json", "b.json"})

    def test_only_takes_comma_separated_stems(self) -> None:
        self.assertEqual(g.select_outputs(self.repo.table, {"files": {}}, self.repo.root, only="b"), {"b.json"})

    def test_only_rejects_an_unknown_stem(self) -> None:
        with self.assertRaises(SystemExit):
            g.select_outputs(self.repo.table, {"files": {}}, self.repo.root, only="nope")

    def test_lesson_uses_the_stems_the_validator_reports(self) -> None:
        seen = []

        def data_for(lesson: str) -> list[str]:
            seen.append(lesson)
            return ["b"]

        self.assertEqual(g.select_outputs(self.repo.table, {"files": {}}, self.repo.root, lesson="gaps", data_for=data_for), {"b.json"})
        self.assertEqual(seen, ["gaps"])

    def test_lesson_without_generated_data_selects_nothing(self) -> None:
        self.assertEqual(g.select_outputs(self.repo.table, {"files": {}}, self.repo.root, lesson="schema", data_for=lambda _: []), set())

    def test_changed_selects_files_whose_inputs_moved_or_that_have_no_entry(self) -> None:
        manifest = g.update_manifest({"files": {}}, ["a.json", "b.json"], self.repo.table, self.repo.root, "0.18.1", "generate.py 0.1.0")
        self.assertEqual(g.select_outputs(self.repo.table, manifest, self.repo.root, changed=True), set())
        self.repo.write("tools/course-data/uv.lock", "lock v2")
        self.assertEqual(g.select_outputs(self.repo.table, manifest, self.repo.root, changed=True), {"b.json"})
        del manifest["files"]["a.json"]
        self.assertEqual(g.select_outputs(self.repo.table, manifest, self.repo.root, changed=True), {"a.json", "b.json"})


class CheckTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Repo()
        self.addCleanup(self.repo.close)
        self.produced = {"a.json": '{"a": 1}\n', "b.json": '{"b": 1}\n'}
        for name, text in self.produced.items():
            (self.repo.data / name).write_text(text, encoding="utf-8")
        self.manifest = g.update_manifest({"files": {}}, list(self.produced), self.repo.table, self.repo.root, "0.18.1", "generate.py 0.1.0")

    def check(self, installed: str = "0.18.1") -> list[str]:
        return g.check(self.repo.table, self.manifest, self.repo.root, self.repo.data, self.produced, installed)

    def test_clean_data_passes(self) -> None:
        self.assertEqual(self.check(), [])

    def test_reports_a_hand_edited_file(self) -> None:
        (self.repo.data / "a.json").write_text('{"a": 99}\n', encoding="utf-8")
        problems = self.check()
        self.assertEqual(len(problems), 1)
        self.assertIn("a.json", problems[0])
        self.assertIn("hand", problems[0])

    def test_reports_a_stale_file(self) -> None:
        self.repo.write("tools/course-data/sdk_script.py", "sdk v2")
        problems = self.check()
        self.assertEqual(len(problems), 1)
        self.assertIn("b.json", problems[0])
        self.assertIn("stale", problems[0])

    def test_reports_a_missing_entry(self) -> None:
        del self.manifest["files"]["b.json"]
        self.assertTrue(any("b.json" in p and "manifest" in p for p in self.check()))

    def test_skips_the_byte_comparison_for_sdk_files_from_another_version(self) -> None:
        (self.repo.data / "b.json").write_text('{"b": "made with 0.19.0"}\n', encoding="utf-8")
        self.manifest["files"]["b.json"]["generated_with"]["agentware"] = "0.19.0"
        self.assertEqual(self.check(installed="0.18.1"), [])


class AgentwareFlagTest(unittest.TestCase):
    def test_reruns_under_an_isolated_uv_environment_without_the_flag(self) -> None:
        cmd = g.isolated_command("0.19.0", ["--lesson", "gaps", "--agentware", "0.19.0"])
        self.assertEqual(cmd[:6], ["uv", "run", "--isolated", "--no-project", "--with", "haikeilabs-agentware==0.19.0"])
        self.assertNotIn("--agentware", cmd)
        self.assertEqual(cmd[-2:], ["--lesson", "gaps"])

    def test_rejects_a_version_that_is_not_x_y_z(self) -> None:
        with self.assertRaises(SystemExit):
            g.isolated_command("0.19", [])


class TableTest(unittest.TestCase):
    def test_every_data_file_has_inputs_that_exist(self) -> None:
        for name, output in g.OUTPUTS.items():
            for rel in output.inputs:
                self.assertTrue((g.ROOT / rel).is_file(), f"{name}: input {rel} is missing")

    def test_sdk_files_hash_the_lock_file_and_others_do_not(self) -> None:
        for name, output in g.OUTPUTS.items():
            self.assertEqual("tools/course-data/uv.lock" in output.inputs, output.sdk, name)

    def test_only_files_produced_by_running_the_sdk_are_sdk_derived(self) -> None:
        sdk = {name for name, output in g.OUTPUTS.items() if output.sdk}
        self.assertEqual(sdk, {"compare-build-time.json", "gaps.json", "runtime-trace.json"})


if __name__ == "__main__":
    unittest.main()
