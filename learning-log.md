# Learning log

## Update the Article 19 source summary and coverage - 2026-10-08

- Checked the current official Constitution text for Article 19. The English, Hindi, and Hinglish notes now name associations, unions, and co-operative societies; identify sub-clause (f) as omitted; and distinguish restrictions in clauses (2)-(6). Added one retrieval example per language for co-operative-society questions.
- The constructed retrieval evaluation was rerun after the corpus and example updates. It does not measure speech recognition, learner questions, or legal interpretation.


## Require a quiz request before starting quiz tools - 2026-10-08

- The old quiz detector treated any mention of `test` or `viva` as a quiz request, so a question about the Article 14 legal test could start a quiz. English and Roman Hinglish now need request wording such as `test me`, `start a quiz`, `quiz karwao`, or `mera viva lo`; the Devanagari quiz cue also needs an action such as `lo` or `karao`.
- A focused local intent check covered quiz requests and explanatory questions. No API call, browser microphone, or learner audio was used.

## Keep legal revision questions out of study-progress tools - 2026-10-08

- The revision tool previously matched the word `revision` anywhere, so legal questions about a revision petition or procedure could open saved weak-topic progress. Revision now requires explicit request wording such as `help me revise fundamental rights`, `revise Article 14`, or `revision karao`.
- A focused local intent check confirmed these commands still match while questions about revision petitions and procedures remain explanations. No API call, browser microphone, or learner audio was used.

## Keep explanation questions out of the revision tool path - 2026-10-08

- The earlier revision detector treated any standalone `weak` or `kamzor` as a request to read saved progress, so questions about a weak point in a constitutional article could unexpectedly enter revision mode. English and Roman Hinglish now require a revision command phrase such as `weak topics`, `kamzor topics batao`, or `dohrao fundamental rights`; ordinary explanatory questions stay on the answer path. Existing Devanagari cues remain supported.
- A focused local intent check confirmed the revision phrases still activate and weak-point questions about Article 14 no longer do. No API call, browser microphone, or learner audio was used.

## Recognize Roman Hinglish revision requests - 2026-10-08

- The tutor now recognizes Roman Hinglish revision requests such as `kamzor topics batao`, `kamzori dikhao`, `dohrao`, and `dohraana` in both offline command handling and the model tool gate. Previously, `kamzor topics batao` and `dohrao fundamental rights` were not recognized.
- A focused local intent check now recognizes those revision phrases while keeping ordinary questions out of the tool path. No API call, browser microphone, or learner audio was used.

## Show prompt-level STT errors - 2026-10-07

- The local STT scorer now includes attempts, failures, and success-only and all-attempts WER for each prompt ID within a configuration and language. This helps locate phrases behind an aggregate error rate without printing reference or transcript text.
- Verification: JavaScript syntax, a synthetic scorer probe, and whitespace checks passed. No real speech or browser/device behavior was measured; prompt IDs in the output should be self-authored and non-sensitive.

## Cancel pending recorded voice input from Record - 2026-10-07

- The Record control now shows Cancel while microphone permission or server transcription is pending. Cancel invalidates the pending capture or aborts the request, so a late result cannot replace the question box; the separate Stop control still works.
- Verification: JavaScript syntax and whitespace checks passed. The browser permission and provider timing still need the manual run-sheet check; no microphone recording or provider request was used.

## Count empty STT attempts in comparison WER - 2026-10-07

- The local STT scorer now reports `all_attempts_wer` alongside success-only `wer`. A failed or empty transcript contributes one deletion per reference word, so a configuration with many failures cannot appear strong based only on its successful transcripts. Failure counts remain separate.
- Verification: JavaScript syntax, a synthetic two-attempt scoring probe, and `git diff --check` passed. No real speech, browser, or provider evaluation was run; these numbers are only a scorer check.

## Prioritize article references from the current turn - 2026-10-07

- The local and agent tutor routes combined older user questions with the current question before retrieval. If the earlier turn named a different article, that stale reference could win. An explicit article in the current question now scopes retrieval by itself; unreferenced follow-ups still include the last four user questions for context.
- Verification: Python 3.11 syntax compilation passed; a focused retrieval probe selects Article 21 over earlier Article 14 context while retaining history for an unreferenced follow-up. The offline `/api/answer` route returned the Article 21 note and source for the same two-turn scenario. All 129 constructed retrieval examples passed (100% exact match and supported recall@3; 0% unsupported false positives), including three multi-turn cases. This does not measure real learner questions or live-model behavior.

## Ignore client resets while reading the next request - 2026-10-07

- A local offline API smoke check passed, but the server printed a socket traceback when the HTTP client reset its keep-alive connection as the server waited for another request. The request handler now treats connection resets as a normal disconnect at the request loop as well as during response writes.
- Verification: Python 3.11 syntax compilation passed, and a raw local HTTP connection reproduced the reset without a server traceback. `/health` reported offline mode with 36 notes, and a Hindi Article 44 question returned its source. This does not test browser microphone, live model, or speech playback behavior.

## Preserve typed edits during server recording - 2026-10-07

- Editing the question box now discards an active server recording, cancels pending microphone access, or invalidates a pending transcription before aborting its request. A late transcript cannot replace what the user typed.
- Verification: JavaScript syntax and whitespace checks passed. Added manual checks for recording, permission, and transcription timing; those browser/provider interactions remain unverified. No microphone or provider request was used.

## Keep a completed browser transcript ready after a late error - 2026-10-07

- Browser speech recognition now ignores an error event after it has received a nonempty final transcript. A completed transcript stays editable, and its successful timing/status is not replaced by a later failure message. Errors before a final transcript still report the failure.
- Verification: JavaScript syntax and whitespace checks passed. Browser speech event ordering and device behavior still need a manual check; no microphone or provider request was used.

## Add source-backed Article 44 coverage - 2026-10-06

- Added an English, Hindi, and Hinglish summary of Article 44: the State shall endeavour to secure a uniform civil code for citizens throughout India. The note summarizes the constitutional text and does not describe personal laws, a proposed code, or legal interpretation. Checked against Part IV, Article 44, in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed retrieval examples and updated broad-query labels. The corpus now contains 36 notes and the evaluation set has 126 examples.
- Verification: Node.js parsed both JSON files, confirmed unique IDs, valid Article 44 source metadata, one keyword-matching example per language, and broad labels covering all 36 notes. `node --check web/app.js` and `git diff --check` passed. Follow-up evaluation with the repository Python 3.11 environment passed all 126 constructed examples: exact match and supported recall@3 were 100%, unsupported false positives were 0%, and exact match was 100% in English, Hindi, and Hinglish. Browser, live-model, and speech quality were not exercised. Constructed examples do not measure learner or speech performance.

## Handle simple Hindi and Hinglish article questions - 2026-10-06

- Retrieval probes also showed that "What is written/said in Article 42?" and "Article 42 mein kya likha hai?" were rejected, although they refer to the cited article without adding a topic claim. The article-reference filter treated these generic wording tokens as unsupported topics.
- Added common Hindi/Hinglish "says" and "what is written" tokens to the article-reference filter, plus four constructed Hindi/Hinglish examples across the two phrasings. Topic words in the rest of a cited-article question still have to match that note.
- Verification: all four simple Hindi/Hinglish phrasings now retrieve `article-42`; the evaluator passes all 123 constructed examples with 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match in each language; `git diff --check` passed. No browser, live-model, or speech quality was measured.

## Add Article 43 living-wage and cottage-industry coverage - 2026-10-06

