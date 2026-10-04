# BolPrep

BolPrep is a beginner-built portfolio project for learning how to make a Hindi and Hinglish voice study tutor. Its first topic is Indian Polity, starting with Fundamental Rights.


## Current status

**Implemented:** Step 0's fixed-answer Python exercise and a local browser tutor prototype. It accepts typed questions, can use a configured OpenAI model through a small Python server, and speaks answers with the browser's built-in speech synthesis. Where the browser supports it, speech recognition can fill the question box. Without an API key, the tutor starts in a clearly labeled offline mode.

**Not implemented yet:** verified retrieval, quiz tools, progress storage, streaming voice, robust interruption/cancellation at the model provider, and benchmarks. Browser speech recognition support varies by browser and device. There are no measured voice-quality or latency results, and the tutor has no checked study corpus or source citations.

For the original input/function/output exercise, see [step0.py](step0.py). For the current learning notes, see [learning-log.md](learning-log.md).

## Run the text tutor

Requires Python 3.11 or later. From the project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Put your API key in `.env` to enable model answers. Keep that file private; it is excluded from Git. The default model can be changed with `OPENAI_MODEL` in `.env`. Start the local server, then open its address in a browser:

```powershell
python server.py
```

Open <http://127.0.0.1:8000>. The server binds to localhost and keeps the model key on the server. Browser microphone permission is requested only after you click **Speak**. Press Ctrl+C to stop the web server.

Without an API key, the tutor starts in offline practice mode and clearly says it cannot generate an answer. Type `/quit` to leave. The smaller Step 0 example can still be run with:

```powershell
python step0.py
```

## Continue repo work in the background

With the Codex CLI installed and signed in, start the bounded roadmap loop:

```powershell
.\tools\start-work-loop.ps1
```

By default it runs for up to eight hours and up to four focused tasks, spaced across that window. Each run uses the Codex CLI's workspace-write auto-approval mode, checks the repository roadmap, verifies its change locally, and may create a local commit. It does not push or publish changes. The loop retries failed CLI runs with a capped delay and stops when a task reports that it needs your input. Use `tools\stop-work-loop.ps1` to request a graceful stop after the current task. Status and per-run logs go under `.codex\overnight\`, which Git ignores. The task boundaries are in [AUTONOMOUS_WORK.md](AUTONOMOUS_WORK.md).

## Intended voice tutor

The planned end-to-end experience is a student asking in Hindi, English, or Hinglish for a short explanation, then asking the tutor to quiz them. The target system will speak its answer, ground explanations in a small checked corpus, score spoken answers against a rubric, and save progress.

A central voice-engineering challenge is interruption handling. When a student speaks while audio is playing, the tutor should stop playback, cancel the old generation, preserve conversation context, and ignore late results from the interrupted turn. The project also aims to compare speech configurations on the same examples and report measured quality and latency, including failure cases.

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

The current prototype uses a Python standard-library HTTP server and plain HTML, CSS, and JavaScript. OpenAI Responses API is the optional text model; speech recognition and speech synthesis use browser-provided features. This keeps setup small while making browser and device support a known limitation. A database and streaming speech providers remain future choices; compare language support, streaming behavior, quality, and cost before selecting them.

## Roadmap

1. **Text tutor:** first local prototype is implemented; improve prompt behavior and add checked study sources.
2. **TTS output:** browser speech synthesis is wired to answers; compare Hindi, English, and Hinglish pronunciation and consider streaming TTS.
3. **STT input:** browser speech recognition is an optional transcript helper; compare Hindi, English, and Hinglish transcripts and provide a robust backend option.
4. **Browser prototype:** improve interaction states and check behavior across supported browsers and devices.
5. **Grounded answers:** retrieve checked notes with source metadata and indicate when evidence is insufficient.
6. **Quiz tools and progress:** implement validated quiz/scoring tools and idempotent progress storage.
7. **Live turn-taking:** stream speech, support interruptions and cancellation, and reject stale turn events.
8. **Evaluation:** compare configurations on documented examples; report language-specific errors, TTS listener feedback, p50/p95 latency, and failures.
9. **Portfolio demo:** document setup, architecture, limitations, measured results, and a short walkthrough.

Each phase should be small enough to run, inspect, and explain before moving on. The next task is to try the browser tutor in Hindi, English, and Hinglish, then begin a small checked study corpus for grounded answers.

## Portfolio context

This project is planned as an end-to-end application counterpart to the author's Speak AI contributions. The preparation notes in [BOLPREP.md](../Chronicle/BOLPREP.md) list five related pull requests: #148 (TTS language/engine tiers), #151 (startup, normalization, and code-switching), #152 (speech evaluation), #153 (downloads and offline model handling), and #154 (tests and CI). Those notes record that the pull requests were open when checked on 2026-10-03. Confirm current status and describe personal contributions accurately before using them in an application; this repository does not validate their implementation details or results.

The intended story is to pair multilingual speech infrastructure work with a separately built, evaluated conversational tutor. That story is a direction for the portfolio, not a claim that this app or its voice benchmarks are complete.

## Development notes

- Keep provider credentials on the server and out of Git.
- Use consented, legally usable study material and evaluation recordings.
- Document the evaluation sample, configuration, results, and known limitations.
- Add features incrementally and record experiments in [learning-log.md](learning-log.md).
