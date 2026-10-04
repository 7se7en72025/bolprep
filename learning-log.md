# Learning log

## Step 0 — 2026-10-03

- Banaya: question lene wala Python function, fixed practice answer, teen questions ki list aur input/output printing.
- Seekhne ke concepts: variable, string, function, parameter, return, list aur for loop.
- Verification: Python 3.11.9 par `python step0.py` successfully chala; teen alag inputs aur har baar expected fixed output print hua.
- Learner understanding: abhi verify nahi hui; README ke teen questions ka jawab dena hai.
- Mere experiments: abhi nahi likhe.
- Kya fail hua aur kyun: is implementation aur run mein koi error nahi aaya.
- Next: input/function/output apne words mein explain karna, phir Step 1.

## Text tutor prototype — 2026-10-04

- Banaya: local browser UI aur Python server; typed question flow, recent-turn context, optional model configuration, Hindi/Hinglish aur English speech controls, browser speech input/playback, offline state, and request validation.
- API: OpenAI Responses API integration taiyar hai. Is environment mein API key configured nahi thi, isliye live model request exercise nahi hui.
- Verification: Python files compile hue; browser JavaScript syntax check pass hua; local `/health` aur home page ne HTTP 200 diya; offline `/api/answer` ne expected transparent reply diya; malformed JSON ko HTTP 400 mila.
- Limitations: retrieval, source citations, server-side provider cancellation, streamed audio, and browser-level microphone/playback behavior abhi verify nahi hain.
- Next: supported browser mein Hindi, English, aur Hinglish mic/playback try karo; phir checked source notes ka first retrieval baseline banao.

## Voice status callback fix — 2026-10-04

- Changed: browser speech callbacks now update the status only while they belong to the latest speech turn. Stopping speech or starting a newer tutor action invalidates older callbacks, so a late browser event cannot replace the current status.
- Verification: `node --check web/app.js` passed. Python files were unchanged by this fix; the isolated Codex runner did not have the Python executable on its PATH.
- Limitation: this check does not exercise actual browser speech playback or its event timing; browser/device behavior still needs a manual check.

## Checked-note retrieval baseline — 2026-10-04

- Banaya: three short notes for Articles 14, 19, and 21; each has official source URL and article section. Keyword overlap plus an explicit-article boost retrieves relevant notes, including English, Devanagari, and common Hinglish spellings.
- App behavior: both the browser route and CLI pass retrieved notes to model mode; offline mode summarizes retrieved notes. UI shows source links. No matching note means the tutor says its checked notes do not cover the question.
- Verification: 9 unit tests passed, including article ranking, Hindi/Hinglish aliases, unsupported questions, source metadata, and mocked model-request evidence. Python compilation and JavaScript syntax checks passed. Local server returned one Article 14 source for an English question, one Article 14 source for a Hinglish question, and zero sources for an unsupported question.
- Limitations: lexical retrieval is not benchmarked; the live model key path and browser microphone/playback have not been exercised. Three articles do not cover the whole Fundamental Rights section.

## Retrieval regression set — 2026-10-04

- Added 17 constructed labeled examples across English, Hindi, and Hinglish, including broad questions, unsupported topics, and out-of-domain questions. The runner reports exact match, supported recall@3, false-positive rate for unsupported questions, and per-language exact match.
- Tightened article-number boosting so the article number alone cannot make an uncovered topic look supported; broad “fundamental rights” queries return all three starter notes, including the Hindi phrase “मौलिक अधिकार”.
- Run `python evals/run_retrieval_eval.py`. The set is a regression aid only, not a real speech or learner benchmark.
- Next: add a bounded quiz and rubric-scoring flow from checked notes, then test it without storing permanent learner progress yet.

## Session-only quiz and rubric scoring — 2026-10-04

- Banaya: three checked questions for Articles 14, 19, and 21; Hindi/Hinglish and English prompts; server-side `start_quiz` and `score_answer` functions; a browser flow that can speak the question, accept typed or recognized answers, show rubric feedback and source, and continue to the next question.
- Scoring: exact keyword/phrase aliases award points by required concept groups. Article 19 asks for any two of several listed freedoms. This is deterministic text matching, not semantic grading.
- State: answers and scores stay in the current page memory; nothing is written to a database or kept after the page/session ends.
- Verification: 6 quiz unit tests passed; all 15 repo unit tests passed; Python compilation and browser JavaScript syntax checks passed. Local HTTP smoke run returned three English prompts, scored full-rubric Article 14/19/21 answers at 100%, returned article-level source metadata, and rejected an unknown question ID with HTTP 400.
- Limitations: questions are selected from a fixed bank, not generated through an LLM tool call; quiz UI has not yet been exercised in a browser or with real speech recognition.

