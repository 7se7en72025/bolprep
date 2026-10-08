"""Aggregate human labels only; never grade or load answer evidence."""

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from itertools import combinations
import json
from pathlib import Path
import platform
import re
import sys

CLAIMS = ("supported", "contradicted", "unbacked", "inconclusive")
NOTES = ("supporting", "irrelevant", "inconclusive")
DISPOSITIONS = ("answered", "clarified", "abstained", "mixed", "inconclusive")
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,79}\Z")
SHA = re.compile(r"[0-9a-f]{64}\Z")
MAX_BYTES = 16 * 1024 * 1024
RUNNER_PATH = Path(__file__).resolve()
RUBRIC_PATH = RUNNER_PATH.with_name("ANSWER_SUPPORT_RUBRIC.md")
# Capture before the reporting functions are defined; recheck before emitting.
RUNNER_BYTES = RUNNER_PATH.read_bytes()


def require(condition, location):
    if not condition:
        raise ValueError("Invalid label data at " + location)


def keys(value, expected, location):
    require(isinstance(value, dict) and set(value) == set(expected.split()), location)


def identifiers(value, limit, location):
    require(isinstance(value, list) and len(value) <= limit, location)
    require(all(isinstance(item, str) and ID.fullmatch(item) for item in value), location)
    require(len(set(value)) == len(value), location)


def validate(data):
    keys(data, "schema_version rubric_version expected_reviewer_count attempts", "collection")
    require(type(data["schema_version"]) is int and data["schema_version"] == 1, "schema")
    require(type(data["rubric_version"]) is int and data["rubric_version"] == 1, "rubric")
    expected = data["expected_reviewer_count"]
    require(type(expected) is int and 2 <= expected <= 20, "reviewer count")
    attempts = data["attempts"]
    require(isinstance(attempts, list) and len(attempts) <= 2000, "attempts")
    seen = set()
    for index, attempt in enumerate(attempts):
        loc = f"attempt {index}"
        keys(attempt, "attempt_id record_sha256 prompt_id configuration_id language outcome expected_disposition claim_ids displayed_note_ids reviews", loc)
        for field in ("attempt_id", "prompt_id", "configuration_id"):
            require(isinstance(attempt[field], str) and ID.fullmatch(attempt[field]), loc)
        require(attempt["attempt_id"] not in seen, loc)
        seen.add(attempt["attempt_id"])
        require(isinstance(attempt["record_sha256"], str) and SHA.fullmatch(attempt["record_sha256"]), loc)
        require(attempt["language"] in ("English", "Hindi", "Hinglish"), loc)
        require(attempt["outcome"] in ("completed", "failed", "cancelled"), loc)
        require(attempt["expected_disposition"] in ("answered", "clarified", "abstained", "inconclusive"), loc)
        identifiers(attempt["claim_ids"], 1000, loc)
        identifiers(attempt["displayed_note_ids"], 100, loc)
        reviews = attempt["reviews"]
        require(isinstance(reviews, list) and len(reviews) <= expected, loc)
        if attempt["outcome"] != "completed":
            require(not reviews and not attempt["claim_ids"] and not attempt["displayed_note_ids"], loc)
        reviewers = set()
        for review_index, review in enumerate(reviews):
            rloc = f"{loc}, review {review_index}"
            keys(review, "reviewer_id claim_labels displayed_note_labels disposition relevant", rloc)
            reviewer = review["reviewer_id"]
            require(isinstance(reviewer, str) and ID.fullmatch(reviewer) and reviewer not in reviewers, rloc)
            reviewers.add(reviewer)
            for field, units, labels in (("claim_labels", "claim_ids", CLAIMS), ("displayed_note_labels", "displayed_note_ids", NOTES)):
                mapping = review[field]
                require(isinstance(mapping, dict) and set(mapping) == set(attempt[units]), rloc)
                require(all(isinstance(label, str) and label in labels for label in mapping.values()), rloc)
            require(review["disposition"] in DISPOSITIONS, rloc)
            require(review["relevant"] is None or type(review["relevant"]) is bool, rloc)
    return data


def fraction(numerator, denominator):
    return numerator / denominator if denominator else None


