"""Prepare paired speech trials and export only observed trials for local scorers."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EVALS_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = EVALS_DIR / "speech_prompts.json"
RUNNER_BYTES = Path(__file__).read_bytes()
LANGUAGES = {"English", "Hindi", "Hinglish"}
SPLITS = {"development", "heldout"}
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,31}\Z")
PRIVATE_NAME = re.compile(r"local-speech-[A-Za-z0-9_.-]+\.json\Z")
STT_FAILURES = {
    "no-speech", "permission-denied", "device-error", "network-error",
    "unsupported-language", "empty-transcript", "other",
}
TTS_FAILURES = {"no-audio", "playback-error", "unsupported-language", "other"}
RATING_FIELDS = {"pronunciation", "intelligibility", "naturalness"}
MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_TRANSCRIPT_CHARS = 6000


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def exact_keys(value: object, expected: set[str], message: str) -> None:
    require(isinstance(value, dict) and set(value) == expected, message)


def valid_id(value: object) -> bool:
    return isinstance(value, str) and ID.fullmatch(value) is not None


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON field.")
        result[key] = value
    return result


def reject_constant(_: str) -> None:
    raise ValueError("Non-finite JSON number.")


def read_json(path: Path) -> tuple[bytes, object]:
    with path.open("rb") as source:
        raw = source.read(MAX_FILE_BYTES + 1)
    require(len(raw) <= MAX_FILE_BYTES, "Input file exceeds 4 MiB.")
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicate_keys,
                       parse_constant=reject_constant)
    return raw, value


def private_path(path: Path) -> Path:
    resolved = path.resolve()
    require(resolved.parent == EVALS_DIR and PRIVATE_NAME.fullmatch(resolved.name) is not None,
            "Private files must be named evals/local-speech-*.json.")
    return resolved


def validate_manifest(manifest: object) -> list[dict]:
    exact_keys(manifest, {"schema_version", "prompts"}, "Invalid prompt manifest fields.")
    require(type(manifest["schema_version"]) is int and manifest["schema_version"] == 1,
            "Unsupported prompt manifest version.")
    prompts = manifest["prompts"]
    require(isinstance(prompts, list) and len(prompts) == 30,
            "The frozen manifest needs exactly 30 prompts.")
    seen_ids: set[str] = set()
    scenarios: dict[str, list[dict]] = defaultdict(list)
    for prompt in prompts:
        exact_keys(prompt, {"id", "scenario_id", "language", "split", "text"},
                   "Invalid prompt fields.")
        require(valid_id(prompt["id"]) and valid_id(prompt["scenario_id"])
                and prompt["id"] not in seen_ids, "Prompt or scenario ID is invalid or duplicated.")
        require(prompt["language"] in LANGUAGES and prompt["split"] in SPLITS,
                "Prompt language or split is invalid.")
        text = prompt["text"]
        require(isinstance(text, str) and text == text.strip() and 1 <= len(text) <= 250
                and any(char.isalnum() for char in text), "Prompt text is invalid.")
        seen_ids.add(prompt["id"])
        scenarios[prompt["scenario_id"]].append(prompt)
    require(len(scenarios) == 10, "The manifest needs ten paired scenarios.")
    split_counts = Counter()
    for variants in scenarios.values():
        require(len(variants) == 3 and {item["language"] for item in variants} == LANGUAGES,
                "Each scenario needs one prompt in each language.")
        require(len({item["split"] for item in variants}) == 1,
                "Language variants of one scenario cannot cross splits.")
        split_counts[variants[0]["split"]] += 1
    require(split_counts == {"development": 6, "heldout": 4},
            "The manifest needs six development and four held-out scenarios.")
    return prompts


def validate_config(config: object) -> dict:
    exact_keys(config, {"schema_version", "repeats_per_prompt", "listener_ids",
                        "stt_configurations", "tts_configurations"},
               "Invalid configuration fields.")
    require(type(config["schema_version"]) is int and config["schema_version"] == 1,
            "Unsupported configuration version.")
    repeats = config["repeats_per_prompt"]
    require(type(repeats) is int and 1 <= repeats <= 10,
            "STT repeats per prompt must be 1-10.")
    listeners = config["listener_ids"]
    require(isinstance(listeners, list) and 2 <= len(listeners) <= 20
            and all(valid_id(value) for value in listeners)
            and len(set(listeners)) == len(listeners),
            "Use 2-20 distinct anonymous listener IDs.")
    for modality in ("stt", "tts"):
        entries = config[f"{modality}_configurations"]
        require(isinstance(entries, list) and 2 <= len(entries) <= 8,
                "Each modality needs 2-8 configuration records.")
        ids = set()
        for entry in entries:
            exact_keys(entry, {"id", "environment", "settings_by_language"},
                       "Invalid configuration record fields.")
            require(valid_id(entry["id"]) and entry["id"] not in ids,
                    "Configuration IDs must be distinct within each modality.")
            ids.add(entry["id"])
            environment = entry["environment"]
            require(isinstance(environment, str) and environment.strip() == environment
                    and 1 <= len(environment) <= 400
                    and not environment.lower().startswith("fill in"),
                    "Configuration environment must describe the actual planned setup.")
            settings = entry["settings_by_language"]
            exact_keys(settings, LANGUAGES, "Settings need all three languages.")
            require(all(isinstance(value, str) and value.strip() == value
                        and 1 <= len(value) <= 300
                        and not value.lower().startswith("fill in") for value in settings.values()),
                    "Language settings must describe the actual planned setup.")
    return config


def planned_rows(prompts: list[dict], config: dict) -> tuple[list[dict], list[dict]]:
    stt = []
    tts = []
    for prompt in prompts:
        shared = {
            "scenario_id": prompt["scenario_id"], "prompt_id": prompt["id"],
            "language": prompt["language"], "split": prompt["split"],
        }
        for setting in config["stt_configurations"]:
            for repeat in range(1, config["repeats_per_prompt"] + 1):
                stt.append({
                    "trial_id": f"stt-{setting['id']}-{prompt['id']}-r{repeat}",
                    **shared, "config": setting["id"], "repeat": repeat,
                    "reference": prompt["text"], "observation_status": "unobserved",
                    "transcript": None, "failure_reason": None,
                })
        for setting in config["tts_configurations"]:
            for listener in config["listener_ids"]:
                tts.append({
                    "trial_id": f"tts-{setting['id']}-{prompt['id']}-{listener}",
                    **shared, "config": setting["id"], "listener_id": listener,
                    "prompt_text": prompt["text"], "observation_status": "unobserved",
                    "ratings": None, "failure_reason": None,
                })
    return stt, tts


def validate_observation(row: dict, modality: str) -> None:
    status = row["observation_status"]
    require(status in {"unobserved", "completed", "failed"},
            "Observation status must be unobserved, completed, or failed.")
    if modality == "stt":
        transcript = row["transcript"]
        reason = row["failure_reason"]
        if status == "completed":
            require(isinstance(transcript, str) and len(transcript) <= MAX_TRANSCRIPT_CHARS
                    and transcript.strip()
                    and any(char.isalnum() for char in transcript) and reason is None,
                    "Completed STT trials need a 1-6000 character transcript and no failure reason.")
        elif status == "failed":
            require(transcript is None and reason in STT_FAILURES,
                    "Failed STT trials need a supported reason and null transcript.")
        else:
            require(transcript is None and reason is None,
                    "Unobserved STT trials cannot contain results.")
    else:
        ratings = row["ratings"]
        reason = row["failure_reason"]
        if status == "completed":
            exact_keys(ratings, RATING_FIELDS, "Completed TTS trials need three ratings.")
            require(all(type(value) is int and 1 <= value <= 5 for value in ratings.values())
                    and reason is None, "Completed TTS ratings must be integers from 1 to 5.")
        elif status == "failed":
            require(ratings is None and reason in TTS_FAILURES,
                    "Failed TTS trials need a supported reason and null ratings.")
        else:
            require(ratings is None and reason is None,
                    "Unobserved TTS trials cannot contain results.")


def validate_plan(plan: object, prompts: list[dict], config: dict,
                  manifest_sha: str, config_sha: str) -> dict:
    exact_keys(plan, {"schema_version", "plan_type", "provenance", "stt_trials", "tts_trials"},
               "Invalid plan fields.")
    require(type(plan["schema_version"]) is int and plan["schema_version"] == 1
            and plan["plan_type"] == "speech_collection_plan", "Unsupported plan version.")
    provenance = plan["provenance"]
    exact_keys(provenance, {"manifest_sha256", "configuration_sha256", "planner_sha256",
                            "created_at_utc"}, "Invalid plan provenance.")
    require(provenance["manifest_sha256"] == manifest_sha
            and provenance["configuration_sha256"] == config_sha
            and provenance["planner_sha256"] == digest(RUNNER_BYTES),
            "Plan, manifest, configuration, or planner source changed; prepare a new plan.")
    require(isinstance(provenance["created_at_utc"], str)
            and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", provenance["created_at_utc"]),
            "Invalid plan creation time.")
    expected_stt, expected_tts = planned_rows(prompts, config)
    for modality, expected in (("stt", expected_stt), ("tts", expected_tts)):
        rows = plan[f"{modality}_trials"]
        require(isinstance(rows, list) and len(rows) == len(expected),
                "Plan trial coverage changed.")
        fixed_keys = set(expected[0]) - {"observation_status", "transcript", "ratings", "failure_reason"}
        for actual, original in zip(rows, expected):
            exact_keys(actual, set(original), "Plan trial fields changed.")
            require(all(actual[key] == original[key] for key in fixed_keys),
                    "A planned trial ID, pairing, split, or prompt was changed.")
            validate_observation(actual, modality)
    return plan


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def write_new(files: list[tuple[Path, bytes]]) -> None:
    require(len({path for path, _ in files}) == len(files), "Output paths must differ.")
    require(all(len(raw) <= MAX_FILE_BYTES for _, raw in files),
            "Output exceeds 4 MiB; reduce the planned collection size.")
    require(all(not path.exists() for path, _ in files),
            "An output file already exists; choose a new private filename.")
    created: list[Path] = []
    try:
        for path, raw in files:
            with path.open("xb") as output:
                created.append(path)
                output.write(raw)
    except OSError:
        for path in created:
            path.unlink(missing_ok=True)
        raise


def prepare(args: argparse.Namespace) -> None:
    config_path = private_path(args.config)
    output_path = private_path(args.output)
    require(config_path != output_path, "Configuration and plan paths must differ.")
    manifest_raw, manifest = read_json(args.manifest)
    config_raw, config = read_json(config_path)
    prompts = validate_manifest(manifest)
    validate_config(config)
    stt, tts = planned_rows(prompts, config)
    plan = {
        "schema_version": 1, "plan_type": "speech_collection_plan",
        "provenance": {
            "manifest_sha256": digest(manifest_raw),
            "configuration_sha256": digest(config_raw),
            "planner_sha256": digest(RUNNER_BYTES),
            "created_at_utc": utc_now(),
        },
        "stt_trials": stt, "tts_trials": tts,
    }
    require(args.manifest.read_bytes() == manifest_raw and config_path.read_bytes() == config_raw
            and Path(__file__).read_bytes() == RUNNER_BYTES, "Source changed during preparation.")
    write_new([(output_path, json_bytes(plan))])
    print(f"Prepared {len(stt)} STT and {len(tts)} TTS unobserved trials; no results were scored.")


def export(args: argparse.Namespace, modality: str) -> None:
    config_path = private_path(args.config)
    plan_path = private_path(args.plan)
    output_path = private_path(args.output)
    provenance_path = private_path(output_path.with_name(output_path.stem + "-provenance.json"))
    require(output_path != provenance_path and output_path not in {config_path, plan_path}
            and provenance_path not in {config_path, plan_path}, "Input and output paths must differ.")
    manifest_raw, manifest = read_json(args.manifest)
    config_raw, config = read_json(config_path)
    plan_raw, plan = read_json(plan_path)
    prompts = validate_manifest(manifest)
    validate_config(config)
    validate_plan(plan, prompts, config, digest(manifest_raw), digest(config_raw))
    rows = [row for row in plan[f"{modality}_trials"]
            if args.split == "all" or row["split"] == args.split]
    missing = sum(row["observation_status"] == "unobserved" for row in rows)
    require(missing == 0,
            f"{missing} selected {modality.upper()} trials are unobserved; no scorer input was exported.")
    if modality == "stt":
        scorer_input = [{
            "config": row["config"], "language": row["language"],
            "prompt_id": row["prompt_id"], "reference": row["reference"],
            "transcript": row["transcript"],
            **({"failure_reason": row["failure_reason"]}
               if row["observation_status"] == "failed" else {}),
        } for row in rows]
    else:
        scorer_input = {"rubric_version": 1, "trials": [{
            "config": row["config"], "language": row["language"],
            "prompt_id": row["prompt_id"], "listener_id": row["listener_id"],
            "outcome": row["observation_status"], "ratings": row["ratings"],
            **({"failure_reason": row["failure_reason"]}
               if row["observation_status"] == "failed" else {}),
        } for row in rows]}
    scorer_bytes = (EVALS_DIR / f"score_{modality}.js").read_bytes()
    scorer_raw = json_bytes(scorer_input)
    by_language = Counter(row["language"] for row in rows)
    by_config = Counter(row["config"] for row in rows)
    provenance = {
        "schema_version": 1, "kind": "speech_scorer_export_provenance",
        "modality": modality, "split": args.split,
        "manifest_sha256": digest(manifest_raw),
        "configuration_sha256": digest(config_raw),
        "collection_plan_sha256": digest(plan_raw),
        "planner_sha256": digest(RUNNER_BYTES),
        "scorer_sha256": digest(scorer_bytes),
        "scorer_input_sha256": digest(scorer_raw),
        "exported_at_utc": utc_now(),
        "observed_trial_count": len(rows),
        "completed_count": sum(row["observation_status"] == "completed" for row in rows),
        "failed_count": sum(row["observation_status"] == "failed" for row in rows),
        "prompt_count": len({row["prompt_id"] for row in rows}),
        "scenario_count": len({row["scenario_id"] for row in rows}),
        "trials_by_language": dict(sorted(by_language.items())),
        "trials_by_configuration": dict(sorted(by_config.items())),
        "note": "Manually supplied observations and metadata; hashes do not authenticate people, audio, or settings.",
    }
    require(args.manifest.read_bytes() == manifest_raw and config_path.read_bytes() == config_raw
            and plan_path.read_bytes() == plan_raw
            and (EVALS_DIR / f"score_{modality}.js").read_bytes() == scorer_bytes
            and Path(__file__).read_bytes() == RUNNER_BYTES,
            "Input or source changed during export.")
    write_new([(output_path, scorer_raw), (provenance_path, json_bytes(provenance))])
    print(f"Exported {len(rows)} observed {modality.upper()} trials and a provenance sidecar; no scoring was run.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("prepare", "export-stt", "export-tts"):
        command = commands.add_parser(name)
        command.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
        command.add_argument("--config", type=Path, required=True)
        command.add_argument("--output", type=Path, required=True)
        if name != "prepare":
            command.add_argument("--plan", type=Path, required=True)
            command.add_argument("--split", choices=("all", "development", "heldout"), default="all")
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            prepare(args)
        else:
            export(args, args.command.removeprefix("export-"))
    except (OSError, UnicodeError, ValueError, TypeError, RecursionError) as error:
        message = str(error) if isinstance(error, ValueError) else "Unreadable input or output file."
        print(f"Speech collection preparation failed: {message}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
