"""Evaluate or compare lexical scoring on labeled questions without external services."""

from __future__ import annotations

import json
import argparse
import hashlib
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

SOURCE_PATHS = {
    "retrieval.py": REPO_ROOT / "retrieval.py",
    "evals/run_retrieval_eval.py": Path(__file__).resolve(),
}
SOURCE_BYTES = {name: path.read_bytes() for name, path in SOURCE_PATHS.items()}

from retrieval import CORPUS_PATH, load_corpus, retrieval_query, retrieve  # noqa: E402


DATASET_PATH = Path(__file__).with_name("retrieval_examples.json")
SUPPORTED_LANGUAGES = {"English", "Hindi", "Hinglish"}


def _require_stable_sources() -> None:
    if any(path.read_bytes() != SOURCE_BYTES[name] for name, path in SOURCE_PATHS.items()):
        raise ValueError("Retrieval or evaluator source changed; restart against stable code.")


def evaluate(dataset_path: Path = DATASET_PATH, *, scoring: str = "overlap") -> dict[str, Any]:
    _require_stable_sources()
    if scoring not in {"overlap", "rarity"}:
        raise ValueError("Retrieval scoring must be overlap or rarity.")
    dataset_bytes = dataset_path.read_bytes()
    corpus_bytes = CORPUS_PATH.read_bytes()
    examples = json.loads(dataset_bytes.decode("utf-8"))
    if not isinstance(examples, list) or not examples:
        raise ValueError("Retrieval evaluation dataset must be a non-empty JSON list.")

    rows: list[dict[str, Any]] = []
    per_language: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_ids: set[str] = set()
    corpus_ids = {document["id"] for document in load_corpus()}
    for example in examples:
        if not isinstance(example, dict) or not all(
            key in example for key in ("id", "language", "question", "expected_doc_ids")
        ):
            raise ValueError("Each evaluation example needs id, language, question, and expected_doc_ids.")
        if (
            not isinstance(example["id"], str)
            or example["id"] in seen_ids
            or not isinstance(example["language"], str)
            or not isinstance(example["question"], str)
            or not isinstance(example["expected_doc_ids"], list)
            or not all(isinstance(doc_id, str) for doc_id in example["expected_doc_ids"])
            or (
                "history_questions" in example
                and (
                    not isinstance(example["history_questions"], list)
                    or not all(isinstance(item, str) for item in example["history_questions"])
                )
            )
        ):
            raise ValueError("Retrieval evaluation example has invalid field types or a duplicate ID.")
        if (
            not example["id"].strip()
            or not example["question"].strip()
            or example["language"] not in SUPPORTED_LANGUAGES
            or not all(doc_id.strip() for doc_id in example["expected_doc_ids"])
        ):
            raise ValueError("Retrieval evaluation IDs, questions, labels, and language names must be non-empty and supported.")
        if len(example["expected_doc_ids"]) != len(set(example["expected_doc_ids"])):
            raise ValueError(f"Retrieval evaluation example {example['id']} has duplicate expected document IDs.")
        unknown_expected_ids = set(example["expected_doc_ids"]) - corpus_ids
        if unknown_expected_ids:
            raise ValueError(
                f"Evaluation example {example['id']} references unknown corpus notes: "
                f"{', '.join(sorted(unknown_expected_ids))}."
            )
        seen_ids.add(example["id"])

        expected = set(example["expected_doc_ids"])
        query = retrieval_query(example["question"], example.get("history_questions", []))
        actual = [document["id"] for document in retrieve(query, scoring=scoring)]
        actual_set = set(actual)
        if expected:
            matched = expected & actual_set
            passed = expected == actual_set
        else:
            matched = set()
            passed = not actual
        row = {
            "id": example["id"],
            "language": example["language"],
            "question": example["question"],
            "expected_doc_ids": sorted(expected),
            "retrieved_doc_ids": actual,
            "passed": passed,
            "retrieved_expected": sorted(matched),
            "retrieved_expected_at_3": sorted(expected & set(actual[:3])),
        }
        if example.get("history_questions"):
            row["history_questions"] = example["history_questions"]
        rows.append(row)
        per_language[example["language"]].append(row)

    supported_rows = [row for row in rows if row["expected_doc_ids"]]
    unsupported_rows = [row for row in rows if not row["expected_doc_ids"]]
    expected_total = sum(len(row["expected_doc_ids"]) for row in supported_rows)
    retrieved_expected_total = sum(len(row["retrieved_expected"]) for row in supported_rows)
    retrieved_expected_at_3_total = sum(len(row["retrieved_expected_at_3"]) for row in supported_rows)
    per_language_metrics: dict[str, dict[str, Any]] = {}
    for language, language_rows in sorted(per_language.items()):
        language_supported = [row for row in language_rows if row["expected_doc_ids"]]
        language_unsupported = [row for row in language_rows if not row["expected_doc_ids"]]
        language_expected_total = sum(len(row["expected_doc_ids"]) for row in language_supported)
        language_retrieved_total = sum(len(row["retrieved_expected"]) for row in language_supported)
        language_retrieved_at_3_total = sum(len(row["retrieved_expected_at_3"]) for row in language_supported)
        per_language_metrics[language] = {
            "example_count": len(language_rows),
            "supported_count": len(language_supported),
            "unsupported_count": len(language_unsupported),
            "exact_match_rate": round(sum(row["passed"] for row in language_rows) / len(language_rows), 4),
            "supported_recall_at_3": (
                round(language_retrieved_at_3_total / language_expected_total, 4)
                if language_expected_total else None
            ),
            "retrieved_support_recall": (
                round(language_retrieved_total / language_expected_total, 4)
                if language_expected_total else None
            ),
            "unsupported_false_positive_rate": (
                round(sum(bool(row["retrieved_doc_ids"]) for row in language_unsupported) / len(language_unsupported), 4)
                if language_unsupported else None
            ),
        }

    if dataset_path.read_bytes() != dataset_bytes or CORPUS_PATH.read_bytes() != corpus_bytes:
        raise ValueError("Dataset or corpus changed during evaluation; rerun against stable inputs.")
    _require_stable_sources()
    return {
        "evaluation_schema_version": 2,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "implementation": {
            "source_sha256": {name: hashlib.sha256(raw).hexdigest() for name, raw in SOURCE_BYTES.items()},
            "python_version": sys.version.split()[0],
            "python_implementation": sys.implementation.name,
        },
        "scoring": scoring,
        "dataset_sha256": hashlib.sha256(dataset_bytes).hexdigest(),
        "corpus_sha256": hashlib.sha256(corpus_bytes).hexdigest(),
        "dataset": str(dataset_path.relative_to(REPO_ROOT)),
        "example_count": len(rows),
        "supported_count": len(supported_rows),
        "unsupported_count": len(unsupported_rows),
        "exact_match_rate": round(sum(row["passed"] for row in rows) / len(rows), 4),
        "supported_recall_at_3": round(retrieved_expected_at_3_total / expected_total, 4) if expected_total else None,
        "retrieved_support_recall": round(retrieved_expected_total / expected_total, 4) if expected_total else None,
        "unsupported_false_positive_rate": round(
            sum(bool(row["retrieved_doc_ids"]) for row in unsupported_rows) / len(unsupported_rows), 4
        ) if unsupported_rows else 0.0,
        "per_language_exact_match_rate": {
            language: round(sum(row["passed"] for row in language_rows) / len(language_rows), 4)
            for language, language_rows in sorted(per_language.items())
        },
        "per_language": per_language_metrics,
        "failures": [row for row in rows if not row["passed"]],
        "results": rows,
        "note": "Constructed text examples only; these figures do not estimate real learner or speech performance.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate local retrieval on constructed labeled questions.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--scoring", choices=("overlap", "rarity"), default="overlap")
    mode.add_argument("--compare", action="store_true", help="Compare both scorers on the same dataset and corpus.")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if args.compare:
        baseline = evaluate(scoring="overlap")
        candidate = evaluate(scoring="rarity")
        if any(baseline[key] != candidate[key] for key in ("dataset_sha256", "corpus_sha256", "implementation")):
            raise ValueError("Comparison inputs changed between configurations; rerun against stable inputs.")
        changed = []
        for before, after in zip(baseline["results"], candidate["results"]):
            if before["retrieved_doc_ids"] != after["retrieved_doc_ids"]:
                changed.append({"id": before["id"], "language": before["language"],
                                "overlap_doc_ids": before["retrieved_doc_ids"],
                                "rarity_doc_ids": after["retrieved_doc_ids"],
                                "overlap_passed": before["passed"], "rarity_passed": after["passed"]})
        report = {"comparison_schema_version": 1, "baseline": baseline, "candidate": candidate,
                  "changed_examples": changed,
                  "exact_match_gains": sum(not row["overlap_passed"] and row["rarity_passed"] for row in changed),
                  "exact_match_regressions": sum(row["overlap_passed"] and not row["rarity_passed"] for row in changed),
                  "note": "Experimental rarity weighting is not assumed better; inspect gains, regressions, and failures."}
        passed = not baseline["failures"] and not candidate["failures"]
    else:
        report = evaluate(scoring=args.scoring)
        passed = not report["failures"]
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
