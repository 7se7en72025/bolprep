# BolPrep

A local Hindi, Hinglish, and English study tutor with source-backed explanations, voice input, spoken answers, and short quizzes on the Indian Constitution.

BolPrep combines a reviewed note collection, a browser voice interface, and a Python server. Text explanations and fixed quizzes work without an API key; model responses and provider speech are optional.

## Project status

The prototype implements text tutoring, three voice-input paths, progressive speech, quizzes, saved progress, and explicit conversation snapshots. Browser/device verification, current evaluation runs, human speech and scoring reviews, and a recorded demonstration remain pending. Production readiness and measured voice quality have not been established.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the acceptance audit and [ARCHITECTURE.md](ARCHITECTURE.md) for the implementation walkthrough. Historical metrics and detailed development notes are preserved in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md).

## Quick start on Windows

Requirements: Python 3.11 or newer, a modern browser, and internet access to install dependencies. Node.js is optional for diagnostic report scripts.

From the repository directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-local.ps1
```

The launcher prepares `.venv`, installs dependencies, creates `.env` if missing, and starts the server. The page validates a bounded health response before enabling provider capabilities; missing or invalid study notes return a corpus-unavailable 503. Readiness describes configuration and corpus availability, not a successful provider session. Open **http://127.0.0.1:8000**. Press **Ctrl+C** in the terminal to stop it.

Manual setup:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe server.py
```

For the terminal tutor, run `.\.venv\Scripts\python.exe bolprep.py`. Use `/new` to clear conversation context and `/quit` to leave. Select `/language hi` for Hindi/Hinglish or `/language en` for English; `/language auto` keeps model language inference and English offline fallback. Hindi/Hinglish mode uses Hindi notes for Devanagari questions and Roman Hinglish notes otherwise. Changing language keeps context, and `/new` keeps the chosen preference. Questions are limited to 1,200 Unicode code points. Context retains up to 20 messages, with answers shortened to 3,000 code points and marked when clipped; full text stays in terminal output.

## Configuration

Edit your local `.env`; keep credentials out of commits.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Optional. Enables model responses and provider speech/transcription; usage may incur charges. |
| `OPENAI_MODEL` | Requested tutor model; the example defaults to `gpt-6-astra`. |
| `BOLPREP_ACCESS_PASSWORD` | Optional 16-256 character password for the local demo gate. |
| `BOLPREP_DATABASE_PATH` | Optional SQLite path override; default: `.codex/bolprep.sqlite3`. |

Browser speech availability varies by browser and operating system. Browser speech services may use the network even without an API key.

## Try a study session

1. Choose Hindi, Hinglish, or English and ask `Explain Article 14` or `Article 21 samjhao`.
2. Read the cited note and scope limitation before relying on an explanation.
3. Type a follow-up or use a supported microphone mode. Review transcribed text when the mode offers it.
4. Start a Basic, Standard, or Challenge quiz. These select authored question pools; the labels are not measured learner difficulty.
5. Use **Listen again** for playback and **Stop** or **Escape** to cancel active speech.
6. Explicitly save a conversation to open it later in the same browser profile.

Model language following, microphone behavior, and spoken playback require observed-device verification.

## Voice paths

| Path | Behavior | Current boundaries |
| --- | --- | --- |
| Browser recognition | Browser-managed transcription for a text turn | Availability and accuracy depend on the browser/service. |
| Recorded clip | Capture a clip, then send it for provider transcription | Maximum 20 seconds and 5 MiB; transcription begins after recording. Discarding requests immediate microphone-track release; transcription response bodies are capped at 128 KiB before parsing. |
| Live microphone | WebRTC partial/final transcription, manual or quiet-pause submission | Experimental; explicit activation, bounded sessions/messages, no automatic reconnect. Malformed events close capture for explicit recovery. |
| Spoken answer | Browser synthesis or progressive provider speech | Replay and cancellation controls exist; acoustic latency and stop behavior remain unmeasured. |

Live mode offers optional continuous conversation and 3/5/8-second quiet-pause choices. Segments are bounded to 20 or 60 seconds, sessions to five minutes, and idle time to 60 seconds. Muting during turn finalization/clearing may lose words. Provider PCM response readers are released on completion, cancellation, or failure without waiting for stream cancellation. Local cancellation does not prove provider processing or billing stopped. Navigating away cancels microphone input, active tutor work, and speech queues; returning to a cached page requires a new explicit turn. Merely hiding the page stops microphone input without canceling answer playback.

## Sources and quizzes

The starter corpus contains **48 checked notes** spanning selected Articles 12-51A. It is a bounded study collection with lexical retrieval and explicit article-reference handling. Numeric references normalize Unicode decimal digits and leading zeros before lookup, including supported Latin suffixes; unknown article IDs and invalid ranges still abstain. Generic fundamental-rights requests can return the full collection; topic-qualified requests rank their subject terms instead of receiving every note solely from the broad label. It is not a complete legal reference or a demonstrated semantic-retrieval system.

- [Corpus manifest](data/corpus_manifest.json): inventory, hashes, and source metadata.
- [Source review](data/SOURCE_REVIEW.md): linked PDF edition and unresolved reuse-policy questions. Repository Hindi/Hinglish summaries are not official translations.
- [Dataset inventory](evals/DATASETS.md): constructed evaluation cases and evidence boundaries.

