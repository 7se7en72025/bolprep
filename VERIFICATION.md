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


## Protect progress under concurrent requests - 2026-10-10

- Reproduced a legacy migration race by pausing the first initializer after creating its staging table: a second initializer could inspect the old schema and fail with a table-already-exists error. Schema creation and migration now use one BEGIN IMMEDIATE transaction instead of executescript, which previously committed early. The existing ten-second lock timeout remains; prolonged contention is not guaranteed to succeed.
- Added controlled migration exclusion and injected-failure rollback/retry checks, plus eight concurrent initializers preserving the historical score. Added actual loopback HTTP checks with competing different answers: same-key retries retain one result, different keys select one winner and one conflict, and deletion before a paused save cannot recreate the deleted quiz/owner or remove another owner's progress. These cover bounded schedules, not every possible concurrent operation.
- The preceding score/save integration and CI diagnostic commit passed GitHub Actions run 37992508289 at 862c837. Earlier run 37992063632 failed its browser step without accessible detail; the follow-up and local Chrome/Edge checks passed, so its cause is unresolved rather than a demonstrated application defect.

- Root verification passed 83 Python tests, eight isolated offline Chrome checks, and the isolated offline smoke. Whitespace checks passed. No actual provider calls, microphone recordings, or human evaluations were performed; those acceptance gates remain open. Cloud execution of this new commit remains to be observed after push.


## Repair voice startup failures - 2026-10-10

- Reproduced continuous input closing when a fast live channel opened before AudioContext.resume finished. Listening now gives the pending resume up to three seconds, releases the wait on cancellation, and checks closed state before enabling tracks. Duplicate startup/clear events cannot begin two listening turns. Mocked success, cancellation/late resume, rejection, stalled resume, and duplicate acknowledgement checks pass; real device timing remains unobserved.
- Provider speech previously sent HTTP 200 before its first PCM read, so empty or immediately failing streams could not report a structured failure. It now prefetches a nonempty bounded valid chunk before committing success. Five actual loopback HTTP checks use a fake provider to verify empty/early failure/oversized-first JSON 502, preserved normal bytes, later incomplete-stream failure, and provider/client cleanup. No provider requests or real audio were collected.
- Root Python verification passed 88 tests and mocked live-STT verification passed eight checks; source syntax and whitespace checks passed. Browser verification is recorded below after the disposable runner finishes.
- The preceding migration commit a5eda3d passed GitHub Actions run 37993422312. Real microphone/provider sessions, human reviews, source permission, and recorded demo remain open.

- Root disposable Chrome verification finished with all eight checks passing; four synthetic TTS report checks also passed. Cloud execution of this new commit remains pending until push.


## Keep article context through repeated follow-ups - 2026-10-10

- Reproduced ordinary tutoring losing its article on the fifth generic follow-up: source links were displayed but their topic hint was omitted from assistant history. The existing four-query retrieval window then contained only generic user questions. The browser now passes validated answer sources into its existing bounded history helper. Exactly one article source can supply a hint; multiple sources cannot select an arbitrary article. Hints remain topic metadata, not evidence of answer correctness.
- Extended the actual offline Chrome context regression with six Article21 follow-ups after a restored Article14 session and language switch, recent hint inspection, a multi-source comparison, and explicit Article19 precedence. The repeated-follow-up case failed before the fix and passed afterward. No provider or microphone observations follow from these text checks.
- Previous voice-startup commit 6268dc1 passed GitHub Actions run 37994263900. Current root verification is recorded below after the isolated checks finish. Real voice sessions, independent human reviews, source permission, and recorded demo remain open.

- Root verification passed all 88 Python tests and eight isolated offline Chrome flows, including the extended repeated-follow-up scenario. Source syntax and whitespace checks passed. Cloud execution for this new commit remains pending until push.


## Retain requested TTS models in diagnostics - 2026-10-10

- Speech success headers now declare X-TTS-Requested-Model from the same constant passed to the provider request. An isolated fake-provider HTTP check changes that constant and confirms request/header agreement. This is the requested label, not an authenticated resolved provider version.
- Schema 14 TTS groups, timing summaries, and dashboard separate requested-model identity. Missing/malformed headers and failures/stops before headers remain unknown; known labels survive later failures or stops. Browser speech remains null. A provider-free Chrome check exercises two fake model labels, missing/invalid labels, late invalid PCM, and pre/post-header cancellation, and confirms diagnostics contain no supplied text or unrelated secret header.
- Live/tutor/stop CLI readers now accept schema 14. Three synthetic compatibility checks also verify schema 13 remains accepted and schema 15/malformed records fail; the evaluation suite now runs seven checks. No real speech ratings or comparisons were generated.
- Previous context commit 7abae57 passed GitHub Actions run 37994732048. Current root checks are recorded below after their runners finish; real voice sessions, human reviews, source permission, and recorded demo remain open.

