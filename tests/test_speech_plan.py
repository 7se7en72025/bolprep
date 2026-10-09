"""Synthetic collection-plan checks; these are not observed speech results."""

import copy
import hashlib
import json
import subprocess
import sys
import unittest
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVALS = ROOT / "evals"
sys.path.insert(0, str(ROOT))
from evals import prepare_speech_eval as planner  # noqa: E402


class SpeechCollectionPlanTests(unittest.TestCase):
    def setUp(self):
        self.prefix = "local-speech-test-" + uuid.uuid4().hex
        self.config_path = EVALS / f"{self.prefix}-config.json"
        self.plan_path = EVALS / f"{self.prefix}-plan.json"
        self.stt_path = EVALS / f"{self.prefix}-stt.json"
        self.tts_path = EVALS / f"{self.prefix}-tts.json"
        setting = {language: "synthetic fixture settings" for language in planner.LANGUAGES}
        config = {
            "schema_version": 1, "repeats_per_prompt": 2,
            "listener_ids": ["listener-1", "listener-2"],
            "stt_configurations": [
                {"id": "stt-a", "environment": "synthetic test environment",
                 "settings_by_language": setting},
                {"id": "stt-b", "environment": "synthetic test environment",
                 "settings_by_language": setting},
            ],
            "tts_configurations": [
                {"id": "tts-a", "environment": "synthetic test environment",
                 "settings_by_language": setting},
                {"id": "tts-b", "environment": "synthetic test environment",
                 "settings_by_language": setting},
            ],
        }
        self.config_path.write_text(json.dumps(config), encoding="utf-8")

    def tearDown(self):
        for path in EVALS.glob(self.prefix + "*.json"):
            path.unlink()

    def command(self, *arguments):
        return subprocess.run(
            [sys.executable, str(EVALS / "prepare_speech_eval.py"), *map(str, arguments)],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
        )

    def prepare(self):
        result = self.command("prepare", "--config", self.config_path,
                              "--output", self.plan_path)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(self.plan_path.read_text(encoding="utf-8"))

    def save_plan(self, plan):
        self.plan_path.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")

    def export(self, modality, output, split):
        return self.command(f"export-{modality}", "--config", self.config_path,
                            "--plan", self.plan_path, "--split", split, "--output", output)

    def test_manifest_keeps_language_variants_in_one_split(self):
        _, manifest = planner.read_json(planner.MANIFEST_PATH)
        prompts = planner.validate_manifest(manifest)
        self.assertEqual(len(prompts), 30)
        self.assertEqual(sum(row["split"] == "development" for row in prompts), 18)
        changed = copy.deepcopy(manifest)
        changed["prompts"][1]["split"] = "heldout"
        with self.assertRaisesRegex(ValueError, "cannot cross splits"):
            planner.validate_manifest(changed)

    def test_preparation_is_unobserved_and_never_overwrites(self):
        plan = self.prepare()
        self.assertEqual(len(plan["stt_trials"]), 120)
        self.assertEqual(len(plan["tts_trials"]), 120)
        self.assertTrue(all(row["observation_status"] == "unobserved"
                            for row in plan["stt_trials"] + plan["tts_trials"]))
        original = self.plan_path.read_bytes()
        again = self.command("prepare", "--config", self.config_path,
                             "--output", self.plan_path)
        self.assertEqual(again.returncode, 2)
        self.assertEqual(self.plan_path.read_bytes(), original)

    def test_unobserved_selected_rows_block_export(self):
        self.prepare()
        result = self.export("stt", self.stt_path, "development")
        self.assertEqual(result.returncode, 2)
        self.assertIn("72 selected STT trials are unobserved", result.stderr)
        self.assertFalse(self.stt_path.exists())
        self.assertFalse(self.stt_path.with_name(self.stt_path.stem + "-provenance.json").exists())

    def test_stt_export_preserves_split_pairing_and_provenance(self):
        plan = self.prepare()
        for row in plan["stt_trials"]:
            if row["split"] == "development":
                row["observation_status"] = "completed"
                row["transcript"] = row["reference"]  # synthetic scorer fixture only
        failed = next(row for row in plan["stt_trials"] if row["split"] == "development")
        failed.update(observation_status="failed", transcript=None, failure_reason="no-speech")
        self.save_plan(plan)
        result = self.export("stt", self.stt_path, "development")
        self.assertEqual(result.returncode, 0, result.stderr)
        scored_input = json.loads(self.stt_path.read_text(encoding="utf-8"))
        self.assertEqual(len(scored_input), 72)
        self.assertEqual(sum(row["transcript"] is None for row in scored_input), 1)
        sidecar = json.loads(self.stt_path.with_name(self.stt_path.stem + "-provenance.json")
                             .read_text(encoding="utf-8"))
        self.assertEqual(sidecar["split"], "development")
        self.assertEqual((sidecar["completed_count"], sidecar["failed_count"]), (71, 1))
        self.assertEqual(sidecar["scenario_count"], 6)
        self.assertEqual(sidecar["scorer_input_sha256"], hashlib.sha256(self.stt_path.read_bytes()).hexdigest())
        scorer = subprocess.run(["node", "evals/score_stt.js", str(self.stt_path)],
                                cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(scorer.returncode, 0, scorer.stderr)
        self.assertEqual(len(json.loads(scorer.stdout)), 6)
        original = self.stt_path.read_bytes()
        self.assertEqual(self.export("stt", self.stt_path, "development").returncode, 2)
        self.assertEqual(self.stt_path.read_bytes(), original)
        self.stt_path.unlink()
        self.assertEqual(self.export("stt", self.stt_path, "development").returncode, 2)
        self.assertFalse(self.stt_path.exists())  # Existing sidecar also blocks a partial export.

    def test_tts_export_keeps_failures_separate_from_ratings(self):
        plan = self.prepare()
        for row in plan["tts_trials"]:
            if row["split"] == "heldout":
                row["observation_status"] = "completed"
                row["ratings"] = {"pronunciation": 4, "intelligibility": 4, "naturalness": 4}
        failed = next(row for row in plan["tts_trials"] if row["split"] == "heldout")
        failed.update(observation_status="failed", ratings=None, failure_reason="no-audio")
        self.save_plan(plan)
        result = self.export("tts", self.tts_path, "heldout")
        self.assertEqual(result.returncode, 0, result.stderr)
        scored_input = json.loads(self.tts_path.read_text(encoding="utf-8"))
        self.assertEqual(len(scored_input["trials"]), 48)
        self.assertEqual(sum(row["outcome"] == "failed" for row in scored_input["trials"]), 1)
        scorer = subprocess.run(["node", "evals/score_tts.js", str(self.tts_path)],
                                cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(scorer.returncode, 0, scorer.stderr)
        pairing = next(row for row in json.loads(scorer.stdout)["pairing_by_language"]
                       if row["language"] == "English")
        self.assertTrue(pairing["all_prompt_listener_sets_match"])
        self.assertFalse(pairing["completed_prompt_listener_sets_match"])

    def test_changed_config_or_fixed_trial_metadata_is_rejected(self):
        plan = self.prepare()
        config = json.loads(self.config_path.read_text(encoding="utf-8"))
        config["stt_configurations"][0]["environment"] = "changed environment"
        self.config_path.write_text(json.dumps(config), encoding="utf-8")
        result = self.export("stt", self.stt_path, "development")
        self.assertEqual(result.returncode, 2)
        self.assertIn("changed", result.stderr)
        self.assertFalse(self.stt_path.exists())

        # Restore the original configuration hash, then alter a fixed plan field.
        self.config_path.write_text(json.dumps({
            **config, "stt_configurations": [
                {**config["stt_configurations"][0], "environment": "synthetic test environment"},
                config["stt_configurations"][1],
            ],
        }), encoding="utf-8")
        plan["stt_trials"][0]["prompt_id"] = "different-id"
        self.save_plan(plan)
        result = self.export("stt", self.stt_path, "development")
        self.assertEqual(result.returncode, 2)
        self.assertIn("planned trial", result.stderr.lower())

    def test_invalid_collected_result_is_rejected(self):
        plan = self.prepare()
        plan["stt_trials"][0]["observation_status"] = "completed"
        self.save_plan(plan)
        result = self.export("stt", self.stt_path, "development")
        self.assertEqual(result.returncode, 2)
        self.assertIn("1-6000 character transcript", result.stderr)
        self.assertFalse(self.stt_path.exists())

    def test_oversized_result_and_output_are_rejected_without_writing(self):
        plan = self.prepare()
        plan["stt_trials"][0].update(observation_status="completed", transcript="x" * 6001)
        self.save_plan(plan)
        result = self.export("stt", self.stt_path, "development")
        self.assertEqual(result.returncode, 2)
        self.assertIn("1-6000 character transcript", result.stderr)
        self.assertFalse(self.stt_path.exists())
        with self.assertRaisesRegex(ValueError, "exceeds 4 MiB"):
            planner.write_new([(self.stt_path, b"x" * (planner.MAX_FILE_BYTES + 1))])
        self.assertFalse(self.stt_path.exists())


if __name__ == "__main__":
    unittest.main()
