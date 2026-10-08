# Evaluation inputs and evidence

## Checked note inventory

[Corpus manifest](../data/corpus_manifest.json) lists each note ID, translated titles, source URL/section, and recorded source-check date. Its SHA-256 covers the exact raw bytes of `data/fundamental_rights.json`. Rebuild the inventory after a corpus change:

```powershell
.\.venv\Scripts\python.exe tools/export-corpus-manifest.py --output data/corpus_manifest.json
```

The exporter parses and validates the same byte snapshot it hashes. It inventories repository records without checking the linked source again, evaluating retrieval, or calling a provider. Notes are short repository-authored summaries, not a full legal corpus. Recorded dates/links do not establish correctness, translation fidelity, or redistribution permission; the [source review record](../data/SOURCE_REVIEW.md) identifies the referenced edition and documents an unresolved attempt to establish applicable reuse permission. Hindi/Hinglish summaries are repository study material, not official translations from that English?Malayalam edition.

## Constructed retrieval set

`retrieval_examples.json` contains authored text prompts with `id`, `language` (`English`, `Hindi`, `Hinglish`), `question`, and `expected_doc_ids`. Optional `history_questions` supply prior user context. An empty expected-ID list denotes an unsupported question. The current README records 180 examples; inspect the versioned file for the authoritative records. These are constructed cases, not sampled learner questions, transcripts, or an answer-quality set. Recent browser quiz-context hints are not represented by `history_questions` alone.

`run_retrieval_eval.py` reports dataset and corpus hashes, language breakdowns, exact match, strict recall@3, support over all retrieved notes, and unsupported false positives. It rejects invalid or duplicate labels and unknown expected IDs. Baseline overlap and experimental rarity scoring share query construction and eligibility logic. Use `--compare` on the same versions when evaluation runs are requested. Archive the actual report, commit, environment, configuration, and failures with a comparison; a historical README percentage is not proof of current retrieval quality.

## Private speech and review observations

| Input | Procedure / runner | Coverage and limits |
| --- | --- | --- |
| `local-stt-*.json` | Voice run sheet / `score_stt.js` | Self-authored reference/transcript pairs; WER/CER and failures. Text normalization is not pronunciation or meaning. |
| `local-live-*.json` | Browser diagnostics / `summarize_live_stt.js` | Live timings/configurations/attempt outcomes; software events are not acoustic latency. |
| `local-tts-*.json` | `TTS_RUBRIC.md` / `score_tts.js` | Anonymous independent human ratings and matched listener/prompt coverage; no actual ratings collected here. |
| `local-tutor-*.json` | Browser diagnostics / tutor/stop summarizers | Turn outcomes and software timings; missing metadata and collisions require inspection. |
| `local-quiz-*.json` | `QUIZ_REVIEW_RUBRIC.md` / `score_quiz_reviews.js` | Independent human concept counts versus actual automated scores; bank hash and paired review coverage required. |

These local JSON patterns and audio recordings are ignored by Git. Keep configuration and observation notes private and use self-authored material; any real learner data needs consent. Example schemas in the procedures are illustrative, not measured results. IDs and labels are supplied metadata, not verified provenance. Do not publish real benchmark numbers until observations have actually been collected and the appropriate runner has processed them.

No scoring, human collection, speech recordings, or provider requests were performed while preparing this inventory/documentation.
