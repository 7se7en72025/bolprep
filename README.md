# BolPrep

BolPrep is a beginner-built portfolio project for learning how to make a Hindi and Hinglish voice study tutor. Its first topic is Indian Polity, starting with Fundamental Rights.


## Current status

**Implemented:** Step 0's fixed-answer Python exercise and a local browser tutor prototype. It accepts typed questions, retrieves a matching note from a checked six-article corpus, links the Constitution source, can use a configured OpenAI model through a small Python server, and speaks answers with the browser's built-in speech synthesis, with a selectable, previewable installed voice when the browser exposes one for the chosen language; speech language and per-language voice preferences are saved in browser storage. Where the browser supports it, speech recognition can fill the question box. The quiz uses checked questions and deterministic rubric scoring, saves progress locally, and exposes quiz and weak-topic functions to the optional Responses API tool loop. Without an API key, the tutor remains usable in a clearly labeled offline mode, including English, Devanagari Hindi, and Roman Hinglish notes.

**Not implemented yet:** streamed voice, robust interruption/cancellation at the model provider, and speech quality benchmarks or aggregated latency results. The browser displays speech-start delay and playback duration for each utterance as diagnostic timings only. Quiz scoring matches rubric phrases and does not interpret meaning. The Responses API tool loop has mocked tests but has not been exercised against a live model; model mode needs the optional SDK and an API key. Browser speech recognition and installed Hindi/English speech voices vary by browser and device; the UI reports per-page STT time-to-first-final p50/p95 and failed/empty attempt counts by language, plus TTS p50/p95 start and playback timings by language, voice, and sample type with failure counts for each group. These browser diagnostics reset on reload, retain at most 500 successful timing samples and 500 failure records for each speech direction in page memory, and do not store speech text or audio or measure pronunciation quality. When speech playback is unavailable, the answer stays readable on screen. The starter corpus covers Articles 14, 15, 16, 19, 21, and 21A; unsupported questions should receive an insufficient-evidence response.

For the original input/function/output exercise, see [step0.py](step0.py). For the current learning notes, see [learning-log.md](learning-log.md).

## Run the text tutor

On Windows with Python 3.11 or later (`python` or the Windows `py` launcher), start the complete local setup with one command from the project folder:

```powershell
.\tools\run-local.ps1
```

The launcher creates `.venv` if needed, installs `requirements.txt`, copies `.env.example` to `.env` only when `.env` does not already exist, and starts the server. Open <http://127.0.0.1:8000>; press Ctrl+C in PowerShell to stop. Add an API key to `.env` before starting if you want model answers. Offline mode works without a key.

For manual setup, create and activate the environment, then install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Put your API key in `.env` to enable model answers. Keep that file private; it is excluded from Git. The default model can be changed with `OPENAI_MODEL` in `.env`. Start the local server, then open its address in a browser:

```powershell
python server.py
```

Open <http://127.0.0.1:8000>. The server binds to localhost and keeps the model key on the server. Browser microphone permission is requested only after you click **Speak**. While listening, the same button changes to **Stop** so you can end capture without sending the transcript; you can review the text before submitting it. Press Ctrl+C to stop the web server.

Without an API key, the tutor returns matching local study-note summaries and source links; it labels these as notes rather than generated explanations. Questions outside the six-note corpus receive an insufficient-evidence response. The smaller Step 0 example can still be run with:

```powershell
python step0.py
```

## Continue repo work in the background

With the Codex CLI installed and signed in, start the bounded roadmap loop:

```powershell
.\tools\start-work-loop.ps1
```

By default it runs for up to eight hours and up to 24 focused tasks, spaced about 20 minutes apart. Each run uses the Codex CLI's workspace-write auto-approval mode, checks the repository roadmap, verifies its change locally, and may create a local commit. It does not push or publish changes. Failed CLI invocations are retried on the next loop pass with a capped delay. The runner checks for stop requests at least every 30 seconds while waiting and stops when a task reports that it needs your input. Use `tools\stop-work-loop.ps1` to request a graceful stop after the current task. Status and per-run logs go under `.codex\overnight\`, which Git ignores. The task boundaries are in [AUTONOMOUS_WORK.md](AUTONOMOUS_WORK.md).

## Intended voice tutor

The planned end-to-end experience is a student asking in Hindi, English, or Hinglish for a short explanation, then asking the tutor to quiz them. The target system will speak its answer, ground explanations in a small checked corpus, score spoken answers against a rubric, and save progress.

A central voice-engineering challenge is interruption handling. When a student speaks while audio is playing, the tutor should stop playback, cancel the old generation, preserve conversation context, and ignore late results from the interrupted turn. The current client keeps an interrupted pending question with an explicit interruption note for the next turn; provider-side generation cancellation remains incomplete. The project also aims to compare speech configurations on the same examples and report measured quality and latency, including failure cases.

## Target architecture

```text
Browser microphone
  -> speech detection and STT
  -> turn controller
  -> LLM with retrieved study material and validated tools
  -> streaming TTS
  -> browser playback

Backend -> session and progress storage, trace events
Evaluation runner -> fixed examples, comparisons, and reports
```

