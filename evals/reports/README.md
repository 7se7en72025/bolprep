# Local evaluation runs — 2026-10-08

These are provider-free checks on authored text cases and synthetic regression fixtures. They contain no learner speech, human ratings, model answers, or observed voice timings.

## Constructed retrieval comparison, before retrieval fixes

- Raw report: [`retrieval-compare-2026-10-08.json`](retrieval-compare-2026-10-08.json)
- Command: `.\.venv\Scripts\python.exe evals\run_retrieval_eval.py --compare`, executed from a temporary in-repository snapshot of the four required tracked input/code files at the revision below. The snapshot was removed after the report was captured.
- Exit code: `1`, because the evaluator returns failure when either scorer misses an exact expected document set.
- Source revision: `4636489cfa9a1a189028afdfb24a2b0205f632a8`. Python: CPython 3.11.9. The JSON contains UTC timestamps and SHA-256 fingerprints for the exact dataset, corpus, retrieval implementation, and evaluator source. All four fingerprints were checked against the revision's blobs. Raw report SHA-256: `e30a83591bf63b00eda2bf87d72ed0d123df76c666c43e074e0f128a016955d9`.

| Measure | Overlap | Rarity | Denominator / meaning |
| --- | ---: | ---: | --- |
| Exact expected set | 175 / 180 (97.22%) | 175 / 180 (97.22%) | All authored questions; extra retrieved notes fail exact match. |
| Supported recall at 3 | 178 / 313 (56.87%) | 178 / 313 (56.87%) | Expected note labels, not questions. Three broad prompts each expect all 48 notes, so at most 9 / 144 of their labels fit in the top three. All 169 single-note prompts find their expected note in the top three. |
| Expected support found at any rank | 313 / 313 (100%) | 313 / 313 (100%) | Includes full-list broad retrieval; this does not measure answer grounding. |
| Unsupported false positives | 1 / 8 (12.5%) | 1 / 8 (12.5%) | Unsupported authored questions with any retrieved note. |

Coverage: 180 questions: 58 English, 58 Hindi, 64 Hinglish; 172 supported and 8 unsupported. Failures for both scorers: `hi-equality` (extra Articles 16 and 17), `hi-uncovered-article-detail` (Article 21 despite an empty expected set), `en-art31c-dpsp` (extra 14 and 19), `hi-art31c-policy` (extra 39), and `hinglish-art31c-policy` (extra 14 and 19). Rarity changes the retrieved set only for `hi-equality`, removing Article 17 while still failing. There are zero exact-match gains and zero regressions.

The expected sets are author labels. In particular, Article 31C prompts mention other Articles; this report measures agreement with the labeled primary-note set, not whether every additional note is intrinsically irrelevant. The privacy prompt's empty label denotes information outside the short checked note, not a legal judgment on Article 21. No confidence interval or real-user performance claim follows from this constructed set.

## Constructed retrieval comparison, after retrieval fixes

- Raw report: [`retrieval-compare-2026-10-08-post-fix.json`](retrieval-compare-2026-10-08-post-fix.json)
- Command: `.\.venv\Scripts\python.exe evals\run_retrieval_eval.py --compare` from the shared working tree after retrieval changes; exit code `0`.
- Repository HEAD during run: `4636489cfa9a1a189028afdfb24a2b0205f632a8`, with **uncommitted** retrieval changes. The JSON fingerprints identify the exact working-tree source bytes; `retrieval.py` SHA-256 is `5e85480d022a28fd1186c4a3690d0bbdd828b386847c43736ec723febf558a6c`. The runner checked input and source stability during the run, and the four recorded hashes were checked against the files immediately afterward. Raw report SHA-256: `0e4d7888b2603f471efe3835f6d14deb83cc0b200904145b85a34c5b22427c26`.

| Measure | Overlap | Rarity | Denominator |
| --- | ---: | ---: | --- |
| Exact expected set | 180 / 180 (100%) | 180 / 180 (100%) | 180 authored questions. |
| Supported recall at 3 | 178 / 313 (56.87%) | 178 / 313 (56.87%) | 313 expected note labels, including 144 labels across the three broad prompts. |
| Expected support found at any rank | 313 / 313 (100%) | 313 / 313 (100%) | 313 expected note labels. |
| Unsupported false positives | 0 / 8 (0%) | 0 / 8 (0%) | 8 unsupported authored questions. |

Both scorers return the same document IDs for all 180 examples. This is a local constructed-set pass after the retrieval edits, not independent evidence of broader language understanding, correct legal answers, or voice quality. The unchanged top-three recall is a property of the full-corpus broad-query labels, as described above.

## Report-runner regression checks

An in-repository temporary directory held **synthetic, self-authored fixture JSON** and was removed after the check. No synthetic aggregate is archived as a human, listener, or learner result. Node.js 24.12.0 and CPython 3.11.9 ran four CLIs; all assertions passed:

| Runner | Fixture behavior asserted |
| --- | --- |
| `score_stt.js` | One word error and one failed transcript across two attempts; completed-only WER 1 / 2, all-attempt WER 4 / 5, matched prompt/repeat coverage. |
| `score_tts.js` | Completed and failed playback counts, all-pair match, completed-pair mismatch. Ratings were invented solely to exercise aggregation. |
| `score_quiz_reviews.js` | One synthetic exact score agreement and one timeout; distinct answer and completed-review denominators. The current question-bank byte hash was supplied. |
| `summarize_answer_reviews.py` | One labeled synthetic claim, one failed attempt, one missing review, null agreement denominator when no reviewer pair exists. |

No runner defects were found in these narrow aggregation checks. Their success validates selected report arithmetic and schema paths only. Actual STT/TTS comparison, human quiz/answer review, acoustic latency, browser microphone behavior, and end-to-end voice results remain unmeasured.