- Root verification passed 89 Python tests, nine isolated offline Chrome flows, eight mocked live-STT checks, and seven synthetic evaluation/reader checks. Syntax and whitespace checks passed. No actual provider/microphone or human-review observations were made; cloud execution of this commit remains pending until push.


## Verify protected local access - 2026-10-10

- Added five actual loopback HTTP checks using a temporary database and a controlled gate-only clock: unauthenticated requests cannot open storage, login throttling denies a seventh attempt, mutations require the bound local origin, rotated/logged-out/expired/restarted access tokens are rejected, and progress stays with its browser cookie across relogin. These are bounded local checks, not a hosted authentication audit.
- The disposable browser runner now accepts -AccessProtected, generates a throwaway password, checks owned offline-server health, and restores environment/process/database state. The protected Chrome flow checks wrong/correct login, logout, API revocation, progress retention and isolation, plus mocked pending playback cancellation before redirect. CI runs ordinary and protected modes separately.
- Root verification passed 94 Python tests, nine ordinary Chrome checks (one protected check skipped), one protected Chrome check (nine ordinary checks skipped), eight mocked live-STT checks, and seven synthetic evaluation/reader checks. No real microphone, provider calls, learner recordings, or human ratings were collected. Local login does not provide learner accounts, TLS, or hosted production readiness.
- Previous CI diagnostic commit da0c008 passed GitHub Actions run 37995717519. This change's cloud execution remains pending until push. Real multilingual voice observations, paired speech metrics, independent reviews, source permission, and the demo video remain open.


## Preserve unknown live-transcription model identity - 2026-10-10

- Official OpenAI realtime-transcription documentation confirms the existing gpt-live-transcribe languages/delay/client-turn setup (https://developers.openai.com/api/docs/guides/realtime-transcription). No provider calls were made. Inspection found diagnostics always naming that model even when capture failed before a session was obtained.
- Live attempts now begin with model=null and accept a bounded requested-model label only from a validated successful session response. Missing/malformed labels remain unknown; known labels persist through later cancellation and across reused turns. Schema 15 separates this behavior from historical hard-coded labels; live/tutor/stop readers accept it without relaxing legacy validation.
- Ten mocked live-STT checks and eight synthetic evaluation/reader checks pass, including missing/malformed labels, pre-session failure, and separate unknown/model report groups. These are metadata checks, not real speech observations. Final Python/browser verification is recorded below.
- Protected-access commit 5f56d30 passed GitHub Actions run 38002523983. Actual microphone/provider sessions, paired comparisons, human reviews, source permission, and the demo video remain pending.

- Final root verification passed 94 Python tests, nine ordinary browser checks plus one protected check in separate invocations, ten mocked live-STT checks, and eight synthetic evaluation/reader checks. Source syntax and whitespace checks passed. The first Python run exposed a speech-test assertion race: receiving the terminal HTTP chunk can precede provider context cleanup. The fake provider now signals cleanup completion, and the HTTP helper waits at most three seconds before assertions; the subsequent full suite passed. Production speech behavior was not changed by that test repair.


## Retrieve the publisher reuse policy - 2026-10-10

- Rechecked the remaining roadmap gates against tracked artifacts and private input presence without printing credentials. No configured OpenAI key or private speech-evaluation directory was present; tracked evaluation results remain constructed retrieval reports, with no real voice benchmark or demo recording found. User microphone/provider observations and independent human reviews remain necessary.
- Retrieved the Legislative Department copyright policy from its public CMS route discovered in the website frontend. The previously unreadable policy is now recorded with its page ID, modified timestamp, text-field hash, and a source link. It describes permission, attribution, accurate presentation, and third-party restrictions; it is not permission already granted to this corpus or its adaptations. No publisher message was sent and no license/clearance was assigned.
- Updated source-review documentation and the reproducible corpus manifest exporter while preserving corpus contents, original edition-review date, note check dates, and unresolved reuse status. Export/check evidence is recorded below.
- Live metadata commit 0618e3d passed GitHub Actions run 38002914451. Real voice, independent reviews, applicable reuse clearance, and the actual demonstration remain open.

- Verification: exporter JSON matches the tracked manifest exactly; all 48 document records and the corpus SHA-256 match the preceding commit. Edition-review and per-note check dates remain unchanged, policy-review date is separate, and reuse_status remains unresolved. Python syntax and git diff --check passed. No benchmark, provider, microphone, or learner-data run was performed for this documentation task.
