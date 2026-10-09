"""Export the checked local corpus inventory; no retrieval evaluation or provider calls."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from retrieval import CORPUS_PATH, parse_corpus


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="Optional JSON destination within this repository; otherwise print JSON.")
    args = parser.parse_args()
    # Hash and parse one byte snapshot; no second read can change the recorded identity.
    original = CORPUS_PATH.read_bytes()
    documents = parse_corpus(original.decode("utf-8"))
    manifest = {
        "schema_version": 1,
        "corpus_path": "data/fundamental_rights.json",
        "corpus_sha256": hashlib.sha256(original).hexdigest(),
        "document_count": len(documents),
        "scope": "Repository-authored short study summaries with recorded source metadata; not full constitutional text or legal interpretation.",
        "source_review": {
            "record": "data/SOURCE_REVIEW.md", "reviewed_on": "2026-10-08",
            "edition": "Second English-Malayalam diglot edition, 2024",
            "reuse_status": "unresolved",
            "policy_reviewed_on": "2026-10-10",
            "repository_translations": "Hindi/Hinglish summaries are repository study material, not official translations from this edition.",
        },
        "reuse_permission_review": "See data/SOURCE_REVIEW.md for edition evidence and the retrieved publisher policy. Applicable document/adaptation permission has not been established.",
        "limitations": [
            "Source check dates are repository records, not a fresh source verification performed by this exporter.",
            "Inventory validation does not prove factual accuracy, translation fidelity, citation support, or retrieval quality.",
            "Regenerate after corpus edits; this is a snapshot, not a runtime source of truth.",
        ],
        "documents": [{
            "id": document["id"],
            "titles": {"English": document["title"], "Hindi": document["title_hi"],
                       "Hinglish": document["title_hinglish"]},
            "source": {field: document["source"][field] for field in ("title", "url", "section", "checked_on")},
        } for document in documents],
    }
    rendered = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        destination = (ROOT / args.output).resolve()
        if not destination.is_relative_to(ROOT) or destination.suffix.lower() != ".json":
            parser.error("Choose a JSON destination inside this repository.")
        if destination == CORPUS_PATH.resolve() or destination.exists() and destination.name != "corpus_manifest.json":
            parser.error("Choose a new destination or the dedicated corpus_manifest.json file.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(rendered, encoding="utf-8")
        print(f"Exported {len(documents)} note records to {destination.relative_to(ROOT).as_posix()}.")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(rendered, end="")


if __name__ == "__main__":
    main()
