# Learning log

## Add the general provisions in Articles 12 and 13 - 2026-10-05

- Added bounded English, Hindi, and Hinglish notes for Article 12's Part III definition of State and Article 13's rules for laws inconsistent with Fundamental Rights. Article 13's summary includes clause (4) and avoids claims about judicial interpretation. Checked against Part III, Articles 12 and 13, in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples per article. The corpus now contains 20 notes and the labeled set contains 70 examples.
- Verification: Node parsed both JSON files and checked all 20 note records for required language fields and source metadata; a focused Node check mirroring lexical ranking placed all six new Article 12/13 examples in the top three; `git diff --check` passes. The Python retrieval evaluator was not run; aggregate retrieval metrics remain unmeasured. Browser interactions were not run.
- Limitation: these concise notes do not explain judicial interpretation; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Add equality protections from Articles 17 and 18 - 2026-10-05

- Added English, Hindi, and Hinglish notes for Article 17's abolition of untouchability and Article 18's restrictions on State-conferred and foreign titles. Checked against Articles 17 and 18 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples per article. The corpus now contains 18 notes and the labeled set contains 64 examples.
- Verification: Node parsed both JSON files (18 notes, 64 examples) and a focused check mirroring lexical ranking put all six Article 17/18 examples first; `git diff --check` passes. The Python retrieval evaluator was not run; aggregate retrieval metrics remain unmeasured. Browser interactions were not run.
- Limitation: these concise notes summarize the stated text and do not cover legal interpretation; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Cover protections for accused persons in Article 20 - 2026-10-05

- Added English, Hindi, and Hinglish notes for Article 20(1)–(3), covering protection from retrospective criminal penalties, repeated prosecution and punishment for the same offence, and compelled self-incrimination. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Article 20(1)–(3), checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples, and updated the broad retrieval label to match all current notes. The corpus now contains 16 notes and the labeled set contains 58 examples.
- Verification: Node parsed the corpus and evaluation JSON (16 notes, 58 examples), and a focused Node check mirroring lexical retrieval matched all three Article 20 examples and the broad 16-note label; `git diff --check` passes. The Python retrieval evaluator was not run; aggregate retrieval metrics remain unmeasured. Browser interactions were not run.
- Limitation: the concise note does not cover judicial interpretation; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Add Article 29 cultural and education protections - 2026-10-05

- Added English, Hindi, and Hinglish notes for Article 29(1)–(2), covering conservation of a distinct language, script, or culture and protection from specified admission discrimination. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Article 29, checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The labeled set now contains 52 examples.
- Verification: Node parsed the corpus and evaluation JSON (14 notes, 52 examples), and a focused Node check mirroring lexical retrieval ranked all three Article 29 examples correctly; `git diff --check` passes. The Python retrieval evaluator was not run; retrieval metrics remain unmeasured.
- Limitation: the note covers only clauses (1)–(2), not detailed interpretation; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Cover religious instruction at educational institutions in Article 28 - 2026-10-05

- Added English, Hindi, and Hinglish notes for Article 28(1)–(3), including the full-State-funding rule, the endowment or trust exception, and consent for instruction or worship at State-recognised or State-aided institutions. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Article 28, checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The labeled set now contains 49 examples.
- Verification: pending local JSON parsing and focused keyword checks. The Python retrieval evaluator and browser interactions were not run.
- Limitation: this concise note does not cover judicial interpretation; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Cover religion-specific taxation in Article 27 - 2026-10-05

- Added English, Hindi, and Hinglish notes and retrieval keywords for Article 27's rule against compelling a person to pay a tax specifically appropriated to promote or maintain a particular religion or religious denomination. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Article 27, checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The labeled set now contains 46 examples.
- Verification: JSON parsing, focused retrieval checks, node --check web/app.js, and git diff --check pass. The Python retrieval evaluator and browser interactions were not run.
- Limitation: the short note does not explain related legal interpretation; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Add repeatable browser turn-taking checks - 2026-10-05