## Local saved quiz progress — 2026-10-04

- Added a SQLite store for quiz runs and scored answers, scoped by a random HttpOnly cookie issued by the local server. A score write is unique per quiz and question; retrying with the same per-answer idempotency key returns its first result, while a new key for the same question is rejected. Neither raw learner answers nor answer hashes are stored.
- The browser now shows saved answer count, average score, and questions whose latest result needs revision. It can clear progress for the current browser cookie. SQLite data lives under `.codex/` and is ignored by Git.
- Verification: all 23 unit tests pass, including persistence, cross-session separation, retry idempotency, conflict handling, legacy-database migration, weak-area summary, raw-answer/hash omission, and deletion. Local HTTP smoke checks confirmed progress is isolated by cookie, repeated score submissions count once, different sessions cannot submit another session's quiz, delete clears progress, and saved scores remain after restarting the server.
- Limitations: this is a local single-browser identity model, not account authentication or a hosted multi-user design. Full browser-based quiz flow and mic input still need manual checking.

## Responses API function tools — 2026-10-04

- Added `agent.py` with strict-schema `start_quiz`, `score_answer`, and `get_weak_topics` function tools. It validates every argument on the server, limits tool calls per turn, returns tool output by its `call_id`, and surfaces successful tool events to the browser. The browser submits natural quiz requests to the agent route and starts the checked questions returned by the tool.
- Without a configured key, the same route uses the offline notes and a small explicit quiz/revision intent fallback. This keeps the local demo runnable and labels the mode rather than pretending it used a model.
- Verification: all 27 unit tests pass, including mocked Responses tool-call/continuation flow, invalid-argument rejection, server-rubric scoring, and offline quiz starts. Python compilation and browser JavaScript syntax checks pass.
- Limitations: the OpenAI SDK and API key are absent from this environment, so provider serialization and a live model-selected tool call could not be exercised. Tool-generated answer scores still use the deterministic lexical rubric; no browser was available for visual interaction checks.

## Hindi and Hinglish offline notes — 2026-10-04

