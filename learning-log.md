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