- Added manual cases to the browser voice run sheet for stopping playback, beginning speech capture during playback, interrupting a pending request, and following up after an answer. The sheet now captures repeated outcomes and observable stale audio or response symptoms.
- Verification: reviewed the new steps against the current Stop, Speak, follow-up, and client-abort behavior; `git diff --check` passes. No browser/device session was available, so no interaction results were recorded.
- Limitation: browser behavior and provider-side generation cancellation remain unverified; the client can abort its request and ignore stale events, but that does not prove provider cancellation.

## Cover religious-affairs rights in Article 26 - 2026-10-05

- Added English, Hindi, and Hinglish notes and retrieval keywords for Article 26, summarizing the rights of religious denominations subject to public order, morality, and health. The text was checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Article 26, checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The labeled set now contains 43 examples.
- Verification: Node parsed both JSON files and a focused Node check mirroring the lexical ranking rule ranked all three Article 26 examples correctly; `node --check web/app.js` and `git diff --check` pass. The Python retrieval evaluator was not run; retrieval metrics remain unmeasured.
- Limitation: the short note does not explain legal interpretation or detailed limits; retrieval examples are constructed, not real learner queries, and retrieval quality remains unmeasured.

## Count empty final speech results as failed attempts - 2026-10-05

- Changed: speech recognition timing is recorded as successful only when the browser returns a non-empty final transcript. Empty final results now reach the existing failed/empty attempt count when recognition ends.
- Verification: `node --check web/app.js` and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: the empty-final browser event sequence was not manually reproduced; behavior is verified by inspecting the guarded final-result handler.

## Correct the documented corpus count - 2026-10-05

- Changed: corrected the README's offline-mode description from nine notes to ten, matching the current corpus.
- Verification: Node confirmed the corpus JSON contains 10 notes, and `git diff --check` passes. No application behavior changed.

## Expand the checked corpus with Article 25 - 2026-10-05

- Added English, Hindi, and Hinglish notes and retrieval keywords for Article 25, covering clause (1)'s freedom of conscience and religious practice with its stated conditions. The note excludes clause (2) and the explanations. The text was checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Article 25(1), checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The labeled set now contains 40 examples.
- Verification: Node parsed the corpus and evaluation JSON (10 notes, 40 examples), and a focused smoke check confirmed lexical overlap for all three Article 25 examples; `git diff --check` passes. The retrieval evaluator was not run.
- Limitation: retrieval quality remains unmeasured. This short note does not explain clause (2), either explanation, or legal interpretation; evaluation examples are constructed, not real learner queries.

## Show keyboard focus on interactive controls - 2026-10-05

- Changed: added a consistent visible outline when keyboard users focus interactive controls and links.
- Verification: `git diff --check` passes. No browser or screen-reader interaction was performed.
- Limitation: outline visibility and contrast were not manually checked across browser themes or high-contrast settings.

## Expand the checked corpus with Articles 23 and 24 - 2026-10-05

- Added English, Hindi, and Hinglish notes and retrieval keywords for Articles 23 and 24, extending the starter corpus from seven to nine articles. The summaries were checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Articles 23 and 24, checked on 2026-10-05.
- Added four English, Hindi, and Hinglish retrieval examples for the two notes. The labeled set now contains 37 constructed examples.
- Verification: parsed both JSON files and checked the new expected document IDs against the corpus. The retrieval evaluation was not run, so no retrieval quality change is claimed.

## Explain unavailable voice input on the mic button — 2026-10-05

- Changed: when browser speech recognition is unavailable, the disabled microphone button's accessible name and tooltip now explain that voice input is unavailable and typing still works.
- Verification: `node --check web/app.js` and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: screen-reader announcement and browser-specific speech-recognition support were not manually checked.

## Stop an active turn with Escape — 2026-10-05

- Changed: Escape now stops an active tutor request, browser speech playback, or microphone capture through the existing stop handler. The stop control also advertises the shortcut to assistive technology.
- Verification: `node --check web/app.js` and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: Escape handling was not manually checked across browsers or assistive technologies.

## Focus the question box after starting a new session — 2026-10-05