- Added an English, Hindi, and Hinglish summary of Article 43 covering living wages, decent work conditions, leisure, social and cultural opportunities, and rural cottage industries. The note does not specify a particular law, wage amount, or entitlement. Checked against Article 43 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added one constructed retrieval example per language and updated the three broad-query labels. The corpus now contains 35 notes and the evaluation set has 119 examples.
- Verification at commit time: Node.js parsed both JSON files, confirmed unique IDs, source metadata, all three language labels and 35-note broad-query expectations, and checked language-matched keyword overlap for the new examples; `git diff --check` passed. The runner reported that it could not run the Python retrieval evaluation. Follow-up verification using the project Python 3.11 environment evaluated all 119 examples: exact match 100%, supported recall@3 100%, unsupported false positives 0%, and exact match 100% in English, Hindi, and Hinglish. All three Article 43 examples retrieved `article-43`. Browser, live-model, and speech behavior were not exercised. The examples are constructed and do not measure learner or speech performance.

## Accept article-number questions phrased with "provide" - 2026-10-06

- A local offline API smoke check showed that "What does Article 42 provide?" returned insufficient evidence despite Article 42 being covered. The article-reference filter treated `provide` as a topic word, so it incorrectly rejected the matched article.
- Added `provide` and `provides` to generic article-query verbs and added the phrase as a constructed English retrieval example. Article-specific topic words still need to match the cited note.
- Verification: direct retrieval now returns `article-42`; the full evaluator passes all 116 constructed examples with 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match in each language; `git diff --check` passed. No post-fix HTTP request or browser/audio check was made. These results do not estimate real learner or speech performance.

## Add Article 42 coverage for humane work and maternity relief - 2026-10-06

- Added a bounded English, Hindi, and Hinglish summary of Article 42, limited to the constitutional direction on just and humane work conditions and maternity relief. The note does not describe a specific law, benefit, or individual entitlement. Checked against Article 42 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed retrieval examples, one per language, and included the note in broad-query labels. The corpus now contains 34 notes and the labeled set contains 115 examples.
- Verification at commit time: Node.js parsed both JSON files and confirmed 34 unique corpus notes, 115 unique evaluation labels, Article 42 source metadata, and one Article 42 expected label in each language plus all three broad-query labels. A focused keyword-overlap check confirmed the three Article 42 examples match the new note; `node --check web/app.js` and `git diff --check` passed. The runner reported it could not execute the Python evaluator. Follow-up verification using the project Python 3.11 environment evaluated all 115 examples: exact match 100%, supported recall@3 100%, unsupported false positives 0%, and exact match 100% in English, Hindi, and Hinglish. All three Article 42 examples retrieved `article-42`. Browser and live-model behavior were not exercised. Examples are constructed and do not measure learner or speech performance.

## Add Article 41 coverage for work, education, and assistance - 2026-10-06

- Added a source-backed English, Hindi, and Hinglish summary of Article 41, limited to the constitutional direction for provisions within the State's economic capacity and development. The note does not describe a specific scheme or claim an individual entitlement. Checked against Article 41 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed retrieval examples and updated broad-query labels. The corpus now contains 33 notes and the labeled set contains 112 examples.
- Verification at commit time: Node.js parsed both JSON files and confirmed 33 unique note IDs, 112 unique evaluation IDs, Article 41 source metadata, and all six expected Article 41 labels; `git diff --check` passed. The retrieval evaluator was unavailable in that run. Follow-up verification with the project Python 3.11 environment evaluated all 112 examples: exact match 100%, supported recall@3 100%, unsupported false positives 0%, and exact match 100% in English, Hindi, and Hinglish. All three Article 41 examples retrieved `article-41`. Browser and live-model behavior remain unverified. These examples are constructed and are not learner or speech performance measurements.

## Add Article 40 village panchayat coverage - 2026-10-06

- Added a bounded English, Hindi, and Hinglish summary of Article 40: the State should organize village panchayats and provide the powers and authority needed for them to function as self-government units. The note does not describe a particular law or panchayat. Checked against Article 40 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed retrieval examples, one per language, and included the note in broad-query labels. The corpus now has 32 notes and the labeled set has 109 examples.
- Verification at commit time: Node parsed the corpus and examples, confirmed 32 unique notes and 109 unique labels, validated Article 40 source metadata and Hindi text, and checked keyword overlap for all three Article 40 examples; `node --check web/app.js` and `git diff --check` passed. The retrieval evaluator was unavailable in that run. Follow-up verification with the project Python 3.11 environment evaluated all 109 examples: exact match 100%, supported recall@3 100%, unsupported false positives 0%, and exact match 100% in English, Hindi, and Hinglish. The three Article 40 examples all retrieved `article-40`. Browser and live-model behavior remain unverified. Examples are constructed and do not measure learner or speech performance.

## Correct the offline corpus count in README - 2026-10-06

- Corrected the setup guidance to match the checked corpus: offline questions outside thirty notes receive an insufficient-evidence response.
- Verification: parsed `data/fundamental_rights.json` with Node and confirmed 30 note records; `git diff --check` passed. No runtime or browser behavior changed.

## Prevent recorded transcripts overwriting a submitted question - 2026-10-06

- Starting a tutor turn now cancels any unfinished server recording and aborts pending recorded-file transcription. Late transcription results can no longer replace the question composer after the learner submits a typed question.
- Verification: `node --check web/app.js` and `git diff --check` passed. The recording/transcription race was not exercised in a browser; provider-side cancellation remains unverified.

## Add a spoken quiz flow evaluation - 2026-10-06

- Added a repeatable manual run-sheet scenario covering audible quiz prompts, editable spoken answers, rubric feedback, progression to the next question, and saved progress after reload. It uses self-authored practice answers and labels the limitation that deterministic phrase matching does not assess meaning.
- Updated the README to link this evaluation coverage and state that browser behavior has not been checked. Verification: reviewed the instructions and table against the existing quiz UI and documented flow; `git diff --check` passed. No browser/device trial was performed, so quiz speech behavior remains unmeasured.

## Refresh broad-query evaluation labels - 2026-10-06

- Updated the three broad Fundamental Rights examples to expect all 29 current notes, matching the explicitly documented corpus-wide behavior. Clarified in the README that these broad prompts return the full note set; this may produce a long offline response.
- Verification: the 100-example constructed retrieval evaluation now reports 100% exact match, 100% supported recall@3, and 0% false positives over eight unsupported examples, with no failures in any language. This aligns the broad labels with the implemented behavior; it does not benchmark answer usefulness or learner outcomes.

## Stop speech when a typed follow-up starts - 2026-10-06

- Submitting a question now cancels active browser speech synthesis and aborts or stops streamed PCM playback before starting the next tutor request. Added a manual run-sheet scenario for sending a typed follow-up during playback.
- Verification: `node --check web/app.js` and `git diff --check` passed. Browser/device playback behavior was not manually exercised, and provider-side generation cancellation remains unimplemented.

## Cover the omitted Article 31 status - 2026-10-06

- Added a concise Article 31 note in English, Hindi, and Hinglish that records its omission from the current constitutional text and links the official footnote to the Forty-fourth Amendment, effective 20 June 1979. The note explicitly avoids interpreting current property law.
- Added constructed retrieval examples in all three languages. The corpus now contains 28 notes and the labeled set contains 97 examples. Updated README coverage counts and limitations.
- Checked the omission footnote in the [official Constitution of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf). Article-numbered status questions retrieve the note in English, Hindi, and Hinglish without making unrelated current-events queries match. The constructed evaluator reports 96.91% exact match, 100% supported recall@3, and 0% false positives across its eight unsupported queries. Three broad-query exact-match cases remain because generic rights queries return more notes than their labels expect. No browser or live-model behavior was exercised; these constructed figures do not measure learner or speech performance.

## Add a streamed speech interruption trial - 2026-10-06