The current prototype uses a Python standard-library HTTP server and plain HTML, CSS, and JavaScript. OpenAI Responses API is the optional text model; speech recognition and speech synthesis use browser-provided features. This keeps setup small while making browser and device support a known limitation. SQLite stores local quiz progress; streaming speech providers remain future choices. Compare language support, streaming behavior, quality, and cost before selecting them.

## Starter study corpus

The starter corpus contains short summaries for Articles 14, 15, 16, 19, 21, and 21A, each with article-level source metadata. The source is the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-04. The corpus loader rejects duplicate note IDs and missing or invalid source check dates. Retrieval uses keyword overlap with a guarded boost for an explicitly named article number. Hindi and Hinglish aliases are included. Run `python evals/run_retrieval_eval.py` for the labeled text baseline. It contains 26 constructed English, Hindi, and Hinglish examples; this is a small regression set, not a measure of real learner or speech performance.

```powershell
python evals/run_retrieval_eval.py
```

## Saved quiz progress

Quiz scores are stored in a local SQLite database at `.codex/bolprep.sqlite3`, scoped to a random, HttpOnly browser cookie. Progress survives a server restart in the same browser. The app saves scores and rubric feedback, not the learner's raw answer text. A per-answer idempotency key makes network retries safe without retaining the answer or its hash. The **Saved progress** panel shows recent weak question areas; **Clear saved progress** deletes records for that browser cookie. This is a local prototype bound to `127.0.0.1`, not a multi-user hosted service with account authentication. Keep the cookie private on shared computers; deleting site cookies creates a new, separate progress history.

## Roadmap

1. **Text tutor:** first local prototype is implemented; improve prompt behavior and expand the checked study corpus.
2. **TTS output:** browser speech synthesis is wired to answers; compare Hindi, English, and Hinglish pronunciation and consider streaming TTS.
3. **STT input:** browser speech recognition is an optional transcript helper; compare Hindi, English, and Hinglish transcripts and provide a robust backend option.
4. **Browser prototype:** improve interaction states and check behavior across supported browsers and devices.
5. **Grounded answers:** lexical retrieval, source links, and an insufficient-evidence response are implemented for six articles; continue expanding coverage and evaluate retrieval quality.
6. **Quiz tools and progress:** deterministic quiz/scoring tools, local session-scoped idempotent progress storage, and a Responses API tool loop are implemented; run a live model tool-call session when an API key is available.
7. **Live turn-taking:** stream speech, support interruptions and cancellation, and reject stale turn events.
8. **Evaluation:** compare configurations on documented examples; report language-specific errors, TTS listener feedback, p50/p95 latency, and failures.
9. **Portfolio demo:** document setup, architecture, limitations, measured results, and a short walkthrough.

Each phase should be small enough to run, inspect, and explain before moving on. Next, exercise the tutor's Hindi and English speech in a supported browser, continue expanding the checked corpus, and verify model-selected tool calls with a configured key.

## Portfolio context

This project is planned as an end-to-end application counterpart to the author's Speak AI contributions. The preparation notes in [BOLPREP.md](../Chronicle/BOLPREP.md) list five related pull requests: #148 (TTS language/engine tiers), #151 (startup, normalization, and code-switching), #152 (speech evaluation), #153 (downloads and offline model handling), and #154 (tests and CI). Those notes record that the pull requests were open when checked on 2026-10-03. Confirm current status and describe personal contributions accurately before using them in an application; this repository does not validate their implementation details or results.

The intended story is to pair multilingual speech infrastructure work with a separately built, evaluated conversational tutor. That story is a direction for the portfolio, not a claim that this app or its voice benchmarks are complete.

## Development notes

- Keep provider credentials on the server and out of Git.
- The optional function-call loop follows the [OpenAI function-calling guide](https://developers.openai.com/api/docs/guides/function-calling); local tests use a mocked Responses client and do not spend API credits.
- Use consented, legally usable study material and evaluation recordings.
- Document the evaluation sample, configuration, results, and known limitations.
- Use the [browser voice run sheet](evals/voice-run-sheet.md) for repeatable manual STT/TTS checks; its timing and listener notes are diagnostics, not broad performance claims.
- TTS timing summaries include failed browser playback events grouped by language, voice, and sample type. Counts and timings stay in page memory and clear on reload; failure details, speech text, and audio are not retained.
- STT timing summaries include failed or empty recognition attempts grouped by language. Deliberate stops and language-change cancellations are excluded; transcript text is not retained by the metrics.
- The microphone control switches to **Stop** while recognition is active, so learners can end capture and review the transcript before sending it.
- Active microphone capture also has a visible color state and an `aria-pressed` value for assistive technology.
- Speech transcripts over the active question or quiz-answer limit stay visible for editing; submission now explains the limit instead of sending a request the server will reject.
- If a learner stops a pending model turn, the client keeps its question and a clear interruption note in the bounded history so follow-ups retain the topic; this does not cancel model generation at the provider.
- Add features incrementally and record experiments in [learning-log.md](learning-log.md).