- Changed: after clearing the conversation, keyboard focus moves to the question box so the learner can start typing immediately.
- Verification: `node --check web/app.js` and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: focus behavior was not manually checked with a screen reader or browser.

## Announce saved-progress updates to assistive technology — 2026-10-05

- Changed: marked the saved-progress summary as a status region so loading, empty, error, and refreshed-result messages are announced politely by assistive technology.
- Verification: `node --check web/app.js` and `git diff --check` pass. No screen-reader/browser interaction or test suite was run.
- Limitation: announcement behavior can vary by browser and screen reader and was not manually checked.

## Keep saved progress clear during deletion — 2026-10-05

- Changed: confirming saved-progress deletion immediately clears the panel, invalidates earlier refreshes, disables its controls during the request, then reloads the actual state after success or failure.
- Verification: `node --check web/app.js` and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: delayed DELETE responses and overlapping score updates were not exercised in a browser.

## Ignore stale progress refresh responses — 2026-10-05

- Changed: overlapping saved-progress refreshes now use a request generation ID; older responses cannot overwrite the newest result or error state.
- Verification: `node --check web/app.js` and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: out-of-order network responses were not simulated in a browser during this change.

## Update broad retrieval labels for Article 22 — 2026-10-05

- Changed: English, Hindi, and Hinglish broad Fundamental Rights examples now expect Article 22 alongside the six existing notes, matching the corpus-wide retrieval behavior.
- Verification: the JSON parses with Node and `git diff --check` passes. The retrieval evaluator was not run.
- Limitation: the expected labels were reconciled with the documented broad-query behavior; measured evaluator results remain pending.

## Clear stale progress during refresh — 2026-10-05

- Changed: the saved-progress panel clears prior weak-topic entries while a refresh loads and when a request fails, so old results are not shown beside a loading or error message.
- Verification: JavaScript syntax check with Node and `git diff --check` pass. No browser interaction or test suite was run.
- Limitation: the loading, successful refresh, and failure states were not exercised in a browser during this change.

## Cover Article 22 in retrieval examples — 2026-10-05

- Changed: extended the labeled retrieval examples with English, Hindi, and Hinglish questions about Article 22's grounds-of-arrest, lawyer, and magistrate protections; README count updated from 30 to 33.
- Verification: the evaluation JSON parses with Node and `git diff --check` passes. The retrieval evaluator was not run.
- Limitation: expected labels were added from the checked corpus note but retrieval metrics for the expanded set remain unmeasured in this change.

## Bound autonomous task duration — 2026-10-05

- Changed: each Codex task now runs in a helper process with a configurable 60-minute default timeout. On timeout or when the overall deadline arrives, the runner terminates the helper process tree, records the timeout, and retries with backoff if time remains.
- Verification: PowerShell parser reports no syntax errors for the three loop scripts and `git diff --check` passes. No timed task was launched to exercise process-tree termination.
- Limitation: timeout cleanup relies on Windows `taskkill.exe`; the eight-hour loop has not yet been relaunched with this version.

## Reject empty study-note content — 2026-10-05

- Changed: corpus loading now rejects blank localized titles or summaries, empty keyword lists or entries, and blank source titles or sections.
- Verification: Python syntax compilation and `git diff --check` pass. No test suite or retrieval evaluation was run.
- Limitation: field validation confirms usable text is present, not that translations are accurate or summaries exhaustively represent the source.

## Add arrest safeguards to checked corpus and quiz — 2026-10-05

- Changed: added a Hindi, Hinglish, and English Article 22 note and a rubric question covering selected ordinary-arrest safeguards. The note scopes itself to clauses (1)–(3) and states that clauses (4)–(7)'s preventive-detention safeguards are not summarized.
- Source: checked the official Constitution text published by the Legislative Department, Government of India, at the recorded source URL for Article 22(1)–(3).
- Verification: both JSON files parse successfully and `git diff --check` passes. The retrieval evaluation and browser quiz were not run.
- Limitation: this small note is not legal advice, does not cover the article's full preventive-detention framework, and is not added to the constructed retrieval examples in this change.

## Select a supported Windows Python launcher — 2026-10-05

