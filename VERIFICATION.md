# Local verification record

Run date: 2026-10-08. This record establishes an offline local milestone. It does not establish completion of the real voice roadmap.

## Environment and results

Windows, CPython 3.11.9, Node.js 24.12.0, Chrome 154.0.8037.97 in headless mode. Browser tests use pinned `playwright-core` 1.64.0 and an installed browser.

| Check | Observed result | Scope |
| --- | --- | --- |
| Python unit/HTTP suite | 41 tests passed | Retrieval, quiz, tools, progress, model-response guards, actual loopback HTTP health/login origins. |
| Offline HTTP smoke | Passed on port 18080 | Page, 48 notes, sourced Hinglish answer, quiz save/retry, progress, revision-tool trace; temporary database. |
| Live-STT Node suite | 4 tests passed | Mocked protocol, continuous-turn clearing, malformed event rejection, cancellation before commit. |
| Chrome browser suite | 3 tests passed | Actual offline tutor/save-open/quiz/diagnostics UI; delayed-response Stop; browser speech callbacks mocked for cancellation/history checks. |
| Fresh Python setup | Installed lock snapshot; `pip check` passed; 41 tests passed | Separate environment under ignored `.codex/setup-verification`; served final browser run. No provider calls. |
| Fresh Node dependencies | `npm ci` passed | Exact package lock; then both Node/browser suites passed again. |
| Constructed retrieval comparison | Both scorers: 180/180 exact sets, 0/8 unsupported false positives | Same authored cases informed fixes; not held-out learner or legal-answer evaluation. |

See [evaluation reports](evals/reports/README.md) for raw before/after reports, source/input hashes, denominators, and failures. The top-three label recall is 178/313, including three broad cases each expecting all 48 notes; do not replace that denominator with question count.

## Defects addressed

- Chrome startup crashed because `HTMLOptionsCollection` has no `.some()` method. Converting options to an array restores initialization.
- Windows virtual-environment Python can run the server in a direct interpreter child. The smoke utility now recognizes that owned child and cleans it up, while rejecting foreign listeners.
- Configurable localhost ports allow isolated runs; login/live/access origin checks use the bound port.
- Retrieval needed stronger Hindi phrase evidence, function-word filtering, and a distinction between requested articles and explicitly supported contextual citations. Multi-article requests and comparisons retain their separate notes.
- Older mocks and expected corpus/quiz results were updated to current contracts; incomplete model responses still cannot execute tools.

## Reproduce

Follow [README verification commands](README.md#verification). The browser suite writes study records to its target server; use the disposable offline database shown there. It checks loopback/offline readiness before writes. These checks do not guarantee atomic process ownership if a port is rebound after inspection.

## Still required

No provider API key was configured during this run. No external model calls, real recordings, consented speech sample collection, native-speaker ratings, human scoring/support reviews, acoustic latency measurements, or voice demo recording were performed. Actual multilingual STT → model → TTS, natural pauses, audible interruption, device recovery, paired speech comparisons, and the recorded voice demonstration remain open. Publisher reuse permission also remains unresolved.

The passing checks above cannot be used to mark those gates complete or claim production readiness.


## Expanded regression and automation coverage

A follow-up verification passed 44 Python tests (three additional actual HTTP saved-data checks), all four headless Chrome tests, and all four mocked live-STT tests. Storage checks cover cookie ownership, idempotent retries/conflicts, HTTP-server restart persistence, separate conversation/progress deletion, and malformed input without writes or response leaks. The added Chrome recording test uses fake permission/capture/upload responses to check draft preservation and track cleanup; it does not collect real microphone audio.

The new tools/check-browser.ps1 runner passed locally on a free port with an isolated database and restored its environment/removed its owned process and temporary run files. The GitHub push/PR workflow repeats provider-free checks and retains retrieval output. Action revisions were checked against their upstream v7 tags and pinned to those commit hashes. Cloud execution is not established by these local results; no recurring schedule was created.


## Observed cloud verification

GitHub Actions [run 37810436397](https://github.com/7se7en72025/bolprep/actions/runs/37810436397), for commit a7f28982267d65f5ba45c48c3b5ede4e00cdaaf9, completed successfully. The GitHub run/jobs API reported success for all dependency, Python test, voice-state, retrieval, browser, and artifact-upload steps. This is independent runner execution of the offline checks; it does not establish real microphone/provider or human-review gates.


## Quiz integrity and voice recovery checks - 2026-10-10

The local suite now passes 53 Python tests, five headless Chrome flows, four mocked live-STT checks, and four synthetic TTS report checks. New checks cover server-bound learner text for model scoring, bounded explicit-denial handling with positive-wording counterexamples, and a continuous-voice interrupted quiz answer retained after failed/canceled transcription or a refused next-question command. A new spoken answer can replace the draft. The browser regression failed on the previous application code and passed after the fix.

TTS report tests use fabricated metadata only to check null/true/false pairing semantics; they are not human speech observations. The CI workflow now runs npm run test:eval. This follow-up has local evidence; cloud execution for its new commit must be observed separately. Scoring remains lexical and can misread complex meaning. Provider/microphone sessions, human evaluations, source reuse approval, and the actual recorded voice demo remain open.


## Opt-in trace storage and speech collection checks - 2026-10-10

- Added metadata-only server-owned tutor traces behind a per-turn opt-in that defaults off each page. Cookie-scoped read/delete, 100-record cap, and seven-day pruning on read/write; expired rows can remain while idle. No learner text/audio/error payload is stored. Opted-out turns do not open SQLite. Save failure leaves tutoring intact. Disconnect records HTTP write failure and preserves already-known usage, without claiming upstream cancellation.
- Added safe bounded diagnostics UI and actual offline Chrome checks for opt-in, reload, ownership/deletion, malformed/oversized responses, and restored Article14/Article21 context through a language switch.
- Added 30 self-authored speech prompts grouped into ten multilingual scenarios, with 18 development and 12 planned held-out prompts. Preparation creates unobserved paired rows; export rejects incomplete selected splits, changed inputs/pairing, placeholder config, oversized content, and existing outputs. Private scorer inputs include provenance sidecars. Eight synthetic planner tests passed, including scorer compatibility; these are not speech measurements.
- Root local verification passed 67 Python tests and seven Chrome checks with a disposable offline database. Source syntax and whitespace checks pass. The isolated offline smoke, four mocked live-STT checks, and four synthetic TTS report checks also pass. No provider key, actual recordings, human reviews, acoustic measurements, or voice-demo recording were supplied. Cloud verification for the forthcoming commit still needs observation.


## Separate score previews from verified saves - 2026-10-10

- Added the explicit save_progress model tool. score_answer checks quiz ownership before grading and returns an unsaved preview; save_progress uses only a same-turn server-issued score ID and retained rubric result. Actual temporary SQLite checks establish zero attempts after preview and one after repeated saves. Forged IDs, model-supplied marks, altered browser results, duplicate scores, and mixed quiz-start/scoring flows are rejected. Direct quiz forms keep their score-and-save contract.
- Scored narration now uses deterministic rubric feedback and verified saved/unsaved status. A failed model response after a successful save retains observed tool outcomes and source counts in opted-in diagnostics, without storing learner text or inventing usage.
- Root verification: 77 Python tests, eight isolated offline Chrome checks, four mocked live-STT checks, and four synthetic TTS report checks passed. Model rounds and speech state use fixtures; these are not actual provider calls or microphone observations.
- Previous commit fe244da passed GitHub Actions run 37990783346. Cloud verification of this new change remains pending until push. Real provider/microphone runs, paired observations, human reviews, source reuse approval, and the voice demonstration remain open.