Quiz questions currently cover Articles 14, 19, 21, and 22. Basic selects 14/21, Challenge selects 19/22, and Standard uses the mixed pool, with up to three questions per quiz. A model tutor turn can start one successful quiz; repeated start calls receive an error instead of creating additional hidden quizzes. Failed starts may be corrected within the bounded tool loop. SQLite/file-access failures in model tools return generic failed results so the model can explain unavailable actions; they do not claim successful persistence or rollback. Offline quiz/revision requests also return a failed tool event and a recovery reply. A completed tutor reply can therefore contain failed actions; inspect tool outcomes separately. Revision tool results use the saved-progress count/topic validator, and unsupported successful tool names are rejected. Scores use authored phrase rubrics, which can misread negation and meaning. New score responses expose minimum/total rubric counts so the browser can reject inconsistent concept lists, percentages, and completion flags. Older stored results lack these counts and receive structural checks only. Human agreement has not been established.

## Saved data and local limits

Quiz results and explicitly saved conversations use local SQLite storage, scoped by a browser cookie. Scores with a matching retry key return the retained result; older migrated scores without a key reject new submissions and require a new quiz, while remaining visible in progress. This is not a learner account system; stored text is not encrypted. Losing the cookie can make earlier records inaccessible. Cookie identity and ordinary text/speech setup do not open SQLite. Quiz creation establishes its persisted owner in the same transaction; progress/quiz storage errors return a generic 503. An unavailable database can block persistence while leaving ordinary tutoring available, subject to its other dependencies. A failed response does not prove a score or deletion was rolled back; refresh saved progress before retrying.

Snapshots contain up to 20 recent messages, bounded text, citations, and supported request metadata. Audio, unsent drafts, and partial transcription deltas are not saved. Opening a snapshot cancels active work and restores context without automatically resuming a quiz or playing speech. Conversation deletion and quiz-progress deletion are separate actions.

Browser quiz-start, scoring, and progress-load responses are capped at 1 MiB before JSON parsing, with generic errors for invalid bodies. Tutor streams use strict UTF-8 decoding and release readers without waiting for stream cancellation, so damaged text cannot silently become a completed answer. Model answers and streamed text per provider response are capped at 12,000 Unicode code points, with explicit failure rather than silent truncation. Offline note summaries are separate; this limit is not a provider billing cap. The server has request-size limits, shared in-memory rate limits, and four concurrent slots for expensive requests. These controls are not per-account budgets or billing caps. The optional password gate does not provide hosted authentication, TLS, or production access controls.

## Evaluation and diagnostics

The page exposes request diagnostics and exports for local review. Software timings do not measure audible latency, and token counts are not cost estimates. Saved request metadata is client-supplied and is not authenticated provenance. Tutor traces distinguish the requested model from provider-reported model IDs for each completed response/tool round; missing IDs remain unavailable. Report groups preserve this ordered list. Returned IDs may still be aliases, not immutable model versions, and speech models are outside these tutor traces.

| Artifact | Purpose |
| --- | --- |
| [Voice run sheet](evals/voice-run-sheet.md) | Manual browser/device scenarios and observations to collect. |
| [TTS rubric](evals/TTS_RUBRIC.md) | Listener ratings for spoken output. |
| [Quiz review rubric](evals/QUIZ_REVIEW_RUBRIC.md) | Compare fixed scores with human judgments. |
| [Answer support rubric](evals/ANSWER_SUPPORT_RUBRIC.md) | Review actual claims, provided notes, displayed sources, and abstentions; no reviews collected. |
| [Demo outline](DEMO_SCRIPT.md) | Reproducible demonstration plan; no completed video is claimed. |

Retrieval evaluation commands:

```powershell
.\.venv\Scripts\python.exe evals/run_retrieval_eval.py
.\.venv\Scripts\python.exe evals/run_retrieval_eval.py --compare
```

Reports include dataset/corpus hashes, retrieval/evaluator source hashes, Python version, scorer, and UTC generation time. Code or input changes invalidate a comparison; archive the actual JSON and repository commit when running an authorized evaluation. These are instructions, not evidence of a fresh run. Older constructed-set results in the archive predate retrieval changes and do not establish learner or voice quality. Current local test and evaluation execution remains pending explicit verification authorization.

## Repository map

| Path | Responsibility |
| --- | --- |
| `server.py` | Local HTTP API and request controls. |
| `bolprep.py` | Terminal tutor. |
| `conversation_history.py` | Bounded context and article hints. |
| `session_history.py` | Explicit conversation snapshot storage. |
| `quiz.py` | Question selection and fixed scoring. |
| `data/` | Study notes, question data, and source records. |
| `evals/` | Datasets, report scripts, and manual rubrics. |
| `tools/` | Local startup and bounded repository-work helpers. |

## Bounded repository work

The Codex CLI work-loop helper requires an installed, signed-in CLI and a machine that stays awake. It runs a hidden local worker without creating a scheduled task; unattended completion is not guaranteed.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-work-loop.ps1 -DurationHours 8 -MaxRuns 24
```

Request a stop after the current task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\stop-work-loop.ps1
```

See [AUTONOMOUS_WORK.md](AUTONOMOUS_WORK.md) for work boundaries and [learning-log.md](learning-log.md) for completed changes. These scripts do not indicate that a work loop is currently running.
