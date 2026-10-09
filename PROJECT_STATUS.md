# Roadmap acceptance audit

Audit updated: 2026-10-10. This is an implementation/evidence inventory, not a release sign-off. **The full project is not proven complete.** Source files show what is implemented; syntax checks and procedure documents cannot establish browser, device, provider, or measurement behavior.

## Phase gates

| Roadmap requirement | Current evidence | Remaining proof or work |
| --- | --- | --- |
| One microphone session completes STT → LLM → TTS | Recorded/live input and response playback code in `web/app.js`, `web/live-stt.js`, `server.py` | Observe a configured end-to-end session on an actual device. |
| Hindi, English, Hinglish conversations work | Checked translations, response-language preferences, multilingual speech controls | Actual conversations/transcripts/playback in all three categories. |
| Transcripts, failures, stage timings visible | Draft/partial controls and page diagnostics | Browser rendering and real failure/timing observations. |
| Ordinary-pause end-of-turn handling | Energy-based activity/quiet-pause controls and capture limits | Natural-pause/noise/device observations; thresholds remain heuristic. |
| Interruption stops playback and cancels old turn | Stop/Escape/controller cleanup and history notes | Audible stop and provider behavior; client abort does not prove upstream cancellation. |
| Late results cannot restart interrupted output | Turn/capture identities and cleanup guards | Automated delayed-turn, speech callback, recorded-input, and continuous-quiz recovery checks pass; actual browser/device acoustic recovery still needs observation. |
| Multi-turn clarification retains context | Current-topic retrieval, bounded text history, single-source tutor/quiz article hints | Offline saved-session language switching and six consecutive generic follow-ups pass in Chrome; explicit new articles take precedence and multi-source replies add no single-article hint. Actual spoken quiz/context scenarios remain unobserved. |
| Answers show supporting sources | Retrieval/source-link code and checked note metadata | Human citation-support review of actual generated answers; retrieval alone is not support. |
| Unsupported questions clarify or abstain | Lexical eligibility and insufficient-evidence paths | Constructed retrieval labels pass; actual model behavior on unsupported questions still needs observation. |
| Spoken quiz, rubric feedback, persistent progress work end to end | Quiz, SQLite progress/history, browser controls | Complete spoken quiz, restart persistence, ownership, deletion, and retry recovery. |
| Tool validation/retry checks protect progress | Passing agent/progress/HTTP tests cover ownership, retries, model-completion guards, and server-bound learner scoring | Bounded concurrent HTTP retries, delete-before-save, eight-worker legacy initialization, and migration rollback are checked locally. Real provider tool arguments, longer contention, and other concurrency schedules remain unverified. |
| Versioned inputs/reproducible runners exist | Tracked retrieval set, speech/review procedures and local runners | Local retrieval and speech-plan/export checks pass with frozen inputs and hashes; real speech comparisons remain unmeasured. |
| STT/TTS comparisons, latency distributions, failure examples reported | Collection/run-sheet/report tools | Actual paired observations and archived reports; no fabricated samples. |
| Retrieval, answer support, tool behavior have labeled checks | Constructed retrieval labels, existing mocked tool tests, and ANSWER_SUPPORT_RUBRIC.md procedure with a local label summarizer | Constructed retrieval comparison and current tool checks pass; actual generated-answer/support labels and reports remain absent. |
| Human speech/quiz reviews documented | Versioned TTS/quiz review procedures | Actual independent reviews, disagreements, coverage, and measured reports. |
| Accessible working demo and setup | Local startup scripts, README, `.env.example` | Pinned Windows setup and offline Chrome runs pass; hosted access still needs a concrete deployment decision. |
| README architecture, limits, actual benchmarks, reproduction | Architecture/setup/limits and historical constructed retrieval figures | Current constructed retrieval reports with exact hashes and reproduction commands are archived; real voice results and independent answer-quality evidence remain missing. |
| Short recorded demo demonstrates full flow | `DEMO_SCRIPT.md` outline | Actual video showing observed Hinglish speech, interruption, sources, tools, diagnostics. |
| Technical walkthrough explains tradeoffs and a failure-led improvement | ARCHITECTURE.md maps current paths/tradeoffs and the reviewed Article 14 alias defect | Written walkthrough and failed-before/passed-after browser defect evidence exist; actual voice-video evidence is still missing. |

