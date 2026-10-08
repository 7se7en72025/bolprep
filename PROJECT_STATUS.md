# Roadmap acceptance audit

Audit date: 2026-10-08. This is an implementation/evidence inventory, not a release sign-off. **The full project is not proven complete.** Source files show what is implemented; syntax checks and procedure documents cannot establish browser, device, provider, or measurement behavior.

## Phase gates

| Roadmap requirement | Current evidence | Remaining proof or work |
| --- | --- | --- |
| One microphone session completes STT → LLM → TTS | Recorded/live input and response playback code in `web/app.js`, `web/live-stt.js`, `server.py` | Observe a configured end-to-end session on an actual device. |
| Hindi, English, Hinglish conversations work | Checked translations, response-language preferences, multilingual speech controls | Actual conversations/transcripts/playback in all three categories. |
| Transcripts, failures, stage timings visible | Draft/partial controls and page diagnostics | Browser rendering and real failure/timing observations. |
| Ordinary-pause end-of-turn handling | Energy-based activity/quiet-pause controls and capture limits | Natural-pause/noise/device observations; thresholds remain heuristic. |
| Interruption stops playback and cancels old turn | Stop/Escape/controller cleanup and history notes | Audible stop and provider behavior; client abort does not prove upstream cancellation. |
| Late results cannot restart interrupted output | Turn/capture identities and cleanup guards | Automated race coverage plus actual browser/device recovery checks. |
| Multi-turn clarification retains context | Current-topic retrieval, bounded text history, quiz article hints | Language-switch/quiz/cancellation/reopened-session scenarios. |
| Answers show supporting sources | Retrieval/source-link code and checked note metadata | Human citation-support review of actual generated answers; retrieval alone is not support. |
| Unsupported questions clarify or abstain | Lexical eligibility and insufficient-evidence paths | Current labeled evaluation and actual model behavior on unsupported questions. |
| Spoken quiz, rubric feedback, persistent progress work end to end | Quiz, SQLite progress/history, browser controls | Complete spoken quiz, restart persistence, ownership, deletion, and retry recovery. |
| Tool validation/retry checks protect progress | Existing agent/progress unit-test sources and storage validation | Run authorized tests; extend coverage for newer features and concurrency. |
| Versioned inputs/reproducible runners exist | Tracked retrieval set, speech/review procedures and local runners | Artifacts exist; current computations and reproducibility remain unverified. |
| STT/TTS comparisons, latency distributions, failure examples reported | Collection/run-sheet/report tools | Actual paired observations and archived reports; no fabricated samples. |
| Retrieval, answer support, tool behavior have labeled checks | Constructed retrieval labels and existing mocked tool tests | Fresh retrieval comparison, generated-answer support labels, current tool coverage. |
| Human speech/quiz reviews documented | Versioned TTS/quiz review procedures | Actual independent reviews, disagreements, coverage, and measured reports. |
| Accessible working demo and setup | Local startup scripts, README, `.env.example` | Fresh local/browser run; any hosted demo needs a separate concrete deployment decision. |
| README architecture, limits, actual benchmarks, reproduction | Architecture/setup/limits and historical constructed retrieval figures | Archive and identify current benchmark configurations/hashes; real voice results missing. |
| Short recorded demo demonstrates full flow | `DEMO_SCRIPT.md` outline | Actual video showing observed Hinglish speech, interruption, sources, tools, diagnostics. |
| Technical walkthrough explains tradeoffs and a failure-led improvement | ARCHITECTURE.md maps current paths/tradeoffs and the reviewed Article 14 alias defect | Written implementation artifact exists; the defect is static reasoning, and current runtime/video evidence is still missing. |

## Other first-release gaps

- The quiz API/tool now accepts a difficulty preset selecting author-assigned Basic/Standard/Challenge question groups. Rubrics remain fixed; measured learner difficulty, selection runtime, and model argument compliance are unverified.
- Progress saving is consolidated into scoring, rather than a separate exposed `save_progress` model tool. The local flow is a deliberate prototype shape, not evidence of every roadmap tool signature.
- Local cookie ownership and optional shared demo login are implemented; separate authenticated learner accounts and hosted budgets/deployment hardening are pending.
- Request metadata records configured and provider-reported tutor model IDs per response, plus reported usage; provider IDs may still be aliases and do not guarantee immutable model versions or monetary cost. Speech model provenance and runtime verification remain pending. Saved metadata is client-supplied, not an authenticated server trace store.
- Short notes and lexical matching are implemented; generated-answer support review, measured quiz-scoring agreement, and applicable source reuse permission remain open; data/SOURCE_REVIEW.md records edition evidence and the unresolved policy retrieval.

## Named deliverables

| Deliverable | Evidence / status |
| --- | --- |
| Repository, reproducible setup, secret-free `.env.example` | Tracked source/setup files exist; setup runtime needs fresh proof. |
| Curated corpus manifest and dataset documentation | `data/corpus_manifest.json` and `evals/DATASETS.md`; inventory generation validates local records, not source accuracy/rights. |
| Automated interruption/tool/retrieval/persistence checks | Existing Python tests cover portions of tools, retrieval, quiz, and progress. No tracked browser interruption suite or newer history/report coverage was found in this audit. No tests were run. |
| Benchmark report with measured results/configuration/failures | Historical constructed-text results are preserved in IMPLEMENTATION_NOTES.md; no tracked current voice benchmark report was found. |
| Demo video and architecture walkthrough | DEMO_SCRIPT.md outline and ARCHITECTURE.md walkthrough exist; no completed demo-video artifact was found. |

## Next evidence to collect

First run the existing local tests and provider-free smoke/evaluation checks when explicitly requested, then address failures and missing coverage. Browser/microphone checks, configured provider behavior, human ratings, and recording remain separate gates. Test runs were not requested during this audit; no tests were added or run. Existing manual procedures cover these checks, but their presence does not prove a pass. Preserve this audit's scope when updating status: a green narrow check must not be used to mark a whole phase complete.