- Added a separate manual run-sheet case for interrupting experimental streamed TTS and immediately starting a new turn. It checks that old audio stays stopped when late chunks arrive and records the selected voice; attempts may incur API usage.
- Verification: reviewed the new case and summary row against the streamed playback controls in `web/app.js`; `git diff --check` passed. No browser/device trial or provider request was performed, so streamed interruption behavior remains unmeasured.

## Add a stale recognition run-sheet case - 2026-10-06

- Added a repeatable manual check for stopping speech recognition and immediately starting a new capture, watching whether delayed events from the stopped capture overwrite the new transcript or status. The instructions distinguish an observed pass from browsers that do not expose delayed events, which should be marked unavailable.
- Verification: reviewed the updated turn-taking checklist and summary table; `git diff --check` passed. No browser/device run was performed, so stale-event behavior was not measured.

## Reject stale streamed audio chunks - 2026-10-06

- Streamed TTS now checks the active speech-turn ID and abort signal before scheduling each PCM chunk. A chunk arriving after Stop, a new turn, or another playback replacement is ignored instead of being queued.
- Verification: `node --check web/app.js` and `git diff --check` passed. The browser audio race was not manually reproduced; provider-side generation cancellation remains unverified.

## Add Article 31C coverage - 2026-10-06

- Added a bounded English, Hindi, and Hinglish note. It covers the Article 39(b)/(c) scope, the Article 14/19 protection, the assent condition for State laws, and the Constitution source footnotes about Minerva Mills and Kesavananda Bharati without generalizing either holding. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-06.
- Added three constructed retrieval examples. The corpus now contains 26 notes and the labeled set contains 91 examples.
- Verification: the corpus loader accepted all 26 notes; focused English, Hindi, and Hinglish retrieval returned only Article 31C. Node confirmed 91 unique examples and valid Article 31C source metadata; `git diff --check` passed. No browser or live-model behavior was exercised; constructed examples do not measure learner or speech performance.

## Cancel quiz setup when stopping - 2026-10-06

- Starting a quiz now uses the same abortable request slot as tutor turns and quiz scoring. Stop or Escape cancels the browser request, while the turn token continues to reject any late response; this avoids leaving quiz creation running after the learner has stopped.
- Updated the README's keyboard shortcut note. Verification: `node --check web/app.js` and `git diff --check` passed. Browser interaction and server-side cancellation were not exercised.

## Add experimental streamed TTS - 2026-10-06

- Added an opt-in server-side OpenAI speech endpoint that streams 24 kHz PCM chunks to the browser, based on the [official TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech). The key stays on the server; the user must enable the checkbox before streamed speech is used, and browser speech remains the default and fallback. Hindi speech is requested for `hi-IN`, but the built-in voice is optimized for English and has not been pronunciation-checked.
- The text answer still finishes before TTS starts; this change streams TTS audio only. Speech diagnostics now label the start-event source: browser synthesis `onstart` or scheduling the first streamed PCM buffer. They are not acoustic onset measurements. The endpoint validates language, voice, and the provider's 4,096-character input limit. Client Stop, Escape, new turns, and language changes abort the request and stop queued audio.
- Verification: Python syntax, `node --check web/app.js`, and `git diff --check` passed; the installed OpenAI SDK exposes the streaming wrapper. Offline `/health` reported 25 notes and no streaming TTS; a valid speech request returned 503 without an API key. A local mock provider sent two PCM chunks, and the route forwarded the first before provider completion. No external provider request or browser listening trial was performed. The feature remains experimental.

## Record end-to-end voice response timing - 2026-10-06

- Added a per-attempt stopwatch field to the manual voice trial sheet for time from the end of the learner's spoken question to the tutor's first audible sound. The instructions distinguish this coarse end-to-end value from browser STT and TTS event timings and label unobservable endpoints unavailable.
- Verification: reviewed the updated trial table and instructions; `git diff --check` passed. No browser/device trials were performed, so no latency result is claimed.

## Add per-language retrieval reporting - 2026-10-06

- Extended the labeled retrieval report with per-language example and support counts, exact match, supported recall@3, and unsupported false-positive rate. Rates with no applicable examples are reported as `null`.
- Documented the added JSON metrics in the README. `python -m py_compile evals/run_retrieval_eval.py` and `git diff --check` passed. The labeled evaluator was not run; the reported examples remain constructed text cases and do not measure learner or speech performance.

## Add Article 31A coverage - 2026-10-06

- Added bounded English, Hindi, and Hinglish summaries of Article 31A(1)'s specified property, corporate, and mineral-related laws. The note says these laws are not void solely for inconsistency with Article 14 or 19, and leaves conditions, definitions, exceptions, assent requirements, compensation, and court interpretation outside its scope. Checked against the Constitution of India published by the Legislative Department, Government of India (https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-06.
- Added one constructed retrieval example per language. The corpus now contains 25 notes and the labeled set contains 88 examples.
- Verification: corpus loader accepted all notes; focused English, Hindi, and Hinglish retrieval checks returned only Article 31A; Node confirmed 25 notes, 88 uniquely identified examples, three Article 31A examples, and source metadata. `node --check web/app.js` and `git diff --check` passed. Browser and live-model behavior were not exercised; retrieval quality remains unmeasured.

## Add Article 35 coverage - 2026-10-06