## Other first-release gaps

- The quiz API/tool now accepts a difficulty preset selecting author-assigned Basic/Standard/Challenge question groups. Rubrics remain fixed; measured learner difficulty, selection runtime, and model argument compliance are unverified.
- Model tools now separate `score_answer` previews from `save_progress`. Saves accept only same-turn server-issued score IDs and server-held rubric results, with safe repeated saves and verified narration. Direct quiz forms still score and save together. Mocked model rounds and actual SQLite checks establish local behavior; real provider tool selection remains unverified.
- Local cookie ownership and optional shared demo login are implemented and checked through actual loopback HTTP and protected offline Chrome. Throttling, token rotation/expiry/restart, logout/relogin progress retention, and browser isolation pass; speech cleanup uses mocked playback. Separate authenticated learner accounts and hosted budgets/deployment hardening are pending.
- Request metadata records configured and provider-reported tutor model IDs per response, plus reported usage; provider IDs may still be aliases and do not guarantee immutable model versions or monetary cost. Recorded STT and streamed TTS diagnostics retain requested model labels when supplied; resolved speech versions and runtime verification remain pending. Saved conversation metadata is client-supplied; a separate opt-in server-owned tutor trace store now retains allowlisted metadata with cookie-scoped read/delete, a 100-row cap, and seven-day pruning on access.
- Short notes and lexical matching are implemented; generated-answer support review, measured quiz-scoring agreement, and applicable source reuse permission remain open; data/SOURCE_REVIEW.md records edition evidence and the unresolved policy retrieval.

## Named deliverables

| Deliverable | Evidence / status |
| --- | --- |
| Repository, reproducible setup, secret-free `.env.example` | Fresh pinned Windows/CPython 3.11 installation and pip check pass; local Python/HTTP/browser checks pass. Other platforms and provider/audio paths need proof. |
| Curated corpus manifest and dataset documentation | `data/corpus_manifest.json` and `evals/DATASETS.md`; inventory generation validates local records, not source accuracy/rights. |
| Automated interruption/tool/retrieval/persistence checks | Existing Python tests cover portions of tools, retrieval, quiz, and progress. Added headless Chrome text-turn cancellation/save-open/quiz/diagnostics coverage plus mocked live-STT/speech cancellation checks. Local checks were run; real microphone/acoustic races remain unverified. |
| Benchmark report with measured results/configuration/failures | Current before/after constructed retrieval reports are archived in evals/reports; real voice benchmark results remain absent. |
| Demo video and architecture walkthrough | DEMO_SCRIPT.md outline and ARCHITECTURE.md walkthrough exist; no completed demo-video artifact was found. |

## Next evidence to collect

Latest local verification passes 94 Python tests, nine ordinary offline headless Chrome flows plus one protected flow across two separate runner invocations, ten mocked live-STT checks, and four synthetic TTS report checks plus four diagnostics-reader checks. New coverage includes separate score/save rounds, forged or altered save rejection, ownership checks before grading, failure traces after successful saves, server-owned diagnostic retention, saved-context language switching, and paired speech-plan/export validation. The earlier temporary-server smoke and 180-case constructed retrieval comparison also passed; these remain provider-free evidence. A push/PR CI workflow now repeats the provider-free checks; the first cloud run for a7f2898 passed (GitHub run 37810436397). See README verification commands and evals/reports/README.md for scope and denominators. Browser/microphone checks, configured provider behavior, human ratings, and recording remain separate gates. The earlier static audit predates these authorized runs; row-level missing browser/device/measurement gates still require their stated evidence. Existing manual procedures cover these checks, but their presence does not prove a pass. Preserve this audit's scope when updating status: a green narrow check must not be used to mark a whole phase complete.
