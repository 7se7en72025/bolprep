# BolPrep

BolPrep is a beginner-built portfolio project for learning how to make a Hindi and Hinglish voice study tutor. Its first topic is Indian Polity, starting with Fundamental Rights.


## Current status

**Implemented:** Step 0's fixed-answer Python exercise and a local browser tutor prototype. It accepts typed questions, retrieves a matching note from a checked thirty-eight-note corpus, links the Constitution source, can use a configured OpenAI model through a small Python server, and speaks answers with the browser's built-in speech synthesis, with a selectable, previewable installed voice when the browser exposes one for the chosen language, or with optional streamed OpenAI speech using one of 13 selectable provider voices when enabled; speech language and per-language voice preferences are saved in browser storage. Where the browser supports it, speech recognition can fill the question box; late events from a canceled listening session are ignored, editing the question box stops active recognition so it cannot overwrite the edit, and a later interim result or error does not replace a final transcript or its ready status. A recognition error also releases the Speak control immediately and counts a failed attempt once. When configured, a separate Record control can capture up to 20 seconds and send it for server-side transcription; the same control can cancel capture while microphone access is pending or cancel transcription; the speech language is captured when recording starts and stays fixed for that clip, the editable transcript is shown before submission, editing the question box cancels recording or pending transcription so it cannot replace typed text, and BolPrep does not save the audio. Submitting a question cancels an unfinished recording or transcription so a late transcript cannot overwrite the composer. The quiz uses checked questions and deterministic rubric scoring, saves progress locally, and exposes quiz and weak-topic functions to the optional Responses API tool loop. Without an API key, the tutor remains usable in a clearly labeled offline mode, including English, Devanagari Hindi, and Roman Hinglish notes. Offline quiz and revision commands also recognize the Hindi cues `क्विज`, `कमजोर`, and `दोहरा`.

For browser speech, long answers are split at sentence boundaries and, for long sentences, at word or character boundaries before being queued as utterances. This browser path is not streamed; the optional server speech path streams audio chunks.

Submitting a typed follow-up stops any current browser or streamed speech playback as the new request starts, so queued audio does not continue while the tutor is thinking. Canceling quiz preparation re-enables the quiz button, while a late canceled request cannot re-enable it during a newer quiz request. Stopping between quiz questions keeps the next question available; canceling or failing to start a replacement quiz restores it. A successful replacement quiz clears the previous answer draft, and completing a quiz restores the question length limit. Browser and device behavior should still be checked with the turn-taking run sheet.

