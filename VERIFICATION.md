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