- Added Devanagari Hindi and Roman Hinglish titles and summaries for the three checked starter notes. Offline responses now select Hindi script when the learner typed Hindi and Roman Hinglish when they typed in Latin script; English stays English. Unsupported-topic messages also follow the selected input style.
- Rechecked Articles 14, 19, and 21 against the [Legislative Department's official Constitution of India PDF](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), including each article's core text and the Article 19(2) reference to restrictions.
- Verification: 30 unit tests pass; added checks for each offline language style and unsupported responses. Local HTTP checks returned Devanagari for Hindi-script input, Roman Hinglish for Latin-script input, and English insufficiency text for an unsupported question. The 17-example retrieval evaluation remains 100% exact match; Python compilation and JavaScript syntax checks pass.
- Limitations: the translations are authored summaries, not official Hindi translations. Browser pronunciation and the live model path remain untested here.


## Corpus expansion and Hindi retrieval check: 2026-10-04

- Added checked notes for Articles 15, 16, and 21A, bringing the starter corpus to six articles with English, Hindi, and Hinglish summaries and keywords. The source notes link each summary to the corresponding article in the official Constitution PDF.
- Expanded the constructed retrieval regression set from 17 to 26 examples. Hindi-aware tokenization now keeps combining marks attached to Devanagari words; generic Hindi words are excluded from scoring so they do not pull in unrelated articles.
- Verification: 32 unit tests pass. The 26-example constructed text set reports 100% exact match in English, Hindi, and Hinglish, with no unsupported-question false positives. These figures do not measure real learners or speech recognition.


## Browser speech voice selection: 2026-10-04

- Added a voice picker populated from the browser's installed speech voices and filtered it by the selected Hindi/Hinglish or English language. Changing language refreshes the list; playback uses the selected voice when available and keeps the browser-language default as a fallback.
- Updated the interface documentation to explain that available voices depend on the browser and device.
- Verification: JavaScript syntax check passes. Voice availability and pronunciation still need manual checks on target browsers and devices; the repository environment does not provide a browser speech catalog.

## One-command Windows setup - 2026-10-04

- Added `tools/run-local.ps1` to check for Python 3.11+, create the local virtual environment, install declared dependencies, create `.env` only if it is missing, and start the local server.
- Documented the quick start and the offline-without-a-key path in the README. Existing `.env` values are left intact.
- Verification: PowerShell parser accepted the launcher; invoking it on Python 3.11 created the environment, installed requirements, copied `.env.example` to a new `.env`, and started the server. The non-overwrite branch was reviewed. `/health` returned offline mode with six notes; `curl.exe` received HTTP 200 for `/` and `/app.js`. Server startup still depends on locally available Python and package installation.


## Sustained work-loop cadence: 2026-10-04

- Increased the default bounded work window from four tasks to 24 tasks over eight hours (about 20 minutes between successful passes), and split idle waits into 30-second slices so a stop request is noticed promptly.
- Updated the README with the actual schedule and stop behavior. The loop remains bounded by both elapsed time and run count; it does not guarantee uninterrupted active work or recover if its PowerShell supervisor is forcibly terminated.
- Verification: reviewed the PowerShell parameter and wait-loop changes and confirmed the documented defaults match. Restarted the active loop with the new 24-run setting; it will end at its eight-hour deadline or sooner if it reaches its run cap or receives a stop request.


## Speech playback fallback: 2026-10-04

- When the browser does not expose speech synthesis, the tutor now leaves the answer readable and says clearly that audio playback is unavailable instead of silently skipping speech.
- Verification: `node --check web/app.js` and `git diff --check` pass. Actual device support still needs browser QA.


## Hindi rubric tokenization: 2026-10-04

- Changed answer tokenization to preserve Unicode combining marks and normalize text before phrase matching. This keeps Devanagari words intact during quiz scoring; added the Hindi label for Article 14's equal-protection concept as an accepted answer phrase.
- A direct pre-change diagnostic showed a Hindi word being split into partial tokens by the previous `\w` expression. Reviewed the new tokenizer path and the JSON rubric change; no test suite was run in this turn.

## Browser voice preview - 2026-10-05

- Added a user-triggered preview for the selected browser voice, with separate English and Hindi/Hinglish sample phrases. Preview uses the same language and voice selection as tutor answers.
- Verification: JavaScript syntax and diff checks pass. Preview audio and available voice lists still need manual verification in a supported browser.

## Remember speech preferences - 2026-10-05

- The selected speech language and browser voice now persist in local browser storage across page reloads. Stored values are presentation settings only; no answers or audio are saved. When storage is blocked, voice controls continue to work for the current page.
- Verification: `node --check web/app.js` and `git diff --check` pass. Reload persistence still needs a manual browser check.

## Bound the OpenAI SDK major version - 2026-10-05

- Capped the declared OpenAI SDK below version 4 while retaining the minimum version required by the project. The local setup had installed SDK 3.24.0; direct introspection confirmed it exposes `OpenAI.responses.create`, the interface used by both model paths.
- Verification: inspected the installed client and method signature without making an API request; no test suite was run in this turn.


## Script-aware quiz feedback - 2026-10-05

- Added Roman Hinglish labels for each checked quiz rubric concept. Hindi-mode feedback now uses Devanagari labels for Devanagari answers and Roman Hinglish labels for Latin-script answers; English mode continues to use English labels.
- Updated rubric validation to check the optional Hinglish label field. Verification: JSON parsing and Python compilation pass; no test suite was run in this turn.


## Per-utterance browser speech timing - 2026-10-05

- Browser TTS status now reports time from `speak()` enqueue to the synthesis `start` event and duration from `start` to `end`. Superseded utterance callbacks remain guarded by the active speech-turn token.
- These are single playback diagnostics, not p50/p95 measurements or subjective pronunciation scores. Verification: `node --check web/app.js` and `git diff --check` pass; browser event timings need manual confirmation on supported devices.


## Per-turn speech recognition timing - 2026-10-05

- STT status now reports elapsed time from recognition start to the first final transcript event. Interim text remains available for review; if no final result arrives, the UI offers typing as a fallback. Recognition errors keep their specific message.
- This is an individual browser timing diagnostic, not an aggregate latency benchmark. Verification: `node --check web/app.js` and `git diff --check` pass; event behavior still needs manual testing with browser microphone permission.