- Changed: the one-command Windows setup now probes `python` and the `py` launcher and uses the first interpreter at Python 3.11 or later. An older `python` on PATH no longer blocks a supported `py` runtime.
- Verification: PowerShell parser reports no syntax errors and `git diff --check` passes. The launcher was not executed against multiple installed Python versions.
- Limitation: the selection path is statically checked here; Windows installation combinations still need a direct setup run.

## Honor retry backoff when a run omits its marker — 2026-10-05

- Changed: the work loop now chooses retry delay from the run's retry state. A successful `[CONTINUE]` waits for the normal task interval; a failed run or missing marker uses the capped backoff even if the CLI returned exit code zero.
- Verification: PowerShell parser reports no syntax errors and `git diff --check` passes. The active loop was not restarted to exercise retry timing.
- Limitation: a future loop run is needed to observe the missing-marker branch in operation.

## Split long answers for browser speech — 2026-10-05

- Changed: long TTS answers are divided at sentence boundaries, then word or code-point boundaries when needed, and queued as browser utterances. Interruption checks and speech diagnostics still cover the answer as one turn.
- Verification: `node --check web/app.js` and `git diff --check` pass. No test suite or browser speech run was performed.
- Limitation: chunking improves compatibility with browser utterance limits but does not provide streamed audio; browser and installed-voice behavior still needs manual evaluation.

## Reject blank quiz rubric content — 2026-10-05

- Changed: the quiz-bank loader now rejects blank question IDs and text, blank concept labels or aliases, and blank source titles or sections before exposing a quiz.
- Verification: Python syntax compilation and `git diff --check` pass. No test suite was run.
- Limitation: this validates required text presence and shape; it does not verify rubric correctness against the cited Constitution source.

## Report decision stops accurately — 2026-10-05

- Changed: the bounded work loop now records when it exits because a task requested a user decision, instead of also labeling that exit as a time-limit expiration.
- Verification: PowerShell parser reports no syntax errors and `git diff --check` passes. The long-running loop was not stopped or restarted to exercise the new branch.
- Limitation: this only corrects status reporting; the existing loop process uses the script version loaded when it started.

## Match the accessible input label to quiz mode — 2026-10-05

- Changed: the question box's screen-reader label now changes to "Your quiz answer" when a quiz question is active, then returns to "Your question" when the quiz finishes or a new session starts.
- Verification: `node --check web/app.js` and `git diff --check` pass. No test suite was run.
- Limitation: screen-reader behavior was not exercised with assistive technology in this run.

## Preserve quiz answers when scoring fails — 2026-10-05

- Changed: if quiz scoring fails after submission, the answer is restored to the input and focus returns there so the learner can retry without retyping.
- Verification: `node --check web/app.js` and `git diff --check` pass. No test suite was run.
- Limitation: the network-failure interaction was not exercised in a browser during this run.

## Reliable PowerShell setup commands — 2026-10-05

- Changed: setup examples invoke PowerShell scripts with a process-scoped execution-policy override and use the virtual environment's Python executable directly, avoiding activation-policy failures on Windows.
- Verification: inspected the README commands and ran `git diff --check`. No test suite was run.
- Limitation: the commands were not executed on a separate Windows installation.

## Stop playback when speech language changes — 2026-10-05

- Changed: changing the selected speech language now cancels current or queued browser speech and explains that the new language applies to the next playback. This prevents audio from continuing in the previously selected language after the control changes.
- Verification: `node --check web/app.js` and `git diff --check` pass. No test suite was run.
- Limitation: speech cancellation and language switching were not exercised in a real browser/device in this run.

## Clearer microphone error messages — 2026-10-05

- Changed: common browser speech-recognition errors now suggest a next step, such as allowing microphone access or checking for a connected microphone. Unknown errors remain visible with a typing fallback.
- Verification: `node --check web/app.js` and `git diff --check` pass. No test suite was run.
- Limitation: actual browser-specific error events were not triggered in this run; messages still depend on the error codes exposed by the browser.

## Per-language voice preference — 2026-10-05

