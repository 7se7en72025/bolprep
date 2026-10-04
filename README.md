# BolPrep

BolPrep is a beginner-built portfolio project for learning how to make a Hindi and Hinglish voice study tutor. Its first topic is Indian Polity, starting with Fundamental Rights.


## Current status

**Implemented:** Step 0, a small Python program with a function that accepts a question and returns a fixed practice answer. It demonstrates strings, parameters, return values, lists, and loops.

**Not implemented yet:** an LLM connection, STT, TTS, browser app, retrieval, quiz tools, database, and benchmarks. There are no measured voice-quality or latency results yet.

The code is deliberately small so each feature can be built and understood in sequence. For the current learning notes and next task, see [learning-log.md](learning-log.md) and the exercise in [step0.py](step0.py).

## Run the current exercise

Requires Python 3. The current exercise uses only the standard library and needs no API key.

```powershell
python step0.py
```

It prints three different questions and the same fixed answer for each. That is expected: the function currently accepts the input but does not interpret its meaning.

## Intended voice tutor

The planned end-to-end experience is a student asking in Hindi, English, or Hinglish for a short explanation, then asking the tutor to quiz them. The target system will speak its answer, ground explanations in a small checked corpus, score spoken answers against a rubric, and save progress.

A central voice-engineering challenge is interruption handling. When a student speaks while audio is playing, the tutor should stop playback, cancel the old generation, preserve conversation context, and ignore late results from the interrupted turn. The project also aims to compare speech configurations on the same examples and report measured quality and latency, including failure cases.

## Planned architecture

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

React/TypeScript, a Python backend, and PostgreSQL are proposed starting points, not implemented choices. STT and TTS providers have not been selected. Provider selection will follow a small comparison of current language support, streaming behavior, quality, and cost.

## Roadmap

1. **Text tutor:** connect a server-side LLM API, retain conversation context, and handle errors clearly.
2. **TTS output:** synthesize the text response and listen for Hindi, English, and Hinglish pronunciation issues.
3. **STT input:** transcribe short Hindi, English, and Hinglish recordings; inspect and record transcription errors.
4. **Browser prototype:** add microphone controls, transcript, response playback, and request status.
5. **Grounded answers:** retrieve checked notes with source metadata and indicate when evidence is insufficient.
6. **Quiz tools and progress:** implement validated quiz/scoring tools and idempotent progress storage.
7. **Live turn-taking:** stream speech, support interruptions and cancellation, and reject stale turn events.
8. **Evaluation:** compare configurations on documented examples; report language-specific errors, TTS listener feedback, p50/p95 latency, and failures.
9. **Portfolio demo:** document setup, architecture, limitations, measured results, and a short walkthrough.

Each phase should be small enough to run, inspect, and explain before moving on. The next task is to explain the Step 0 input/function/output flow, then continue to the text tutor.

## Portfolio context

This project is planned as an end-to-end application counterpart to the author's Speak AI contributions. The preparation notes in [BOLPREP.md](../Chronicle/BOLPREP.md) list five related pull requests: #148 (TTS language/engine tiers), #151 (startup, normalization, and code-switching), #152 (speech evaluation), #153 (downloads and offline model handling), and #154 (tests and CI). Those notes record that the pull requests were open when checked on 2026-10-03. Confirm current status and describe personal contributions accurately before using them in an application; this repository does not validate their implementation details or results.

The intended story is to pair multilingual speech infrastructure work with a separately built, evaluated conversational tutor. That story is a direction for the portfolio, not a claim that this app or its voice benchmarks are complete.

## Development notes

- Keep provider credentials on the server and out of Git.
- Use consented, legally usable study material and evaluation recordings.
- Document the evaluation sample, configuration, results, and known limitations.
- Add features incrementally and record experiments in [learning-log.md](learning-log.md).