**Experimental:** when an API key is configured, the tutor can stream OpenAI-generated PCM speech from the server to the browser and choose among 13 built-in voices. The [official TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech) documents streaming and Hindi support, and notes that built-in voices are optimized for English. The text answer is still generated before speech starts, and usage may be billed. Hindi is listed as supported, but built-in TTS voices are optimized for English, so Hindi/Hinglish pronunciation has not been evaluated. Browser speech remains available as the default and fallback. A configured API key also enables optional recorded-file transcription; recordings are sent only after the user stops, and no audio is saved by BolPrep. This is a bounded upload, not live STT. In model mode, [Responses API text deltas](https://developers.openai.com/api/docs/guides/streaming-responses) now render incrementally in the conversation; offline answers still arrive as one completed response, and speech starts after the answer finishes. The client closes its local response stream when stopped, but provider-side cancellation is not verified. **Not implemented yet:** streaming STT and speech quality benchmarks or end-to-end latency results. The browser displays speech-start delay and playback duration for each playback request as diagnostic timings only; chunked answers are measured as one request. Quiz scoring matches rubric phrases and does not interpret meaning. The Responses API tool loop has mocked tests but has not been exercised against a live model; model mode needs the optional SDK and an API key. Browser speech recognition and installed Hindi/English speech voices vary by browser and device; if no voice for the selected language is installed, the browser may use a different default voice. The UI reports per-page model-mode request-to-first-text and request-to-completion p50/p95 by configured model and language, failure counts, and cancellations (including late completions from stopped turns), plus browser STT time-to-first-final p50/p95 and failed/empty attempt counts by language (including recognition start failures), recorded-file STT upload-to-result p50/p95 and failure counts by language, plus TTS p50/p95 start and playback timings by language, voice, and sample type with failure counts for each group; exported `start_event` identifies whether start timing comes from browser synthesis or a scheduled streamed PCM buffer, not acoustic latency. These speech diagnostics reset on reload, retain at most 500 successful timing samples and 500 failure records per path in page memory, and do not store speech text or audio or measure pronunciation quality. Recorded-file timing starts when the completed clip begins upload and ends when its transcript reaches the browser; it excludes capture time and is not speech-end latency. When speech playback is unavailable, the answer stays readable on screen. The starter corpus covers Articles 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 21A, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 31A, 31B, 31C, 32, 33, 34, 35, and 42; unsupported questions should receive an insufficient-evidence response.

For the original input/function/output exercise, see [step0.py](step0.py). For the current learning notes, see [learning-log.md](learning-log.md).

## Run the text tutor

On Windows, start the complete local setup with one command from the project folder. The launcher uses an existing Python 3.11+ virtual environment or finds Python through `python` or the Windows `py` launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-local.ps1
```

The launcher reuses an existing Python 3.11+ `.venv` when available; otherwise it checks `python` and the Windows `py` launcher before creating `.venv`. It installs `requirements.txt`, copies `.env.example` to `.env` only when `.env` does not already exist, and starts the server. Open <http://127.0.0.1:8000>; press Ctrl+C in PowerShell to stop. Add an API key to `.env` before starting if you want model answers. Offline mode works without a key.

For manual setup, create and activate the environment, then install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Put your API key in `.env` to enable model answers. Keep that file private; it is excluded from Git. The default model can be changed with `OPENAI_MODEL` in `.env`. Start the local server, then open its address in a browser:

```powershell
.\.venv\Scripts\python.exe server.py
```

Open <http://127.0.0.1:8000>. The server binds to localhost and keeps the model key on the server. Its `/health` check reports setup mode and corpus size without creating a browser progress session; static JS and CSS requests also avoid session storage. Browser microphone permission is requested only after you click **Speak**. While listening, the same button changes to **Stop** so you can end capture without sending the transcript; you can review the text before submitting it. Press Ctrl+C to stop the web server.

Without an API key, the tutor returns matching local study-note summaries and source links; it labels these as notes rather than generated explanations. Questions outside the thirty-eight-note corpus receive an insufficient-evidence response. The smaller Step 0 example can still be run with:

```powershell
python step0.py
```

## Continue repo work in the background

With the Codex CLI installed and signed in, start the bounded roadmap loop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-work-loop.ps1
```

By default it runs for up to eight hours and up to 24 focused tasks, spaced about 20 minutes apart. Waits use absolute UTC due times, so a pause does not add the full wait again after resumption; the original deadline still applies. Each task has a 60-minute timeout by default; set `-TaskTimeoutMinutes` when starting the loop to change it. Each run uses the Codex CLI's workspace-write auto-approval mode, checks the repository roadmap, verifies its change locally, and creates a focused commit and pushes it to `origin` after its checks pass. It does not publish releases or deploy. Failed CLI invocations are retried on the next loop pass with a capped delay. The runner checks for stop requests at least every 30 seconds while waiting and stops when a task reports that it needs your input. Use `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\stop-work-loop.ps1` to request a graceful stop after the current task. The process-scoped execution-policy option does not change the machine's PowerShell policy. Status and per-run logs go under `.codex\overnight\`, which Git ignores. The task boundaries are in [AUTONOMOUS_WORK.md](AUTONOMOUS_WORK.md).

## Intended voice tutor

The planned end-to-end experience is a student asking in Hindi, English, or Hinglish for a short explanation, then asking the tutor to quiz them. The target system will speak its answer, ground explanations in a small checked corpus, score spoken answers against a rubric, and save progress.

A central voice-engineering challenge is interruption handling. When a student speaks while audio is playing, the tutor should stop playback, cancel the old generation, preserve conversation context, and ignore late results from the interrupted turn. The current client keeps an interrupted pending question with an explicit interruption note for the next turn and the server quietly handles the resulting disconnected socket; provider-side generation cancellation remains incomplete. The project also aims to compare speech configurations on the same examples and report measured quality and latency, including failure cases.

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

The current prototype uses a Python standard-library HTTP server and plain HTML, CSS, and JavaScript. OpenAI Responses API is the optional text model; speech recognition and speech synthesis use browser-provided features. This keeps setup small while making browser and device support a known limitation. SQLite stores local quiz progress. Optional streamed OpenAI TTS and recorded-file STT are implemented as experimental provider paths; compare language support, streaming behavior, quality, and cost before relying on them.

## Starter study corpus

The starter corpus contains short summaries for Articles 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 21A, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 31A, 31B, 31C, 32, 33, 34, 35 and 36, plus Article 38, Article 39(a)-(f), Article 39A, and Articles 40 through 44, each with article-level source metadata. Article 39(a)-(f) cover adequate livelihood; distributing community material resources for the common good; preventing harmful wealth concentration; equal pay for equal work; protection of workers' health and children's safety; and children's healthy, dignified development without exploitation or abandonment. The note summarizes the constitutional text without assessing a particular law or policy. Article 39A directs the State to promote justice on equal opportunity and provide free legal aid so economic or other disabilities do not deny access to justice; the note does not describe a particular legal-aid scheme or give legal advice. Article 37 says Part IV principles are not enforceable by courts, while making them fundamental to governance and a State duty when making laws; the note does not explain court decisions or apply the principles to a particular law. Article 38 summarizes clauses (1) and (2) on social order, justice, welfare, and reducing inequality in income, status, facilities, and opportunities; the note does not assess specific policies or court decisions. Article 40 directs the State to organize village panchayats and give them powers and authority to function as self-government units; the note does not describe a particular law or panchayat. Article 41 calls for provisions for work, education, and public assistance within the State's economic capacity and development; the note does not describe a specific scheme or individual entitlement. Article 43 covers living wages, decent working conditions, leisure, social and cultural opportunities, and rural cottage industries; it does not specify a law, wage amount, or individual entitlement. Article 44 calls on the State to endeavour to secure a uniform civil code for citizens throughout India; the note does not describe personal laws, a proposed code, or legal interpretation. Articles 12 and 13 summarize the Part III definition of State and the rule for laws inconsistent with Fundamental Rights, including Article 13(4); they do not explain judicial interpretation. Article 20 summarizes clauses (1)-(3), covering protection from retrospective criminal penalties, repeated prosecution and punishment for the same offence, and compelled self-incrimination; it does not explain legal interpretation. Article 22's note covers ordinary arrest protections in clauses (1)–(3) and explicitly excludes the separate preventive detention safeguards in clauses (4)–(7). Articles 23 and 24 cover the Article 23 trafficking, begar, and forced-labour prohibition and Article 24 hazardous work involving children under fourteen; Article 23 clause (2) is only briefly summarized. Article 25 covers clause (1) freedom of conscience and religious practice subject to its stated conditions; clause (2) and the explanations are outside the note. Article 28 summarizes clauses (1)–(3), including the funding rule, endowment or trust exception, and consent requirement for religious instruction or worship. Article 29 summarizes clauses (1) and (2), covering distinct language, script, or culture conservation and admission protection against specified discrimination. Article 30 summarizes clauses (1), (1A), and (2), covering minority institutions, protection during compulsory property acquisition, and nondiscrimination in State aid. Article 33 summarizes Parliament's power to modify rights for specified forces and services to support duty and discipline; it does not list specific restrictions or explain their application. Article 31A covers certain estate, property-management, corporation, and mineral-agreement laws subject to its conditions; it does not explain definitions, exceptions, assent, compensation, or court interpretation. Article 31 is omitted from the current constitutional text; its note records the official footnote that attributes the omission to the Forty-fourth Amendment, effective 20 June 1979, without explaining current property law. Article 31B summarizes the Ninth Schedule protection in the constitutional text, subject to legislative repeal or amendment; it does not explain court decisions on the protection's limits or assess a listed law. Article 31C summarizes its current scope around Article 39(b) and (c), the Article 14/19 protection, the State-law assent condition, and relevant source footnotes; it does not interpret either case or decide any law’s application. Article 35 summarizes Parliament's exclusive lawmaking power for specified Part III matters and the continuation of existing laws on those matters; it does not explain the separate matters or identify particular laws. Article 36 says that, for Part IV, the word State has the same meaning as in Part III unless the context otherwise requires; it does not interpret the Part III definition. The source is the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-05; Articles 31, 31A, 31B, 31C, 33, 34, 35, 38 and 40 through 44 were checked on 2026-10-06; Articles 36, 39(a)-(f), and 39A were checked on 2026-10-07. The corpus loader rejects duplicate note IDs and missing or invalid source check dates. An explicit Article, Art, Anuchhed, or अनुच्छेद reference in the current question takes priority over older conversation context and scopes retrieval to that article note; when the current question has no explicit reference, recent user questions can supply follow-up context. If the cited note does not cover the topic terms, the tutor abstains. Broad Fundamental Rights queries return the full note set; narrower topic queries use keyword overlap. Hindi and Hinglish aliases are included. Run `python evals/run_retrieval_eval.py` for the labeled text baseline. It contains 147 constructed English, Hindi, and Hinglish examples, including code-switched Roman/Devanagari queries and three multi-turn context cases for explicit current-turn article priority and unreferenced follow-ups, three Article 12 definition cases, three Article 13 law cases, three Article 20 protections cases, and three Article 22 arrest-safeguard cases plus four Article 23/24 exploitation-rights cases and three each for Articles 17, 18, 25, 26, 27, 28, 29, 30, 31, 31A, 31B, 31C, 32, 33, 34, and 35, plus three Article 39(b)/(c) examples, twelve Article 39(a), (d), (e), and (f) examples, and three Article 39A legal-aid examples across English, Hindi, and Hinglish, three Article 36 State-definition examples, three Article 37 enforceability examples, and three Article 38 social-order examples, three Article 40 panchayat examples, and three Article 41 work/education/assistance examples and three Article 42 work/maternity examples and three Article 43 living-wage/cottage-industry examples and three Article 44 uniform-civil-code examples; unsupported-domain and uncovered-detail abstention examples now include Hindi and Hinglish. The JSON report includes overall and per-language exact match, supported recall@3, and unsupported false-positive rates; this is a small constructed text regression set, not a measure of real learner or speech performance.

```powershell
python evals/run_retrieval_eval.py
```

## Saved quiz progress

Quiz scores are stored in a local SQLite database at `.codex/bolprep.sqlite3`, scoped to a random, HttpOnly browser cookie. Progress survives a server restart in the same browser. The app saves scores and rubric feedback, not the learner's raw answer text. A per-answer idempotency key makes network retries safe without retaining the answer or its hash. The **Saved progress** panel shows recent weak question areas; **Clear saved progress** deletes records for that browser cookie. This is a local prototype bound to `127.0.0.1`, not a multi-user hosted service with account authentication. Keep the cookie private on shared computers; deleting site cookies creates a new, separate progress history.

## Roadmap

1. **Text tutor:** first local prototype is implemented; improve prompt behavior and expand the checked study corpus.
2. **TTS output:** browser speech synthesis and optional streamed OpenAI speech are wired to answers; compare Hindi, English, and Hinglish pronunciation across available voices and record listener feedback.
3. **STT input:** browser speech recognition and optional server-side recorded-file transcription are available; compare Hindi, English, and Hinglish transcripts. Live streaming STT remains unimplemented.
4. **Browser prototype:** improve interaction states and check behavior across supported browsers and devices.
5. **Grounded answers:** lexical retrieval, source links, and an insufficient-evidence response are implemented for thirty-eight article notes; continue expanding coverage and evaluate retrieval quality.
6. **Quiz tools and progress:** deterministic quiz/scoring tools, local session-scoped idempotent progress storage, and a Responses API tool loop are implemented; run a live model tool-call session when an API key is available.
7. **Live turn-taking:** stream speech, support interruptions and cancellation, and reject stale turn events.
8. **Evaluation:** compare configurations on documented examples; report language-specific errors, TTS listener feedback, p50/p95 latency, and failures.
9. **Portfolio demo:** document setup, architecture, limitations, measured results, and a short walkthrough.

Each phase should be small enough to run, inspect, and explain before moving on.

### Constructed retrieval evaluation

The 147-example evaluation reports 100% exact match, 100% supported recall@3, and 0% unsupported false positives, with 100% exact match in English, Hindi, and Hinglish. Three constructed multi-turn context examples check current-turn article priority and unreferenced follow-ups; these figures do not estimate learner or speech performance. Reproduce the expanded evaluation from the project root with:

```powershell
.\.venv\Scripts\python.exe evals\run_retrieval_eval.py
```

These are results on constructed text prompts, not real learner questions, speech recognition, or answer-quality measurements. Next, exercise the tutor's Hindi and English speech in a supported browser, continue expanding the checked corpus, and verify model-selected tool calls with a configured key.

## Portfolio context

This project is planned as an end-to-end application counterpart to the author's Speak AI contributions. The preparation notes in [BOLPREP.md](../Chronicle/BOLPREP.md) list five related pull requests: #148 (TTS language/engine tiers), #151 (startup, normalization, and code-switching), #152 (speech evaluation), #153 (downloads and offline model handling), and #154 (tests and CI). Those notes record that the pull requests were open when checked on 2026-10-03. Confirm current status and describe personal contributions accurately before using them in an application; this repository does not validate their implementation details or results.

The intended story is to pair multilingual speech infrastructure work with a separately built, evaluated conversational tutor. That story is a direction for the portfolio, not a claim that this app or its voice benchmarks are complete.

## Development notes

- Keep provider credentials on the server and out of Git.
- The optional function-call loop follows the [OpenAI function-calling guide](https://developers.openai.com/api/docs/guides/function-calling); local tests use a mocked Responses client and do not spend API credits.
- Use consented, legally usable study material and evaluation recordings.
- Document the evaluation sample, configuration, results, and known limitations.
- Use the [browser voice run sheet](evals/voice-run-sheet.md) for repeatable manual STT/TTS checks and a spoken quiz flow review; its timing and listener notes are diagnostics, not broad performance claims. For manually paired, self-authored STT transcripts, `node evals/score_stt.js evals/local-stt-trials.json` reports per-configuration and per-language success-only and all-attempts word error rates plus failure counts without printing transcript text; the local input file is ignored by Git. The quiz flow has not been manually verified in a browser.
- The retrieval evaluation runner rejects blank/duplicate example labels, unsupported language names, and expected document IDs that are blank, duplicated, or absent from the corpus.
- The **Speech diagnostics** panel copies or downloads current-page STT/TTS and model-stream p50/p95 timings and failure counts as versioned JSON with a UTC generation time for recording run-sheet results. The export contains no transcript text or audio and clears on reload with the underlying metrics.
- TTS timing summaries include failed browser playback events grouped by language, voice, and sample type, with failure counts broken down by browser error category in the JSON export. Common browser error codes show a suggested next step. Counts, timings, and error categories stay in page memory and clear on reload; speech text and audio are not retained in page memory or included in the export.
- Browser STT timing summaries include failed or empty recognition attempts grouped by language. Recorded-file STT separately counts capture, recording, empty-clip, and transcription failures. Deliberate stops and cancellations are excluded; transcript text is not retained by the metrics.
- The microphone control switches to **Stop** while recognition is active, so learners can end capture and review the transcript before sending it.
- Press **Escape** to stop an active tutor request, quiz setup or scoring request, speech playback, or microphone capture; the on-screen stop control advertises the same shortcut.
- Escape and Stop also abort an in-flight quiz scoring request in the browser, preserve the submitted answer for retry, and restore microphone access. If the server already received the request, its idempotency key makes retrying safe.
- Changing the speech language stops any current or queued tutor audio; the new language and voice selection apply to the next playback. Real browser behavior still depends on its installed speech voices.
- Common speech-recognition failures now explain a next step, such as allowing microphone access or checking for a connected microphone; unknown browser errors remain visible with a typing fallback.
- Active microphone capture also has a visible color state and an `aria-pressed` value for assistive technology.
- Speech transcripts over the active question or quiz-answer limit stay visible for editing; submission now explains the limit instead of sending a request the server will reject.
- Keyboard navigation has a visible focus outline on interactive controls and links.
- If a learner stops a pending model turn or a request fails, the client keeps the question and a clear interruption/failure note in the bounded history so follow-ups retain the topic without treating an error as an answer; stopping does not cancel model generation at the provider.
- Submitting a typed quiz answer stops any current tutor audio before scoring starts, so prompt or feedback playback does not continue over the scoring turn.
- Add features incrementally and record experiments in [learning-log.md](learning-log.md).