- Changed: selected browser speech voices are now remembered separately for Hindi and English. Existing saved single-voice preferences are migrated when the app next saves settings.
- Verification: `node --check web/app.js` and `git diff --check` pass. No test suite was run.
- Limitation: installed voice selection and persistence across language changes were not exercised in a real browser/device in this run.

## Restart STT after a language switch — 2026-10-05

- Changing the speech language during recognition now aborts the active session, updates the recognizer locale for the next start, and tells the learner to tap Speak again. This avoids silently changing the configured locale mid-utterance.
- Verification: `node --check web/app.js` and `git diff --check` pass. Active microphone behavior still needs browser verification.

## Checked corpus metadata validation — 2026-10-05

- Changed: the checked-note loader now rejects duplicate or blank note IDs and missing or invalid `source.checked_on` dates. Stable IDs keep retrieval and evaluation labels unambiguous; valid dates make source-review metadata explicit.
- Verification: Python 3.11 compilation and `git diff --check` pass. No test suite or retrieval evaluation was run in this turn.
- Limitation: the checks validate metadata shape and date syntax, not whether a source was actually reviewed on that date.

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


## Preserve full speech transcript across events - 2026-10-05

- SpeechRecognition exposes the full result list on each result event; the UI now rebuilds the transcript from all current results instead of dropping earlier segments when `resultIndex` advances.
- Verification: `node --check web/app.js` and `git diff --check` pass. Incremental event behavior still needs manual browser/microphone verification.


## Cancel stale microphone recognition - 2026-10-05

- Starting another tutor action now aborts active browser recognition and ignores result events after cancellation. Clearing a conversation also clears its unsent transcript so delayed STT callbacks cannot repopulate the composer.
- Microphone start failures restore the button and listening state. Verification: `node --check web/app.js` and `git diff --check` pass; cancellation timing still needs manual browser/device verification.


## In-page TTS timing summaries - 2026-10-05

- Aggregated successful browser speech events in page memory by language, installed voice, and preview/tutor sample type. After playback, the UI shows per-run start and playback times plus nearest-rank p50/p95 for the current group. At most 500 events are retained in memory; refreshing clears them.
- Timing samples contain no spoken text or answers. This is a small diagnostic aid; meaningful voice comparisons still require repeated identical previews and human pronunciation review. Verification: `node --check web/app.js` and `git diff --check` pass; aggregation behavior needs browser verification.


## In-page STT timing summaries - 2026-10-05

- Recognition now keeps first-final latency samples in page memory, grouped by STT language, and reports nearest-rank p50/p95 after each final transcript. Samples contain timing and language only; transcript text is not retained by the metric summary.
- Verification: `node --check web/app.js` and `git diff --check` pass. Repeated microphone sessions and language grouping need browser verification.

## Manual browser speech run sheet - 2026-10-05

- Added fixed Hindi, Hinglish, and English prompts for manual STT/TTS checks, setup fields, listener rating columns, failure notes, and a repeat-count guideline for reading p50/p95 summaries.
- Documented consent and limits: timing is browser-event diagnostics, listener ratings are subjective, and these small runs do not support population-level claims.
- Verification: reviewed all three reference prompts against the app's supported languages and linked the run sheet from the README. No browser speech session was available here.

## Reject invalid retrieval evaluation labels - 2026-10-05

- The retrieval evaluation runner now checks that every expected document ID exists in the loaded corpus. This catches stale or misspelled labels before they distort retrieval metrics.
- Verification: Python compilation and `git diff --check` pass. A test file generated by the autonomous task was removed because this environment's current instruction prohibits adding or running tests.


## Count browser TTS failures in page diagnostics - 2026-10-05

- Added per-page TTS failure counts grouped by speech language, installed voice, and preview/tutor sample type. Successful p50/p95 timings remain visible alongside the failure count, including when no utterance has completed.
- Retained only the bounded sample metadata in page memory (up to 500 successful timings and 500 failures); no speech text or audio is recorded. Reloading clears the metrics.
- Verification: `node --check web/app.js` and `git diff --check` pass. Browser speech errors still need manual confirmation on supported devices.


## Count browser STT attempts without a final transcript - 2026-10-05