def aggregate(attempts, expected):
    outcomes = Counter(a["outcome"] for a in attempts)
    claims, notes, answers, dispositions, relevance, pairs = (Counter() for _ in range(6))
    reviews_count = no_claim_attempts = 0
    for attempt in attempts:
        if attempt["outcome"] != "completed":
            continue
        no_claim_attempts += not attempt["claim_ids"]
        for review in attempt["reviews"]:
            reviews_count += 1
            labels = list(review["claim_labels"].values())
            claims.update(labels)
            notes.update(review["displayed_note_labels"].values())
            answers["no_claims"] += not labels
            answers["fully_supported"] += bool(labels) and all(label == "supported" for label in labels)
            for label in ("contradicted", "unbacked", "inconclusive"):
                answers[label] += label in labels
            dispositions[attempt["expected_disposition"] + "/" + review["disposition"]] += 1
            relevance[{True: "relevant", False: "irrelevant", None: "inconclusive"}[review["relevant"]]] += 1
        for first, second in combinations(attempt["reviews"], 2):
            for claim in attempt["claim_ids"]:
                pair = sorted((first["claim_labels"][claim], second["claim_labels"][claim]))
                pairs["/".join(pair)] += 1
    claim_total = sum(claims.values())
    pair_total = sum(pairs.values())
    return {
        "attempts": len(attempts),
        "outcomes": {label: outcomes[label] for label in ("completed", "failed", "cancelled")},
        "completion_fraction": fraction(outcomes["completed"], len(attempts)),
        "completed_attempts_without_claims": no_claim_attempts,
        "expected_completed_reviews": outcomes["completed"] * expected,
        "observed_reviews": reviews_count,
        "missing_reviews": outcomes["completed"] * expected - reviews_count,
        "claim_review_counts": {label: claims[label] for label in CLAIMS},
        "claim_review_total": claim_total,
        "support_fraction": fraction(claims["supported"], claim_total),
        "conclusive_support_fraction": fraction(claims["supported"], claim_total - claims["inconclusive"]),
        "answer_review_counts": {label: answers[label] for label in ("fully_supported", "no_claims", "contradicted", "unbacked", "inconclusive")},
        "displayed_note_review_counts": {label: notes[label] for label in NOTES},
        "displayed_note_review_total": sum(notes.values()),
        "displayed_note_support_fraction": fraction(notes["supporting"], sum(notes.values())),
        "expected_observed_disposition_counts": dict(sorted(dispositions.items())),
        "answer_relevance_review_counts": {label: relevance[label] for label in ("relevant", "irrelevant", "inconclusive")},
        "claim_reviewer_pair_counts": dict(sorted(pairs.items())),
        "claim_reviewer_pair_total": pair_total,
        "exact_claim_agreement_fraction": fraction(sum(pairs[label + "/" + label] for label in CLAIMS), pair_total),
    }


def summarize(data):
    validate(data)
    groups = {}
    for attempt in data["attempts"]:
        key = (attempt["configuration_id"], attempt["language"])
        groups.setdefault(key, []).append(attempt)
    return {
        "schema_version": 2,
        "rubric_version": 1,
        "expected_reviewer_count": data["expected_reviewer_count"],
        "units": "Human review observations; repeated reviewer votes are not unique claims or answers.",
        "limitations": "No evidence verification, automatic grading, adjudication, citation mapping, or matched configuration comparison. Zero denominators are null. Agreement is not correctness.",
        "overall": aggregate(data["attempts"], data["expected_reviewer_count"]),
        "groups": [dict(configuration_id=config, language=language, **aggregate(attempts, data["expected_reviewer_count"])) for (config, language), attempts in sorted(groups.items())],
    }


def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def read_labels(path):
    with path.open("rb") as source:
        raw = source.read(MAX_BYTES + 1)
    require(len(raw) <= MAX_BYTES, "file size")
    return raw


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("labels", type=Path, help="Private schema-1 label file; raw evidence is not loaded")
    args = parser.parse_args()
    try:
        require(RUNNER_PATH.read_bytes() == RUNNER_BYTES, "runner stability")
        rubric_bytes = RUBRIC_PATH.read_bytes()
        raw = read_labels(args.labels)
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicates)
        report = summarize(data)
        require(read_labels(args.labels) == raw, "label stability")
        require(RUBRIC_PATH.read_bytes() == rubric_bytes, "rubric stability")
        require(RUNNER_PATH.read_bytes() == RUNNER_BYTES, "runner stability")
        report["provenance"] = {
            "labels_sha256": digest(raw),
            "labels_bytes": len(raw),
            "rubric_sha256": digest(rubric_bytes),
            "runner_sha256": digest(RUNNER_BYTES),
            "python_version": platform.python_version(),
            "python_implementation": platform.python_implementation(),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        }
    except (OSError, UnicodeError, ValueError, TypeError, RecursionError):
        print("Cannot summarize: unreadable file or invalid label schema. No input content is echoed.", file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, ensure_ascii=True, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