- Added a bounded English, Hindi, and Hinglish summary of Article 35: Parliament has exclusive power over the specified lawmaking matters listed in Article 16(3), Article 32(3), Articles 33 and 34, and over prescribing punishments for acts declared offences under Part III. Existing laws on those specified matters continue until Parliament changes them. Checked against Article 35 in the Constitution of India published by the Legislative Department, Government of India (https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-06.
- Added one retrieval example per language. The corpus now contains 24 notes and the labeled set contains 85 constructed examples.
- Verification: Node parsed the corpus and examples, and confirmed 24 notes, 85 unique examples, three Article 35 article-reference examples with overlapping article-specific terms, and valid Article 35 source metadata; `node --check web/app.js` and `git diff --check` passed. The full Python retrieval evaluator was not run; a focused Python check confirmed all three Article 35 examples retrieve only the Article 35 note. Browser/live-model behavior was not exercised. Examples are constructed, not learner queries, and retrieval quality remains unmeasured.

## Add Article 34 coverage - 2026-10-06

- Added a bounded English, Hindi, and Hinglish summary of Article 34: Parliament may by law indemnify people for specified acts connected with maintaining or restoring order in an area where martial law was in force, and may validate listed acts done under martial law there. Checked against the Constitution of India published by the Legislative Department, Government of India (https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-06.
- Added one retrieval example per language. The corpus now contains 23 notes and 82 constructed examples.
- Verification: corpus loader accepted all notes; focused retrieval returned only Article 34 for the English, Hindi, and Hinglish examples; git diff --check passed. The full retrieval evaluation was not run; no browser or live-model behavior was exercised.

## Add Article 33 coverage - 2026-10-06

- Added a bounded multilingual note for Article 33: Parliament may determine by law how far rights can be modified for specified forces and services to support duty and discipline. The note avoids claiming which particular restrictions apply. Checked against Article 33 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-06.
- Added English, Hindi, and Hinglish retrieval examples. The corpus now contains 22 notes and the labeled set contains 79 examples.
- Verification: Node parsed both JSON files and confirmed 22 unique notes, 79 unique examples, valid Article 33 source metadata, intact multilingual text, and indexed-term overlap for all three Article 33 examples; `git diff --check` passed. The full Python retrieval evaluator was not run; a focused Python retrieval check confirmed all three Article 33 examples return only the Article 33 note. No browser or live-model behavior was exercised. Examples are constructed, not learner queries, and retrieval quality remains unmeasured.

## Scope retrieval to named articles and abstain on unsupported details - 2026-10-05

- Explicit English, Hinglish, and Hindi article references now search only the named note; if its keywords and summary do not cover the topic, retrieval abstains instead of returning unrelated notes. Broad topic queries retain the full-corpus behavior. This closes false positives where an Article 21 privacy question returned other article notes.
- Verification: the Python loader read all 21 notes; focused checks confirmed three Article 32 queries return only Article 32, three out-of-domain or uncovered-detail queries return no notes, a generic Article 21 query returns Article 21, an unindexed Article 99 abstains, and a broad Fundamental Rights query returns all notes. Python AST parsing and `git diff --check` passed. The full evaluator and browser interactions were not run; aggregate retrieval quality remains unmeasured.

## Broaden multilingual retrieval abstention examples - 2026-10-05

- Added Hinglish out-of-domain and Hindi/Hinglish uncovered-detail cases to check that lexical retrieval abstains across all three supported language categories, not only on existing English/Hindi negatives.
- Updated the README's constructed-set count from 73 to 76 and documented the added coverage. These remain authored text examples, not learner or speech measurements.
- Verification: Node parsed the JSON dataset and checked 76 unique IDs plus the three new records. The Python retrieval evaluator was not run during this pass; retrieval outcomes and aggregate metrics were not yet checked.

## Add an end-to-end voice trial record - 2026-10-05

- Added a compact manual record for fixed self-authored Hindi, English, and Hinglish practice questions, separating transcript usability, displayed-source relevance, answer support, and spoken completion by trial.
- Clarified that an unavailable stage is not evidence that a later stage succeeded, and that these small manual observations are not population-level accuracy results.
- Verification: reviewed the section in context and ran git diff --check. No browser/device interaction was available, so no voice behavior or quality result was measured.

## Add Article 32 remedies and retrieval cases - 2026-10-05

- Added a bounded Article 32 note for the Supreme Court remedy and the writs in clauses (1)–(2), in English, Hindi, and Hinglish, with the checked Constitution source and explicit scope limits. Added one constructed retrieval case per language. The corpus now contains 21 notes and the labeled set contains 73 examples.
- Updated README coverage and evaluation-set counts.
- Verification: the virtual-environment Python loader accepted all 21 notes; the three focused Article 32 examples each ranked `article-32` first, and a general Fundamental Rights query still returns the full corpus. Python syntax parsing and `git diff --check` passed. The full retrieval evaluation and browser/live-model behavior were not run, so aggregate retrieval metrics remain unmeasured.

## Capture individual interruption trials - 2026-10-05

- The browser voice run sheet now has a row for each interruption attempt, records the outcome and visible browser symptom, and asks users to keep run settings fixed or start a separate sheet when they change.
- Verification: reviewed the updated run-sheet section and `git diff --check` passed. No browser/device interaction was performed.

## Preserve answers when stopping quiz score requests - 2026-10-05

- Escape and Stop now keep the submitted quiz answer available for retry, restore microphone availability, and announce when quiz scoring was stopped. Retrying reuses the same idempotency key so an already completed server-side score is not duplicated.
- Verification: `node --check web/app.js` and `git diff --check` passed. Browser interaction and server-side abort behavior have not been exercised.

## Abort in-flight quiz scoring requests - 2026-10-05

- Connected quiz scoring fetches to the shared request abort controller, so Stop and Escape can cancel the browser request and stale results remain ignored by the turn counter. Stopping during scoring returns the quiz to answer entry so the learner can retry.
- Updated the README to explain that a request already received by the server may still finish; its idempotency key makes retrying the same answer safe.
- Verification: `node --check web/app.js` and `git diff --check` pass. Browser interaction and server-side cancellation behavior were not exercised.

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

## Include speech failure categories in diagnostics - 2026-10-06

- Current-page JSON diagnostics now group TTS failures by browser playback error and STT failed/empty attempts by recognition error, with `no-final-transcript` used when recognition ends without a final result or error code. Speech text and audio remain excluded.
- Verification: JavaScript syntax and `git diff --check` passed. Browser-generated STT/TTS failures were not triggered, so the category output was checked statically rather than through a device trial.


## Add Ninth Schedule coverage from Article 31B - 2026-10-06

- Added a concise Article 31B note in English, Hindi, and Hinglish. It summarizes the constitutional text's protection for Ninth Schedule laws against being void solely for conflict with Part III rights and notes legislative repeal or amendment; it does not discuss judicially established limits or assess individual laws. Checked against Article 31B in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), checked on 2026-10-06.
- Added three constructed retrieval examples, one each in English, Hindi, and Hinglish. The corpus now contains 27 notes and the labeled set contains 94 examples.
- Verification: parsed both JSON files and checked that focused English, Hindi, and Hinglish Article 31B queries retrieve `article-31b` first; `git diff --check` passes. The retrieval evaluation suite was not run, and aggregate retrieval quality remains unmeasured.
- Limitation: the note summarizes constitutional text and is not legal advice; examples are constructed, not real learner queries.


## Restore Hindi offline quiz and revision cues - 2026-10-06

- Replaced corrupted mojibake literals in the offline agent intent patterns with explicit Devanagari regex escapes, so Hindi quiz and weak-topic/revision phrases can be recognized again.
- Verification: Python syntax compilation passed; focused regex checks matched the Devanagari quiz and revision cues; `git diff --check` passed. The project test suite was not run.


## Ignore stale speech recognition events - 2026-10-06

- Speech recognition now creates a fresh recognizer per listening run and guards event handlers with a run ID. Delayed start, transcript, error, or end events from a stopped/replaced run cannot update the active transcript or its state.
- Verification: `node --check web/app.js` and `git diff --check` passed. Browser recognition event timing was not exercised on a device; the project test suite was not run.


## Make streamed TTS voice selectable - 2026-10-06

- Added a separately selectable streamed provider voice, defaulting to Coral to preserve existing behavior. The choice is saved with speech preferences and appears in timing groups, allowing repeatable comparisons across voices. Updated the TTS run sheet and corrected the roadmap status from ?consider streaming TTS? to the existing streamed implementation.
- Checked voice options against the [official text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech), which lists 13 voices and says they are optimized for English. Hindi/Hinglish quality remains unevaluated; streamed requests may incur usage.
- Verification: JavaScript syntax passed; the UI voice choices match the server allowlist and default to Coral; `git diff --check` passed. No provider request or browser playback was made.


## Add optional recorded-file speech transcription - 2026-10-06

- Added a separate 20-second MediaRecorder path that uploads WebM or MP4 only after the user stops, returns editable Hindi/English text for review, and does not persist audio in BolPrep. The browser-native recognition button remains available. Server uploads are capped at 5 MB and 1,200 transcript characters.
- The endpoint uses `gpt-transcribe` with an explicit input language. The [official speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text) recommends this model for recorded files and lists WebM among accepted formats. This is recorded-file transcription, not live streaming STT; provider calls may incur usage.
- Verification: Python syntax compilation and JavaScript syntax checks passed; local offline HTTP checks confirmed health and that the transcription route reports unavailable without an API key; `git diff --check` passed. No real audio or provider request was used. Browser microphone behavior remains unverified.


## Cover the Article 39(b) and (c) link in Article 31C - 2026-10-06

- Added a concise Article 39(b) and (c) note in English, Hindi, and Hinglish. It covers distribution of community material resources for the common good and preventing harmful concentration of wealth and means of production; other Article 39 clauses and case interpretation are outside the note. Checked against Part IV, Article 39(b) and (c), in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed English, Hindi, and Hinglish retrieval examples. The corpus now contains 29 notes and the labeled set contains 100 examples.
- Verification: corpus and example JSON parsed with 29 unique note IDs and 100 unique labels. The focused retrieval evaluator reports 97% exact match, 100% supported recall@3, and 0% false positives across eight unsupported queries. Three broad-query examples still fail exact match because retrieval returns all 29 notes while their labels list smaller subsets. A focused token-overlap check matched the three Article 39 examples to the new note; `git diff --check` passed.
- Limitation: the note summarizes constitutional text, not case interpretation or application to any particular law or policy; examples are constructed and do not measure learner or speech performance.

## Keep recorded-file transcription language tied to capture - 2026-10-06

- The optional server-recording flow now captures the selected speech language when recording starts and sends that same language with the clip, even if the selector changes before upload. Recording and transcription status also name the language used.
- Verification: JavaScript syntax and whitespace checks passed. No browser microphone or provider request was made; the timing behavior remains unverified in a browser.


## Clarify voice input interruption for screen readers - 2026-10-06

- Updated the voice button's accessible name and tooltip to tell users that starting voice input interrupts active tutor audio or a turn.
- Verification: `node --check web/app.js` and `git diff --check` pass. Screen-reader announcement and browser interaction were not manually checked.

## Display the captured recording language correctly - 2026-10-06

- The language selector uses locale tags (`hi-IN` and `en-IN`), so comparing the captured value to `hi` mislabeled Hindi recordings as English. Recording and transcription status now map the full locale to the displayed language name.
- Verification: `node --check web/app.js` and `git diff --check` passed. No browser microphone or provider request was made.

## Reuse the existing Python environment in the Windows launcher - 2026-10-06

- The local launcher now checks `.venv\Scripts\python.exe` before requiring a system `python` command or the Windows `py` launcher. This lets an existing Python 3.11+ project environment start BolPrep even when Python is not on `PATH`.
- Verification: ran `tools/run-local.ps1` with no system `python` command available; dependency requirements were already satisfied, the server started in offline mode, and `/health`, `/`, and `/app.js` each returned HTTP 200. The server was stopped after verification. No provider API or speech input was used.

## Add Article 37 coverage for Directive Principles - 2026-10-06

- Added an English, Hindi, and Hinglish Article 37 note describing the text's two points: Part IV principles are not enforceable by courts, and they remain fundamental to governance and a State duty when making laws. The note does not interpret court decisions or apply the principles to specific laws. Checked against Article 37 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed retrieval examples, one per language, and updated broad-query labels. The corpus now has 30 notes and the labeled set has 103 examples.
- Verification: Node.js parsed both JSON files and confirmed unique IDs, 30 notes, and 103 examples. The first retrieval evaluation exposed a Hindi Article 37 miss because the lexical baseline had no Devanagari keywords for the new note. Added Hindi aliases; rerunning `evals/run_retrieval_eval.py` with `.venv\Scripts\python.exe` reports 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match for each language. `git diff --check` passed. No live model or browser interaction was exercised.
- Limitation: these metrics use constructed text prompts and do not measure learner or speech performance; browser behavior remains unverified.

## Cover social order and inequality in Article 38 - 2026-10-06

- Added English, Hindi, and Hinglish summaries of Article 38(1) and (2): welfare and a social order informed by social, economic, and political justice, minimizing income inequalities, and addressing inequalities in status, facilities, and opportunities. The note is limited to the constitutional text and does not assess particular policies or court decisions. Checked against Article 38 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-06.
- Added three constructed English, Hindi, and Hinglish retrieval examples and updated broad-query expectations. The corpus now has 31 notes and the labeled set has 106 examples.
- Verification: the Python retrieval evaluator reports 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match in each language. `git diff --check` passed. Browser and live-model behavior were not exercised; these constructed examples do not measure learner or speech performance.

## Invalidate canceled transcription before the request settles - 2026-10-06

- Stopping a tutor turn now clears the active recorded-audio transcription controller before aborting its fetch. A late completion can no longer replace the question text after a new turn is submitted, and an older handler cannot reset the newer recording button state.
- Verification: `node --check web/app.js` and `git diff --check` passed. Browser/provider cancellation timing was not exercised; no audio or API request was used.

## Stop speech when submitting typed quiz answers - 2026-10-06

- Typed quiz submission now invalidates and stops any current browser or streamed audio before rubric scoring begins, matching ordinary question turn handling. Added a manual run-sheet case for submitting during prompt or feedback playback.
- Verification: `node --check web/app.js` and `git diff --check` passed. No browser or audio playback was available for the interaction check; no API request or real recording was used.


## Record the selected streamed voice in evaluation results - 2026-10-06

- Corrected the voice run sheet to describe the actual selected streamed voice in diagnostics, with Coral shown only as an example. This keeps measurements for alternate provider voices correctly attributed.
- Verification: confirmed the run-sheet text matches the selectable voice labels in the client; `git diff --check` passes. No browser or provider playback was used.


## Document recorded-clip language consistency check - 2026-10-06

- Added a manual STT run-sheet case for changing the language selector during a recorded clip. It checks that the language captured at recording start remains the status and transcription language, in both Hindi-to-English and English-to-Hindi directions.
- Verification: confirmed the run-sheet describes the client behavior that captures `speechLanguage.value` before recording begins; `git diff --check` passed. No recording or provider request was made, so device/provider behavior remains unverified.

## Preserve manual edits during browser recognition - 2026-10-07

- Editing the question box while browser recognition is active now stops listening. This prevents a later recognition result from replacing the user's corrected question or quiz answer.
- Verification: `node --check web/app.js` and `git diff --check` passed. Added a manual run-sheet case for editing during capture; browser and device event timing remains unverified. No recording or provider request was used.

## Measure recorded-file transcription separately - 2026-10-07

- Added current-page, per-language upload-to-result p50/p95 timings and capture, recording, empty-clip, and transcription failure counts for the optional recorded-file STT path. The diagnostics JSON now has a separate `recorded_stt` field in schema version 2; canceled attempts are excluded. The timing begins after capture and is not speech-end latency.
- Updated the README and voice run sheet to keep recorded-file metrics separate from browser recognition and end-to-end stopwatch observations. The export retains counts and timings only, not transcript text or audio.
- Verification: `node --check web/app.js` and `git diff --check` passed. No microphone, provider, or device check was made, so measured latency and failure behavior remain unverified in a browser.

## Keep quiz preparation bound to its turn - 2026-10-07

- Stopping a pending quiz start now makes the quiz button available immediately. A canceled quiz request can no longer re-enable that button while a newer quiz start is still pending.
- Added a manual run-sheet case for stopping and restarting quiz preparation quickly.
- Verification: `node --check web/app.js` and `git diff --check` passed. The request-order race was not exercised in a browser or on a device; no provider call or test suite was used.

## Keep streamed speech completion scoped to its request - 2026-10-07

- Streamed speech now checks its own queued audio sources when deciding whether playback has finished. Audio scheduled by another turn cannot hold up completion of an earlier request.
- Verification: JavaScript syntax and whitespace checks passed. The overlap timing was not exercised in a browser; no provider call or recording was used.

## Report browser recognition start failures - 2026-10-07

- A synchronous browser speech-recognition start failure now counts as a failed attempt for its selected language. Permission or security errors get a permission message; other start errors get a general retry message instead of an inaccurate “already starting” claim.
- Verification: `node --check web/app.js` and `git diff --check` passed. Browser microphone permission and device behavior were not exercised; no recording or provider request was used.

## Preserve the quiz between questions - 2026-10-07

- Stopping the tutor while waiting for **Next question** no longer makes the previous quiz question answerable again. A pending answer is restored only when its scoring request was interrupted.
- Canceling or failing to start a replacement quiz restores **Next question** for the earlier quiz when it was between questions.
- Verification: `node --check web/app.js` and `git diff --check` passed. The click and request timing still needs a browser check; no microphone, provider, or test suite was used.

## Keep final browser transcripts during later interim events - 2026-10-07

- Browser recognition now keeps the final transcript in the question box if a later result event contains only interim words. A new final result can still extend the final text. The first-final timing remains recorded once per listening attempt.
- Verification: JavaScript syntax and whitespace checks passed. The late-event sequence still needs a browser and device check; no microphone, provider, or test suite was used.

## Release browser voice input on recognition errors - 2026-10-07

- A browser recognition error now ends the listening state immediately and counts the failed attempt once, even if the browser sends no later end event. An error after a final transcript leaves that transcript and ready status intact.
- Verification: JavaScript syntax and whitespace checks passed. The error/end event order still needs a browser and device check; no microphone or provider request was used.

## Reset the question box at quiz transitions - 2026-10-07

- A replacement quiz clears the previous answer draft only after the new quiz starts successfully. A failed or canceled start keeps the old quiz and draft available. Completing the last quiz answer restores the ordinary 1200-character question limit.
- Verification: `node --check web/app.js` and `git diff --check` passed. The quiz transition still needs a browser interaction check; no microphone, provider request, or test suite was used.

## Add the Part IV definition of State - 2026-10-07

- Added Article 36 summaries in English, Hindi, and Hinglish. The note records that Part IV uses the Part III meaning of State unless context otherwise requires, without expanding or interpreting that separate definition. Checked against Article 36 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added three constructed retrieval examples and updated broad-query expectations.
- Verification: corpus loads with 37 unique notes; the 132-example retrieval evaluation reports 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure learner or speech performance. `git diff --check` passed.

## Add local STT word error scoring - 2026-10-07

- Added a Node.js scorer for manually paired, self-authored references and transcripts. It reports word error rate by configuration and language, with empty attempts counted separately as failures. The input JSON stays local and ignored by Git; the output contains counts and rates, not transcript text.
- Updated the voice run sheet with the input format and normalization limits. This supports repeatable browser versus recorded-file comparisons on the same phrases, but Roman Hinglish is not transliterated and numeric words are not normalized.
- Verification: `node --check evals/score_stt.js` and `git diff --check` passed. A synthetic local input with one omitted word and one failed attempt reported WER 0.25 and one failure. No real speech, browser/device, or provider evaluation was run, so no speech quality result is claimed.

## Cover the remaining Article 39 policy clauses - 2026-10-07

- Expanded the English, Hindi, and Hinglish Article 39 note to clauses (a)-(f), covering livelihood, common-good distribution, wealth concentration, equal pay, worker and child protections, and children's development. Checked against Article 39 in the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added twelve constructed examples across English, Hindi, and Hinglish for clauses (a), (d), (e), and (f).
- Verification: the 144-example retrieval evaluation reports 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. The constructed examples do not measure real learner or speech performance. `git diff --check` passed.

## Add source-backed Article 39A legal-aid coverage - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 39A's equal-opportunity justice and free legal-aid direction, without describing a particular scheme or giving legal advice. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added three constructed language-specific retrieval examples and updated broad-query expectations.
- Verification: the 147-example retrieval evaluation reports 100% exact match, 100% supported recall@3, 0% unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. The constructed examples do not measure real learner or speech performance. `git diff --check` passed.

## Resume work-loop intervals after pauses - 2026-10-07

- The scheduler now compares each wait against an absolute UTC due time instead of subtracting fixed sleep slices. If the process is paused and resumes before its deadline, an overdue task can start immediately instead of waiting through the full interval again. Stop requests are still checked at most 30 seconds apart, and the original deadline remains in force.
- Verification: the PowerShell parser reported no syntax errors, and `git diff --check` passed. The bounded loop will be restarted on this version and its first scheduled UTC due time checked.

## Synchronize README with the current corpus and voice paths - 2026-10-07

- Updated the roadmap count from 35 to 38 checked corpus notes and the retrieval evaluation count from 129 to 147 constructed examples. Clarified that streamed provider TTS and recorded-file STT exist experimentally, while keeping their evaluation limitations in place.
- Verification: the retrieval evaluator reports 147 examples, 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match for English, Hindi, and Hinglish. `git diff --check` passed.

## Stream model text into the tutor conversation - 2026-10-07

- Model-mode tutor turns now stream Responses API text deltas over a chunked NDJSON response, and the browser renders partial text while generation continues. The final event supplies the completed answer, sources, and tool results; offline mode still sends a single completed result. Stopping removes partial text and closes the local consumer stream, but provider-side cancellation is not claimed.
- Added a manual model-stream check to the voice run sheet. The live provider/browser behavior remains unverified because no API request or browser microphone session was used.
- Verification: `py_compile` for the changed Python modules, `node --check web/app.js`, and an offline HTTP smoke check are recorded with this change; `git diff --check` passed.

## Measure streamed model response latency - 2026-10-07

- Speech diagnostics now group model-mode turns by selected language and export browser request-to-first-text and total request-to-completion p50/p95, completed counts, failures, and cancellations. Offline turns are excluded; partial/complete answer text is never stored in the metrics. Each page retains at most 500 timing samples and 500 failure/cancellation records until reload.
- Updated the manual voice run sheet and diagnostic privacy copy. These fields are measurement instrumentation only; no real model runs have been collected.
- Verification: `node --check web/app.js`, Python syntax checks from the streaming-text change, an offline HTTP smoke check, and `git diff --check` passed.

## Tag model-stream timings with the configured model - 2026-10-07

- The local health response now includes the configured model name only when model mode is active; it never exposes an API key. Model stream diagnostics group by both model name and selected language so later exports can compare configurations on the same manual examples.
- Added the model name to the voice run sheet. No model calls or live speech were used.
- Verification: Python syntax and JavaScript syntax checks, an offline health/response smoke check, and `git diff --check` passed; live model-mode health output still requires a configured API key.

## Classify late model-stream results as cancellations - 2026-10-07

- A stopped model turn that finishes just as the browser changes turns no longer contributes a successful response timing. If its completed payload arrives late, diagnostics count it as canceled. A stale stream error is also counted as canceled rather than a provider failure.
- Verification: JavaScript syntax and whitespace checks passed. The browser race and live model stream remain unverified without a configured provider session.

## Add Article 45 early-childhood education coverage - 2026-10-07

- Added an English, Hindi, and Hinglish summary of Article 45: the State shall endeavour to provide early childhood care and education for all children until age six. Kept the note at constitutional-text scope and avoided claims about specific programs or entitlements. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the new note in all three broad corpus queries.
- Verification: corpus loads with 39 unique notes; the 150-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Add Article 46 coverage for weaker-section interests - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 46's direction to promote the educational and economic interests of weaker sections, particularly Scheduled Castes and Scheduled Tribes, and protect them from social injustice and exploitation. The note stays at constitutional-text scope and does not describe a program or remedy. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the note in all three broad corpus queries.
- Verification: corpus loads with 40 unique notes; the 153-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Add Article 47 nutrition and public-health coverage - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 47's directions on nutrition, living standards, public health, and the stated medicinal-purpose exception. The note stays at constitutional-text scope and does not describe a particular policy or law. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the note in all three broad corpus queries.
- Verification: corpus loads with 41 unique notes; the 156-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Add Article 48 agriculture and animal-husbandry coverage - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 48 on agriculture, animal husbandry, cattle-breed preservation and improvement, and the text's specified slaughter prohibition. The note does not interpret a particular law or policy. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the note in all three broad corpus queries.
- Verification: corpus loads with 42 unique notes; the 159-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Add Article 49 protection-of-monuments coverage - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 49, retaining the qualification that the covered monuments, places, and objects must be declared nationally important by or under parliamentary law. The note summarizes the listed protections without identifying particular sites or laws. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the note in all three broad corpus queries.
- Verification: corpus loads with 43 unique notes; the 162-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Add Article 50 judiciary-executive separation coverage - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 50's direction to separate the judiciary from the executive in State public services. The note stays at constitutional-text scope and avoids claims about specific administrative structures or legal interpretation. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the note in all three broad corpus queries.
- Verification: corpus loads with 44 unique notes; the 165-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Add Article 51 international-relations coverage - 2026-10-07

- Added English, Hindi, and Hinglish summaries of Article 51's State endeavours on international peace and security, relations between nations, international law and treaty obligations, and arbitration. The note does not assess particular foreign-policy decisions or disputes. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language and included the note in all three broad corpus queries.
- Verification: corpus loads with 45 unique notes; the 168-example retrieval evaluation reports 100% exact match, 100% supported recall@3, zero unsupported false positives, and 100% exact match in English, Hindi, and Hinglish. These constructed prompts do not measure real learner or speech performance. `git diff --check` passed.

## Keep STT comparison prompts identifiable - 2026-10-07

- The local STT scorer now requires a `prompt_id` for each attempt, rejects a changed normalized reference under the same language and prompt ID, and reports distinct prompt counts for each configuration and language. The run sheet shows how to reuse an ID for repeated attempts. Counts alone do not establish that two configurations used the same full prompt set.
- Verification: `node --check evals/score_stt.js`, a synthetic local scorer invocation with one successful and one failed transcript, a mismatched-reference rejection, and `git diff --check` passed. No real speech or browser behavior was measured. Python is unavailable in this task environment, so no retrieval change or Python check was made.

## Add Articles 43A and 43B coverage - 2026-10-07

- Added source-linked English, Hindi, and Hinglish summaries of Article 43A on workers' participation in industry management and Article 43B on voluntary formation, autonomous functioning, democratic control, and professional management of cooperative societies. Both notes stay within the constitutional text and avoid describing specific schemes or individual entitlements. Checked against the [Constitution of India published by the Legislative Department, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), on 2026-10-07.
- Added one constructed retrieval example per language for each article and updated all three broad-corpus labels.


## Report STT comparison input parity - 2026-10-07

- Extended the local STT scorer to report whether configurations for each language use the same prompt IDs and the same number of attempts per prompt. It reports the common prompt count and leaves comparison flags null when only one configuration is present; this makes mismatched comparison inputs visible without claiming a quality result.
- Updated the run sheet and README with the new fields and interpretation.


## Limit Responses tools to quiz and revision intent - 2026-10-07

- The model agent now sends quiz and progress tools only when the current question matches the existing quiz or revision cues. Ordinary explanation turns omit tool schemas and tool-specific instructions; the offline tutor shares the same intent patterns. This reduces accidental tool calls on study questions.
- Updated the README, including a stale corpus limitation that incorrectly said Articles 43A and 43B were missing.

## Preserve quiz answer edits during scoring - 2026-10-07

- When quiz scoring is stopped or fails, the submitted answer returns to the input box only if it is empty. A new draft typed while scoring is pending now stays in place for review or retry.
- Added a browser run-sheet case for editing during scoring and stopping before the score arrives.
- Verification: JavaScript syntax and whitespace checks passed. The timing of real browser edits and server scoring remains unverified on a device.


## Speak model sentences while text streams - 2026-10-07

- Added a server stream-mode event that enables progressive browser speech only for ordinary model turns without tools. The browser queues complete sentences as text deltas arrive, flushes the final remainder when the response completes, and uses the existing stop control, stale-turn guard, selected browser voice, and speech timing diagnostics. Quiz/revision tool turns, offline replies, and optional provider TTS keep their complete-answer speech behavior.
- Updated README timing limitations and the browser run sheet. Live model, browser, and microphone playback were not available for verification.

## Keep progressive speech errors visible - 2026-10-07

- When browser speech fails during a streaming model answer, later text deltas and answer completion now leave the speech error visible. The answer continues to render as text, and the existing TTS diagnostic records the failure.
- Verification: JavaScript syntax and whitespace checks passed. Browser speech error timing and live model playback remain unverified on a device.


## Recover an unusable local Python environment - 2026-10-08

- The Windows launcher now checks that `.venv` can start Python 3.11 or later. If it is missing, broken, or older, the launcher rebuilds the repository-local environment with the selected supported Python before installing dependencies. It refuses to clear a linked `.venv` directory.
- Verification: the PowerShell script parser accepted the launcher; the existing Python 3.11.9 environment reused successfully, dependencies were already satisfied, `/health` returned offline mode with 47 notes, and the home page and `app.js` returned HTTP 200. The broken-environment reset branch was not exercised in this run.

## Restore the composer after unconfirmed browser speech - 2026-10-08

- Browser recognition now restores the text present before listening when an attempt errors or ends without a final transcript. Interim words remain visible while listening, but cannot be mistaken for a confirmed transcript after that attempt fails. A final transcript remains available for review.
- Added a browser run-sheet case for interim words followed by an error or normal end without a final result.
- Verification: JavaScript syntax and whitespace checks passed. Browser event ordering and microphone behavior still need a device check; no speech quality result is claimed.

## Verify the local offline tutor response stream - 2026-10-08

- Started the app with `tools/run-local.ps1` on Windows and exercised `/health`, the home page, `app.js`, and `/api/agent/turn` over localhost. Health reported offline mode and 47 notes; the page and script returned HTTP 200; the NDJSON turn ended with a 272-character offline answer and one source citation.
- This confirms the local text tutor path only. No model API, microphone, browser speech recognition, or audible playback was used.

## Verify local quiz scoring and progress lifecycle - 2026-10-08

- Through the localhost API, started a one-question quiz, submitted a rubric-matching answer, and confirmed a complete 100% result appeared in browser-session progress. Retrying the same answer with its idempotency key left the attempt count at one.
- Cleared the isolated synthetic session and confirmed its progress returned to zero. This exercised the deterministic backend flow, not the browser interface, spoken answers, or model tools.

## Keep Escape available while progressive speech is queued - 2026-10-08

- The Escape shortcut now treats an active progressive browser-speech controller as work to stop, including the interval before its first sentence starts playing. The run sheet includes that timing window and a follow-up check.
- Verification: JavaScript syntax and whitespace checks passed. The browser event timing and audible playback still need a device check; this does not establish speech quality or provider-side cancellation.

## Observe browser speech start on an offline answer - 2026-10-08

- In Chrome, submitted a typed Article 14 question to the offline tutor. The cited answer appeared and the status reported browser speech starting after 1.42 seconds.
- This confirms the browser `speechSynthesis` start event for that attempt, not that sound was audible or intelligible. The browser session was interrupted before completion; no microphone or model API was used.

## Prepare a truthful portfolio demo outline - 2026-10-08

- Added a recording outline for the reproducible offline tutor, browser speech, local quiz/progress, interruption checks, and diagnostics. It separates optional model-mode demonstrations and calls out provider cancellation, browser support, and measured-quality limitations.
- Linked the outline from the README. No video was recorded; the steps remain subject to the browser run sheet and actual device availability.

## Add selectable browser speech rates - 2026-10-08

- Added slower, standard, and faster controls for browser TTS and progressive browser TTS. The selected rate persists with speech preferences; changing it stops current browser playback and applies the new rate to the next utterance. The setting is disabled while provider-streamed speech is selected.
- TTS timing diagnostics now group browser speech by rate and include the rate in JSON; the run sheet records it for comparisons. Provider-streamed timing groups report no browser rate.
- Verification: `node --check web/app.js` and `git diff --check` passed. Rate changes, preference restore, and audible speed differences still need a browser/device check.

## Discard unconfirmed words when stopping browser recognition - 2026-10-08

- Pressing **Stop** on the Speak control now restores the question text from before listening if recognition has only interim words. A confirmed final transcript stays in the box for review. This keeps canceled partial recognition from looking like a ready question.
- Added manual run-sheet checks for both cancellation stages. JavaScript syntax and whitespace checks passed; the browser event ordering and microphone behavior still need a device check.

## Prevent an off-topic retrieval false positive - 2026-10-08

- A local request for “How do black holes form?” retrieved Article 20 because the common English word `do` was missing from the tokenizer stop words. Added it so request phrasing alone does not count as polity evidence.
- A focused retrieval check now returns no note for that off-topic prompt while “What does Article 14 say?” still returns Article 14. The offline `/api/agent/turn` response now has no sources and says the checked notes do not cover it. This single example is not a broad false-positive benchmark.
- Eight additional hand-written English questions about passports, bank accounts, photosynthesis, cricket results, address changes, restaurant licenses, France's capital, and diabetes symptoms also returned no notes. This narrow probe is not part of the labeled retrieval set or a representative false-positive rate.

## Add source-backed Article 51A coverage - 2026-10-08

- Added English, Hindi, and Hinglish notes for Article 51A, covering its listed fundamental duties and the parent or guardian education duty for ages six to fourteen. The note links to the official Legislative Department Constitution text and avoids claims about legal enforceability.
- Added one constructed retrieval example per language. All three targeted questions retrieved only `article-51a` using the local retrieval function. JSON loaded as 48 notes and 177 examples. The subsequent constructed evaluation completed with 100% exact match, 100% supported recall@3, and 0% unsupported false positives; see the README for counts and per-language results.
- Source: [The Constitution of India, Legislative Department](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf), Part IVA, Article 51A (checked 2026-10-08).

## Recheck retrieval evaluation after corpus expansion - 2026-10-08

- The expanded evaluation initially found three stale broad-corpus labels. Added Article 51A to those expected sets because broad starter-note questions intentionally retrieve the full corpus.
- Reran `evals/run_retrieval_eval.py`: 177 examples (169 supported, 8 unsupported), 100% exact match, 100% supported recall@3, and 0% unsupported false positives; each language also had 100% exact match. This is a constructed lexical retrieval set, not real learner or speech performance.

## Complete the Article 51A duty summary - 2026-10-08

- Reviewed the note against the official text and filled in details that the first summary had compressed too far: abiding by the Constitution, rendering national service, brotherhood across diversity, renouncing practices derogatory to women, named environmental protections, and excellence across individual and collective activity. Updated the English, Hindi, and Hinglish summaries while keeping the no-legal-interpretation limit.
- Retrieved Article 51A by direct article-reference questions in the previous focused check. This content edit does not change retrieval terms or the reported evaluation results.

## Keep unconfirmed browser speech out of questions - 2026-10-08

- The tutor Stop control, Escape, and a speech-language change now restore the question text from before listening when browser recognition has only interim words. A final transcript remains available for review. Editing the box still keeps the student's edit.
- Submitting a question or quiz answer while only interim words are visible now waits for a final transcript, so an unconfirmed recognition result is not sent as the student's answer.
- Added manual run-sheet checks for interim submission and each cancellation route. Browser recognition event ordering still needs device verification; no speech accuracy result is claimed.

## Add opt-in automatic submission for browser speech - 2026-10-08

- Added a session-only checkbox to send a final browser-recognized transcript when listening ends naturally. It is off by default; Stop keeps a final transcript in the question box for review, and interim-only recognition still cannot be submitted.
- This connects browser STT to the existing tutor answer and speech flow when a learner opts in. `node --check web/app.js` and `git diff --check` passed. Natural recognition completion and audible response still need a supported-browser/device check; no microphone was used here.

## Keep revised quiz answers separate from retries - 2026-10-08

- Quiz scoring now keeps the retry key only when the submitted answer text is unchanged. A revised answer after Stop or a scoring error gets a new key. If the earlier request already saved a score, the server reports a conflict instead of silently showing that score for the revision; if it did not save, the revision can be scored.
- Verification: `node --check web/app.js` and `git diff --check` passed. The browser run sheet now covers this race; browser timing and the saved-versus-canceled ordering still need a device check.
## Measure automatic voice-turn start timing - 2026-10-08

- Speech diagnostics now capture opted-in browser voice turns from the recognition `onend` event to the first tutor playback event, grouped by input/output language and the playback start event. The `automatic_voice_turns` JSON section reports sample counts and p50/p95. Samples are page-local and capped at 500.
- This is a software event interval, not acoustic latency or a measurement from the end of the learner's speech. `node --check web/app.js` and `git diff --check` passed; the metric still needs a supported-browser/device run with speech input and playback.

## Explain saved-answer retry conflicts - 2026-10-08

- When the server reports that a different answer was already saved for the quiz question, the status now tells the learner to start a new quiz instead of suggesting the conflicting answer can be retried. Other scoring errors keep the normal retry guidance.
- `node --check web/app.js` and `git diff --check` passed. The saved-versus-revised answer race still needs the browser run-sheet check.

## Separate STT failure causes in local scoring - 2026-10-08

- The optional `failure_reason` field now groups failed or empty transcript attempts under fixed cause codes. Missing reasons appear as `unclassified`; successful transcripts cannot carry a failure reason. The run sheet and README explain the new output.
- `node --check evals/score_stt.js`, `git diff --check`, and a synthetic three-attempt CLI run passed; the run reported one `no-speech` and one `unclassified` failure. No real speech was evaluated, and these counts depend on accurate manual labeling.
- The repository-local Python environment could not start in this task environment, so no Python retrieval change or evaluation was attempted.

## Add a repeatable offline startup check - 2026-10-08

- Added `tools/check-local.ps1` to start a temporary local server in forced offline mode, verify health and the tutor page, and confirm a Hinglish Article 14 answer includes a source. The script stops the server and restores the caller's API-key environment variable afterward; temporary logs are ignored and removed.
- This gives Windows users a quick end-to-end setup check without a provider key, browser microphone, or external API call. Requires the prepared `.venv` and free port 8000.

## Add character error rate to the STT scorer - 2026-10-08

- The local scorer now reports CER alongside WER, both by configuration/language and by prompt. CER uses Unicode NFC code points from the same lowercased, punctuation-stripped, whitespace-normalized text; spaces between words count. Failed attempts contribute deletion errors in the all-attempts rate.
- This gives Devanagari and mixed-script comparisons a second view of recognition differences. It does not assess pronunciation or normalize transliteration; no real speech result is claimed.
- Verification: `node --check evals/score_stt.js`, `git diff --check`, and a local two-attempt Hindi sample passed. The one-character deletion reported WER 1.0 and CER 0.1667; adding a `no-speech` failure changed all-attempts CER to 0.5833. No microphone or provider was used.

## Explain recorded microphone capture failures - 2026-10-08

- Recorded-file capture now recognizes common permission, blocked-page, missing-device, device-busy, and unsupported-input errors. It gives a direct recovery hint and keeps the bounded reason code in the existing per-language diagnostics instead of labeling every microphone setup error as a generic capture failure.
- The messages follow the browser's standard `getUserMedia()` error categories. `node --check web/app.js` and `git diff --check` passed; real microphone permission and device failures still need browser/device verification.

## Exercise saved quiz flow in the offline smoke check - 2026-10-08

- The local progress database can now be selected with `BOLPREP_DATABASE_PATH`. The offline smoke check uses a unique temporary database to start a one-question quiz, score an answer, retry the same idempotency key, and verify only one saved progress entry appears, then removes its temporary database files.
- This checks the local quiz and persistence path without changing a learner's saved progress or contacting a model provider. Verification: the offline smoke command reported quiz start, score, idempotent retry, and progress passed; the isolated database directory was removed, and nothing remained listening on port 8000.