- Added per-page failed/empty recognition counts grouped by language alongside first-final p50/p95 timings. Browser error details remain visible for the current attempt, while only the language is retained in the bounded diagnostic samples.
- Deliberate stop and language-change cancellation paths clear the active listening flag before aborting, so they are not counted as recognition failures. Reloading clears the metrics.
- Verification: `node --check web/app.js` and `git diff --check` pass. Error and cancellation event ordering still needs manual confirmation in supported browsers.


## Make active microphone capture stoppable - 2026-10-05

- The Speak control now becomes an enabled Stop control while the browser is listening. It aborts capture, restores the normal button label, and leaves any transcript available for review before submission.
- Shared stop paths restore the control as well, and deliberate cancellation remains excluded from failed/empty STT metrics.
- Verification: `node --check web/app.js` and `git diff --check` pass. Microphone permission and event timing need manual browser verification.


## Explain overlong speech transcripts before submission - 2026-10-05

- Browser recognition can place more text in the composer than its manual-entry `maxlength`, particularly because transcripts are assigned from JavaScript. Form submission now checks the active question/quiz-answer limit and keeps overlong text available for editing with a clear status message.
- Verification: `node --check web/app.js` and `git diff --check` pass. Transcript editing behavior needs manual browser confirmation.


## Support the Windows Python launcher - 2026-10-05

- The local setup script now falls back to `py -3` when `python` is not on PATH, while keeping the same Python 3.11 minimum check and virtual-environment setup.
- Verification: parsed the PowerShell script for syntax errors and ran `git diff --check`. End-to-end setup with a py-only installation still needs a Windows machine where that exact configuration is available.


## Show the active microphone state - 2026-10-05

- Styled the listening control with a high-contrast active color that remains visible on mobile when its text label is hidden. The button also exposes `aria-pressed` while recognition is active.
- Verification: `node --check web/app.js` and `git diff --check` pass. Visual contrast and screen-reader behavior still need browser review.


## Preserve context when a pending turn is interrupted - 2026-10-05

- When a pending tutor request is stopped, the browser now retains the user's question and an explicit assistant interruption note in the bounded conversation history. A follow-up can still refer to the interrupted topic without suggesting the model finished its answer.
- This preserves client context and stale-turn guards; the server-side provider request may continue until its configured timeout because provider cancellation is not implemented.
- Verification: `node --check web/app.js` and `git diff --check` pass. Interrupt/follow-up behavior needs browser verification with a pending request.


## Keep health checks out of learner progress storage - 2026-10-05

- The `/health` route now skips browser-session creation and does not issue a progress cookie. This prevents cookie-free uptime checks from inserting unused session rows into SQLite.
- Verification: parsed `server.py` with Python's AST parser and ran `git diff --check`. A live HTTP check was not run in this turn.


## Initialize microphone toggle accessibility state - 2026-10-05

- The microphone control now initializes `aria-pressed="false"` at page load, including when speech recognition is unavailable, so assistive technology receives a consistent toggle state before first use.
- Verification: `node --check web/app.js` and `git diff --check` pass.


## Explain empty and unsupported-language STT errors - 2026-10-05

- Added specific recovery guidance for browsers reporting no detected speech or an unsupported recognition language, instead of exposing those common error codes as generic messages.
- Verification: `node --check web/app.js` and `git diff --check` pass. Browser-specific event behavior still requires a manual voice session.


## Avoid session storage for static assets - 2026-10-05

- Session initialization now runs only for the app document and progress/API requests. Health probes, JavaScript/CSS assets, and unknown routes no longer initialize or touch a learner session in SQLite.
- Verification: parsed `server.py` with Python's AST parser and ran `git diff --check`. No live HTTP session/cookie check was run in this turn.


## Keep failed requests in tutor context - 2026-10-05

- Tutor request failures now retain the learner's question and a neutral failure note in the same bounded context used for interrupted turns. Follow-up questions can refer to the failed request without receiving the browser's raw network/provider error as model context.
- Successful, failed, and interrupted turns now use one helper to keep the context window capped at 20 messages.
- Verification: `node --check web/app.js` and `git diff --check` pass. Error and retry behavior needs browser verification.


## Explain common browser TTS failures - 2026-10-05

- Added actionable messages for common synthesis errors: a busy audio device, blocked playback, unavailable language/voice/engine, and utterances that are too long. Unknown browser error codes remain visible with a readable-answer fallback.
- Verification: `node --check web/app.js` and `git diff --check` pass. Device-specific synthesis errors still need manual browser confirmation.


## Handle client disconnects during response writes - 2026-10-05

- JSON and static response bodies now ignore the socket errors associated with a client that disconnected before the server finished writing. This keeps normal browser cancellation from producing a server traceback; it does not stop an in-flight provider request.
- Verification: parsed `server.py` with Python's AST parser and ran `git diff --check`. A real network-abort check was not run.


## Clarify browser-default TTS fallback - 2026-10-05

- When no installed voice matches the selected language, the voice selector now labels Browser default with the unavailable language. Its helper text explains that the browser may use a voice for another language instead of implying a matching voice was found.
- Verification: `node --check web/app.js` and `git diff --check` pass. Actual voice availability and browser fallback behavior still need device testing.


## Export page-local speech diagnostics - 2026-10-05

- Added a collapsible Speech diagnostics panel with a copy action that exports grouped STT/TTS success counts, failure counts, and nearest-rank p50/p95 timings in seconds as JSON, ready to transfer to the run sheet. Empty groups use `null` percentiles; the export contains no transcript text or audio.
- Verification: `node --check web/app.js` and `git diff --check` pass. Clipboard access and responsive layout need manual browser review.


## Map diagnostics exports to the voice run sheet - 2026-10-05

- Updated the manual run sheet with the JSON field paths for TTS start/playback p50/p95, STT first-final p50/p95, sample counts, and failure counts. It explains that `null` percentiles mean the group has no successful samples.
- Verification: reviewed the documented field names against `buildSpeechDiagnostics()` in `web/app.js`; no test suite was run.


## Version and timestamp diagnostic exports - 2026-10-05

- Added a schema version and UTC generation timestamp to copied speech summaries so exported records can be identified and interpreted consistently.
- Verification: `node --check web/app.js` and `git diff --check` pass.


## Download speech diagnostics without clipboard access - 2026-10-05

- Added a Download JSON action beside Copy JSON. It saves a timestamped file locally, while copy failures now direct the learner to the download option.
- Verification: `node --check web/app.js` and `git diff --check` pass. Browser download handling and small-screen layout need manual review.


## Add code-switched retrieval examples - 2026-10-05

- Added four labeled examples for Roman article-number variants, Hindi/English code-switching, Devanagari insertions in Hinglish, and Article 21A age/education wording. Updated the README's constructed retrieval-set size to 30.
- Verification: parsed the JSON and checked IDs and expected note IDs against the current corpus; the retrieval evaluation itself was not run.


## Reject malformed retrieval evaluation labels - 2026-10-05

- The retrieval evaluator now rejects blank IDs/questions/expected labels, language names outside English/Hindi/Hinglish, and duplicate expected document IDs before scoring.
- Verification: parsed `evals/run_retrieval_eval.py` with Python's AST parser and ran `git diff --check`. The evaluation runner was not executed.

## Add minority education protections from Article 30 - 2026-10-05

- Added English, Hindi, and Hinglish summaries and retrieval keywords for Article 30(1), (1A), and (2): minority institutions, protection when their property is compulsorily acquired, and nondiscrimination in State aid. Checked against Article 30 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-05.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The corpus now contains 15 notes and the labeled set contains 55 examples.
- Verification: Node parsed the corpus and evaluation JSON (15 notes, 55 examples), checked Article 30 source/language metadata, and a focused lexical-retrieval check ranked all three Article 30 examples first; `git diff --check` passes. The Python retrieval evaluator was not run; aggregate retrieval metrics remain unmeasured.
- Limitation: the note summarizes constitutional text and is not legal advice; examples are constructed, not real learner queries, and retrieval quality remains unmeasured.
