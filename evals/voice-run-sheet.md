# Browser voice evaluation run sheet

Use this sheet to compare browser-provided speech features on the same device and phrases. It is a small manual check, not a representative benchmark. To review model streaming, enable model mode and submit a self-authored study question. With browser speech selected, note whether the first complete sentence is spoken before text generation completes; with provider TTS selected, speech starts after the complete answer. Press Stop during generation and record whether partial text disappears, playback stops, and no late text or speech appears. Repeat in Hindi/Hinglish and English. Mark unavailable without a configured API key; do not infer provider cancellation from the client display.

## Record the setup

- Date and time:
- Browser and version:
- Operating system and device:
- Network state:
- Speech language selected in BolPrep:
- TTS provider and voice selected (browser or streamed OpenAI voice):
- Installed TTS voice selected (name and locale):
- Browser speech rate selected (if browser speech is used):
- Browser-provided STT available:
- Server recorded-file transcription available:
- Configured model name for model-mode timing comparisons:

Do not record or upload learner audio for this run. The app keeps timing summaries in page memory and does not retain transcript text in those metrics. Expand **Speech diagnostics** and use **Copy JSON** or **Download JSON** to export grouped timing and failure counts; the export contains no transcript text or audio and clears on reload.

## TTS checks

For tutor-turn debugging, inspect the schema 6 `tutor_turns` diagnostics entries after an explanation, quiz/revision request, and interrupted turn. Check request ID, outcome, durations, source count, and actual tool outcomes against the visible result. A server-reported failure carries the same ID in the server log. Missing server metadata after an early disconnect is unavailable evidence; `usage: null` means complete token usage is unavailable. When present, usage sums provider input/output/total counts across completed model responses in the turn; compare model_response_count and usage_response_count to check coverage. Speech usage and monetary cost are unavailable. These timings exclude the subsequent speech path.

Use **Preview** for the fixed English phrase. For Hindi and Hinglish, run BolPrep without an API key, ask the corresponding fixed offline question in the STT table, and repeat the same answer at least ten times. To compare streamed speech, configure the server API key, enable **Use experimental streamed OpenAI speech**, choose a provider voice, and repeat the same phrase; each streamed attempt may incur API usage. The [official TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech) lists the 13 available voices and notes they are optimized for English. Keep the browser, device, provider, voice, language, and question/answer the same within a comparison. Reloading the page clears the timing samples. Since Hindi/Hinglish samples use tutor answers while English uses Preview, compare p50/p95 only within the same sample type.

| Language | TTS phrase / question | Intelligibility (1-5) | Pronunciation (1-5) | Naturalness (1-5) | Notes / failures |
| --- | --- | ---: | ---: | ---: | --- |
| Hindi | Use Hindi STT prompt below; listen to the offline tutor answer. | | | | |
| Hinglish | Use Hinglish STT prompt below; listen to the offline tutor answer. | | | | |
| English | Hello, let's study fundamental rights together. | | | | |

From the copied JSON `tts` entries, transfer `start_delay.p50_s` / `start_delay.p95_s` and `playback_duration.p50_s` / `playback_duration.p95_s` into the matching language, voice, and sample-type row (Preview or tutor answer). Streamed runs are labeled `OpenAI <selected voice>` (for example, `OpenAI coral`). Check `start_event`: browser timings begin at the synthesis `onstart` event, while streamed timings begin when the first PCM buffer is scheduled; neither is an acoustic measurement. Use the end-to-end stopwatch below for first-audible timing. `completed_count` is Runs; `failure_count` is Failures. A `null` timing means no successful playback was recorded for that group.

Keep the selected browser speech rate fixed during a comparison and record it with the language, voice, browser, and sample type. The diagnostics group browser TTS timings by rate; a rate change starts a separate group. Provider-streamed speech does not use this browser rate setting.

| Language / voice / browser rate | Sample type | Runs | Start p50 / p95 (s) | Playback p50 / p95 (s) | Failures |
| --- | --- | ---: | ---: | ---: | --- |
| | | | | | |

## STT checks

For repeatable word error rate (WER) and character error rate (CER), copy each self-authored reference and raw transcript into an ignored `evals/local-stt-trials.json` file. Use one entry per attempt, including failed or empty recognition as `null`. Optionally add `failure_reason` to a failed attempt using one of `no-speech`, `permission-denied`, `device-error`, `network-error`, `unsupported-language`, `empty-transcript`, or `other`; leave it out when the cause is unknown. Give repeated attempts at the same phrase the same `prompt_id`; use that ID and reference across configurations. Keep the same spoken phrases and device when comparing configurations; name each browser recognizer or recorded-file provider and setting distinctly in `config`. A starter shape is:

```json
[
  {"config":"browser hi-IN","language":"Hindi","prompt_id":"article-14","reference":"अनुच्छेद 14 क्या कहता है","transcript":"अनुच्छेद 14 क्या कहता है"},
  {"config":"browser hi-IN","language":"Hindi","prompt_id":"article-14","reference":"अनुच्छेद 14 क्या कहता है","transcript":null,"failure_reason":"no-speech"}
]
```

Run `node evals/score_stt.js evals/local-stt-trials.json` from the project folder. The scorer checks that each language and `prompt_id` has one normalized reference, reports distinct prompt counts, and compares prompt IDs and attempt counts across configurations. Compare results only when `prompt_set_match` and `repeat_counts_match` are `true`; both fields are `null` when only one configuration is present. A mismatch shows that the inputs differ, not that one recognizer is better. It prints counts and micro WER (`word edits / reference words`) and CER (`Unicode code-point edits / normalized reference code points`, including spaces between words) for successful transcripts and across all attempts, plus failed attempts separately. The output fields are `wer`, `all_attempts_wer`, `cer`, and `all_attempts_cer`; the same metrics appear under `prompt_results`. Failed or empty transcripts count as deleting every reference word and character in the all-attempts rates, so compare those rates and the failure count alongside success-only scores. Text is lowercased, normalized to Unicode NFC, stripped of punctuation and symbols, and split on whitespace before scoring. CER counts code points, not perceived pronunciation; neither metric transliterates Roman Hinglish or normalizes number words. Inspect those differences alongside both scores. Empty results are failures, not zero-error transcripts. The file stays local through `.gitignore`; delete it when no longer needed. This scorer has not been run on real speech, and the sample above is illustrative only.

Read each prompt once at a natural pace. Compare the recognized text with the reference and note omitted, substituted, or extra words. Repeat at least ten times per language before interpreting the displayed latency p50/p95. For the optional server path, configure an API key, click **Record**, stop after speaking a self-authored phrase, and compare the editable transcript. The completed recording is sent to the configured provider and may incur usage; this path transcribes after recording and is not live STT. To check the captured-language behavior, start a recording with Hindi selected, change the selector to English before stopping, then review the transcript. The status and server request should still use Hindi/Hinglish for that clip because its language is fixed at recording start. Repeat with the languages reversed; record the start selection, selection at stop, displayed language, and transcript outcome. This check requires the optional provider and a self-authored phrase; otherwise mark it unavailable.

| Language | Reference prompt | Recognized text | Exact match? | Error notes |
| --- | --- | --- | --- | --- |
| Hindi | अनुच्छेद 14 में समानता के दो विचार क्या हैं? | | | |
| Hinglish | Article 14 mein equality ke do ideas kya hain? | | | |
| English | What two ideas does Article 14 protect? | | | |

From the copied JSON `stt` entries, transfer `time_to_first_final.p50_s` / `time_to_first_final.p95_s` by language. `final_transcript_count` is Runs; `failed_or_empty_count` is Failed / empty results. A `null` timing means no successful final transcript was recorded for that language. Browser STT and recorded-file STT use separate export fields and timing boundaries.

| Language / STT locale | Runs | First-final p50 / p95 (s) | Failed / empty results | Notes |
| --- | ---: | ---: | ---: | --- |
| | | | | |

For the optional recorded-file path, use `recorded_stt` entries. `upload_to_result` starts after the clip is captured and ends when the transcript arrives in the browser; it includes upload and provider processing, but excludes recording time. `completed_count` counts nonempty transcripts; `failure_count` includes capture, recording, empty-clip, and transcription failures. Canceled attempts are excluded. Keep its timings separate from browser recognition and the end-to-end stopwatch.

| Language / recorded STT locale | Runs | Upload-to-result p50 / p95 (s) | Failures | Notes |
| --- | ---: | ---: | ---: | --- |
| | | | | |

For recorded transcription recovery, use a controlled stalled connection and check that the 90-second client deadline restores the Record control, keeps the previous composer text, and adds one `transcription-timeout` failure. Cancel a separate pending attempt and confirm it adds no failure. Keep the tab active during the deadline check; suspended tabs may delay timers. Mark unavailable when a stalled request cannot be reproduced. This checks client recovery, not provider cancellation.

## End-to-end voice trial record

Use a fixed, self-authored practice question for each language. For every attempt, compare the recognized transcript with what you said, then check the answer against the displayed study source. When a spoken answer is produced, use a stopwatch to time from the end of your spoken question to the first audible tutor sound; record seconds to one decimal place. Start timing when you finish speaking, not when the final transcript appears. Mark unavailable if either endpoint cannot be observed, and do not infer success from a later stage.

| Language | Trial | Intended question | Transcript usable? | Source shown and relevant? | Answer supported by source? | Spoken answer completed? | Speech-end to first-audio (s) | Failure stage / notes |
| --- | ---: | --- | --- | --- | --- | --- | ---: | --- |
| | 1 | | | | | | | |
| | 2 | | | | | | | |
| | 3 | | | | | | | |

For transcript usability, record whether the meaning and any named article number survived recognition; exact wording is not required. For source relevance and answer support, cite the article shown and note any claim that the source does not support. The stopwatch value is a coarse end-to-end observation for that attempt; it includes browser recognition, tutor response, and speech startup, so do not add it to the UI's STT or TTS timings. Keep these observations separate from listener ratings above. This small manual record does not measure population-level accuracy.
## Report carefully

- Include browser, device, selected voice/locale, sample phrase, run count, and failures with any results.
- The UI reports browser event timings, not end-to-end model latency. It does not measure speech quality automatically.
- Listener ratings are subjective. Record them with the rater's consent; do not treat one person's ratings as a general result.
- Never describe these small manual samples as production, learner, or population-level benchmarks.

## Model response-language checks (not yet performed)

With optional model access available, select English and ask a short Hindi/Hinglish article question without an explicit response-language command; inspect an English explanation, unchanged article citation, and matching speech settings. Switch to Hindi/Hinglish and ask in Roman text, then Devanagari; inspect Roman Hinglish and Hindi responses respectively. Continue with a generic clarification after switching preferences and inspect retained topic context rather than an unrelated restart. Explicitly request another language in the current question and inspect whether the model follows it; speech still uses the selected voice/language, so adjust settings for playback if needed. Repeat with a quiz/revision request to inspect narration and tool language choices; tool arguments remain model-generated within existing validation. Inspect the legacy tutor API with both supported preferences and compare offline notes, which do not parse explicit language requests. Check that localized evidence preserves article IDs/citations and unsupported questions still abstain. The terminal path without a supplied preference should continue to infer response language. These checks require configured model access and have not been performed; prompt guidance does not guarantee compliance or speech quality.

## Saved conversation browser checks (not yet performed)

Use self-authored text and a private local database. Ask a question, choose Save conversation, inspect the list, reload, and Open. Check bounded text, citations, saved language, follow-up retrieval context, and explicit Listen again playback; no automatic speech or quiz resumption should occur. Confirm no text is saved before Save, no audio/unsent draft/partial streamed delta is included, and latest-20 message clipping is clear. Repeat unchanged Save in one tab and inspect a single retained record; alter content/language and save again. Reload/reopen starts a new save identity. During delayed Open, type a new draft, ask another question, start capture/playback, or start New session: changed work must prevent restoration. Opening with unchanged work should stop active work and close capture without later callbacks restoring old output. Exercise invalid list/snapshot data, 1 MiB responses, timeout, quota/access failure, and retry recovery. A timed-out save/delete may have completed; inspect Refresh before deciding what to retry. Confirm Delete cancellation keeps records and confirmed deletion keeps current text and quiz scores. Inspect keyboard focus, screen-reader status, long titles, and narrow layout. These browser checks have not been performed.

### Saved request details

Inspect Request details on a completed offline/model tutor answer and on a visible server failure when a valid trace is available. Explicitly save, reload, and Open: compare request ID, UTC start, duration, mode/model, source count, tool flags, and available token counts. No new model/speech request should be made merely to display details, and restored metadata must not enter follow-up model history or inflate current-page diagnostic totals. An older snapshot without trace must still open. Missing/invalid traces should not create misleading details. Through the API, inspect invalid IDs/dates, bool or oversized counts, nonfinite/negative/oversized durations, unknown tool names, incorrect usage coverage, invalid model labels, metadata on user messages, and extra fields: malformed known fields must reject generically; unknown fields must not be copied into storage. A caller can fabricate otherwise valid metadata; do not treat this view as verified provenance. Repeated unchanged saves should keep the record, and confirmed deletion must remove the snapshot and its metadata while retaining quiz scores. These checks have not been performed.

## Saved conversation API checks (not yet performed)

Using self-authored text and a private local database, explicitly save 1–20 bounded messages with consent_to_save true, a fresh UUID v4 save_id, selected language, and known source_ids. Inspect list/load after server restart and copied source metadata. Repeat the identical save ID/content concurrently: one retained snapshot should remain; changed content should return 409. Another browser cookie must not load/delete these records. Check malformed consent, role/language types, text/count bounds, duplicate/unknown source IDs, and invalid IDs without leaking raw text through errors. Save 21 snapshots and inspect oldest eviction, then retries after eviction/deletion with their documented limited guarantee. Delete quiz scores and ensure saved text remains; delete saved conversations and ensure scores remain. Exercise access-gate and quota failures plus storage-unavailable recovery. These API checks have not been run.

## Quiz phrase separation (not yet performed)

For Article 14, inspect scores for self-authored answers containing only barabari before law or only कानून के सामने बराबरी, then an equal-protection phrase, and then both concepts. Single equality-before-law wording should not earn equal-protection credit. Use exact English/Hindi/Hinglish feedback labels across the bank and inspect their matching without multiplying credit inside one concept. With a private temporary bank, inspect normalization-equivalent and substring phrases shared across different concepts and wordless phrases: loading should reject them. Separate phrases for two concepts should still score together in a student's answer. Inspect negated/contradictory/quoted cases as known lexical limitations, not semantic guarantees. Check old saved scores are retained and new review files use the current bank hash/configuration. These scoring and bank-loader cases have not been performed.

## Human quiz-scoring review (not yet performed)

Follow [quiz review rubric version 1](QUIZ_REVIEW_RUBRIC.md) for blind, independent review of self-authored answers. Include correct/partial/incorrect examples, semantic paraphrases, negation, contradictions, quoted corrections, and STT substitutions in all three language categories. Record actual automated results and human concept counts with the frozen bank hash in ignored `evals/local-quiz-reviews.json`. Use `node evals/score_quiz_reviews.js evals/local-quiz-reviews.json` when actual collection/report runs are authorized. Inspect paired coverage, distinct-answer failures, MAE, signed error, exact agreement, and false-complete/false-incomplete counts before comparing configurations. Preserve reviewer disagreements; do not infer semantic correctness from keyword matches or invent reviews. Manual inspection should include all-failed groups, extra/invalid fields, wrong bank hashes, duplicate/inconsistent reviews, and missing matched pairs. This collection and report runtime have not been performed.

## Quiz follow-up context (not yet performed)

Start a direct quiz after discussing a different article. Answer and end/complete it, then ask a generic clarification or example in English, Hindi, and Hinglish. Inspect whether retrieval follows the latest quiz article and whether model context includes the actual prompt, answer, and feedback rather than unrelated older tutoring. Include a wrong answer naming another article: its quiz topic hint should not be interpreted as proof the answer is correct. Ask an explicit different-article or substantive supported-topic question and inspect current-question priority. Repeat after scoring timeout/cancellation and unchanged-answer retries; histories can include each displayed submission, but score writes must remain idempotent and saved status must stay uncertain when appropriate. Explicitly Save/Open and inspect single-source topic recovery without quiz resumption or automatic speech. Stop/replay quiz prompt and feedback speech and inspect that only their retained history entries receive interruption notes. New session should clear text/hints. API history checks should reject unknown/non-string article_context, malformed roles/containers, and oversized history; internal hints must be absent from provider message fields. These checks have not been performed.

## Quiz difficulty presets (not yet performed)

Choose each toolbar preset and start a quiz. Basic should select only Articles 14/21 with two questions, Challenge only Articles 19/22 with two, and Standard three from the mixed bank. Inspect the actual preset/count in displayed prompts and unchanged score requirements. Change the selector while a quiz/request is active: it should apply only to the next quiz and not rewrite current questions or rubrics. Inspect keyboard/narrow layout. Through the direct API, omit/null the count for automatic sizing; request one/two allowed questions and reject unavailable counts, invalid difficulty types/names, bool counts, and invalid language containers. Older callers without a preset should default to Standard. Offline recognized quiz commands should use the selector; model commands should receive its default guidance, with a current-question explicit preset allowed through validated arguments. Inspect invalid returned presets/pool membership and stale quiz responses without replacing current quiz state. Save/Open should preserve prompt text without resuming quiz state; scores remain grouped by question ID rather than stored difficulty. These presets are authored groups, not measured learner levels. These cases have not been performed.

## Spoken quiz flow

After saving a weak answer, use Revise Article in the progress list. Inspect the normal user question, article source, selected-language explanation/notes, and speech playback. No score/save request should be sent by this action. Repeat offline and with configured model speech paths when available. Use it during an active quiz, pending scoring, and microphone capture: the quiz should end/capture should close through existing recovery, the composer should clear for revision, and late output must not reopen the quiz. Saved scores remain; interrupted writes may already have completed. Refresh/delete progress and ensure removed revision controls cannot dispatch an old action. Unknown or non-article question IDs should have no inferred revision button (or an unknown article should abstain through retrieval). Inspect keyboard/narrow layout. These revision checks have not been performed.

While awaiting an answer, between questions, and during pending scoring, press End quiz. The conversation and saved scores should remain, playback/request should stop locally, the existing draft should remain editable, and the composer should return to Ask tutor with its 1,200-character limit. Check that late score responses cannot reopen/advance the ended quiz; saved status may be uncertain after interruption. Submit exact end quiz/quiz band karo/क्विज बंद करो commands via typed or reviewed speech input: the command should clear without being scored. Longer answers mentioning those words must still reach scoring. In Conversation mode, the exact command should return to tutoring while keeping capture open; then speak a source-backed follow-up. Button exit should close capture. Completion/New session should hide End quiz; starting another quiz should show it again. Inspect keyboard focus and narrow-screen action wrapping. These exit checks have not been performed.

Use the same browser, device, quiz language, and selected speech voice for each attempt. Start a three-question quiz, listen to each prompt, answer aloud using browser **Speak** or the optional **Record** control, review and edit the transcript, then submit it. Continue through all questions. For at least one answer, use a self-authored response that clearly covers a rubric point; do not use real learner recordings. Repeat the flow three times and record each stage as pass, fail, or unavailable.

Check that each question prompt is audible and readable, the transcript remains editable before submission, feedback and score appear after submission, the next question can be reached, and the saved-progress panel reflects completed scores. If using **Record**, note that a configured provider may incur usage; mark that path unavailable if it is not configured. Reload the page before checking saved progress. This manual exercise checks visible flow only; it does not measure speech accuracy or prove that the rubric evaluates meaning beyond its configured phrases.

| Trial | Language / voice | Prompt audible? | Transcript editable? | Feedback and score shown? | Next question reached? | Saved progress visible after reload? | Failure stage / notes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |

## Turn-taking and interruption checks

Use Listen again on a completed answer after ordinary completion, Stop, speech failure, and changing browser voice/rate or provider voice. The displayed text should replay using the current settings without new tutor/retrieval/score requests. Provider TTS can incur usage. Repeat for quiz prompts/feedback, including an old quiz message after End quiz: it must not start or advance a quiz. Click during pending tutoring/scoring and each capture path; existing cancellation must retain the draft/quiz retry state and suppress late output. Retained tutor history should receive its own incomplete-playback note if replay is interrupted; an evicted answer or quiz prompt must not annotate another answer. New session removes old controls. Inspect keyboard access/narrow layout, long segmented playback, and repeat speech diagnostics; the timing samples include replays and do not establish improved accuracy/latency. These replay checks have not been performed.

Run these checks in a browser with speech playback available. Use the same browser, device, language, and answer for each repetition. Repeat each case at least five times; record each attempt as pass, fail, or not available. Do not use real learner recordings.

1. Start a tutor answer and press **Stop** while it is speaking. Record whether audio stops promptly and whether the status remains stopped.
2. Start another answer and press **Speak** while it is speaking. Record whether old audio stops, the recognized text stays editable, and no old speech resumes after recognition ends.
3. Stop a tutor request while it is still thinking, then send a follow-up about the same topic. Record whether the interrupted question remains in the conversation context and whether any late answer appears after the follow-up.
4. Let a long answer finish, then ask a follow-up question. Record whether the follow-up is answered without old audio restarting.
5. While an answer is still speaking, submit a typed follow-up. Record whether playback stops as the new request starts and does not resume while the tutor is thinking.
6. Start microphone capture, press **Stop**, then start a fresh capture and speak a different question. Record whether any late result from the stopped capture changes the fresh transcript or status. If the browser does not deliver delayed recognition events, mark this case unavailable rather than assuming stale-event handling passed.
7. With experimental streamed speech enabled, start a tutor answer and press **Stop** while its audio is arriving or playing. Start a new answer immediately. Record whether the old audio stops and stays stopped, with no late chunk playing over the new turn. Note the selected streamed voice; each attempt may incur API usage. If no API key or supported audio browser is available, mark this case unavailable.
8. Start **Speak**, then edit the question box before recognition finishes. Record whether listening stops, your edit remains in the box, and a late recognition result leaves it unchanged. If recognition ends before you can edit, mark the attempt unavailable.
9. If the browser provides an interim recognition result after a final transcript, check that the final words remain in the question box. Record the visible event order; mark unavailable if the browser never produces this order.
10. With server transcription configured, start **Record** and type in the question box while recording. Repeat while the microphone permission prompt is open and while transcription is pending. Record whether capture or transcription stops, your edit remains, and no late transcript replaces it. Use a self-authored phrase; if the provider or browser path is unavailable, mark that case unavailable.
11. Start a quiz, press **Stop** while it is preparing, then immediately start a quiz again. Record whether the quiz button stays disabled until the second request finishes, even if the canceled first request settles during it. If both requests finish too quickly to overlap, mark this case unavailable.
12. Trigger a browser recognition error, such as denying microphone permission, before a final transcript. Check that **Speak** becomes available again without waiting for an end event, the status explains the error, and diagnostics count exactly one failed attempt. Mark unavailable if the browser does not expose this event order.
13. With server transcription configured, start **Record** and press **Cancel** while microphone permission is pending. If the browser permission prompt remains open, resolve it and check that capture does not start. Repeat after stopping a short self-authored recording while transcription is pending; press **Cancel** and check that a late transcript does not change the question box. Mark unavailable if either pending stage ends before Cancel can be pressed.
14. Submit a quiz answer, type a revised draft while scoring is pending, then press **Stop**. Check that the revised draft stays in the input box and can be submitted. If the first answer was already saved, the revision should show an already-saved conflict rather than the first answer's score; otherwise it should receive its own score. In the conflict case, check that the status directs the learner to start a new quiz. Repeat with the same answer after Stop to check that a retry can recover the saved score. If scoring finishes before the edit, mark unavailable. If a scoring error occurs during a separate attempt, check that it also keeps a draft already typed into the box.
15. Start **Speak** with existing text in the question box. After interim words appear, press **Stop** on the Speak control and check that the original text returns. Repeat with a final transcript before pressing **Stop** on Speak and check that the final words remain for review. Also check normal end or error after interim words; both should restore the original text without a final transcript. Mark event orders the browser never produces as unavailable.
16. With model mode and browser speech selected, press **Escape** after text starts arriving but before the first complete sentence is spoken. Check that the partial turn stops, no queued sentence plays later, and a follow-up still works. Mark unavailable if generation finishes too quickly to reach this interval.
17. Start **Speak** with existing text and wait for interim words. Try **Ask tutor** before a final transcript; it should wait and send nothing. Then use the separate tutor **Stop** button, **Escape**, or change the speech language during separate attempts; each should restore the original text. Repeat after a final transcript and check that it stays available for review. Mark unavailable if the needed interim or final event does not occur.
18. With the automatic-submit option unchecked, confirm a final browser transcript stays in the box for review. Then enable it and speak a question: only a final transcript should submit once after recognition ends naturally. Press **Stop** after a final transcript during a separate attempt and confirm it remains available without being sent automatically. Check that interim-only results and recognition errors never submit. Mark browser events that do not occur as unavailable.
19. With automatic submission enabled, complete a voice question and copy the page's speech diagnostics after playback starts. Check `automatic_voice_turns` for input/output language, the playback start event, sample count, and recognition-end-to-start p50/p95. Repeat with the same languages and speech path. This interval uses browser recognition and playback events; it is not acoustic latency or a measurement from the end of the learner's speech.

| Case | Attempts | Passes | Failures / unavailable | Browser event or visible symptom |
| --- | ---: | ---: | ---: | --- |
| Stop during playback | | | | |
| Start microphone during playback | | | | |
| Stop while thinking, then follow up | | | | |
| Follow up after completed answer | | | | |
| Submit typed follow-up during playback | | | | |
| Submit typed quiz answer during prompt or feedback playback | | | | |
| Stop and restart microphone capture | | | | |
| Edit the question during microphone capture | | | | |
| Final transcript followed by interim recognition | | | | |
| Recognition error before an end event | | | | |
| Interim words stopped before a final transcript | | | | |
| Stop after a final transcript | | | | |
| Interim words without a final transcript | | | | |
| Submit interim words or cancel with tutor Stop, Escape, or language change | | | | |
| Automatic submission of final browser transcript; Stop retains review | | | | |
| Automatic voice-turn recognition-end-to-playback-start diagnostics | | | | |
| Edit the question during recording or transcription | | | | |
| Interrupt streamed speech, then start a new turn | | | | |
| Stop and restart quiz preparation | | | | |
| Edit quiz answer while scoring, then stop | | | | |
| Escape before progressive speech starts | | | | |

For each attempt, add one row below before summarizing the totals above. Keep the browser, device, language, and answer fixed across repetitions; if any setting changes, start a separate run sheet. Use the visible browser status or event as the observation, and mark unsupported browser behavior as unavailable rather than pass or fail.

| Case | Trial | Outcome (pass / fail / unavailable) | Browser event or visible symptom |
| --- | ---: | --- | --- |
| | 1 | | |
| | 2 | | |
| | 3 | | |
| | 4 | | |
| | 5 | | |

When submitting a typed quiz answer during prompt or feedback playback, check whether the old audio stops as scoring begins and stays stopped while the score is pending.

This is a manual interaction check, not provider cancellation proof. The local client can abort its request and ignore stale client events, but the model provider may continue generating after the browser stops waiting.

## Experimental live microphone checks

With a configured key and a WebRTC-capable browser, try a short Hindi, English, and Hinglish question with **Live mic**. Observe partial text, tap **Done**, review the final transcript, and send it. Repeat with a spoken quiz answer. Record failures and actual transcripts in your ignored local evaluation input; download current diagnostics to keep live STT timings and outcomes alongside your private transcript labels.

- Try submitting while listening or finalizing: submission should wait for a final transcript.
- Cancel with Escape, Stop, Cancel, a language change, or New session: the microphone indicator should turn off and late events must not replace the restored draft.
- Edit a partial transcript: capture should stop and the edit should remain.
- Cancel while the permission prompt is open, then grant permission: capture must not resume.
- Leave a capture running: it should finish at 20 seconds. Block the connection or final event: the connection/finalization deadline should restore the controls.
- Start live input during tutor playback: old audio should stop. Standard Live mic requires a click; use the opt-in conversation checks below for detected speech interruptions.
- Verify the last words survive Done across network conditions; the media drain delay needs real-device validation.
- Enable optional quiet-pause completion before capture. Speak, pause for one second, then continue: capture should continue. After finishing, stay quiet for at least three seconds: finalization should begin and the completed transcript should remain for review.
- Repeat with quiet speech and background noise. Record premature endings or failure to finish; thresholds are heuristics and have not been tuned against real recordings.
- Keep silent from the start: pause detection should not finish before activity is detected; the 20-second limit still applies. If audio analysis is unavailable or suspended, check the manual-Done message and finish manually.
- Cancel automatic capture and start another: old polling must not finish the new turn. Changing the pause option is disabled during capture.
- Export diagnostics after a success, deliberate cancellation, permission failure, and stalled final transcript. Each terminal attempt should appear once in `live_stt_attempts`; cancellations should remain separate from failures. Confirm missing first-partial events remain null and summary timings include a sample count.
- Note whether completion used Done, quiet-pause detection, or the capture limit. Compare equivalent recordings/configurations; connection time includes microphone permission, and commit-to-final is a software interval rather than learner speech-end latency.

### Continuous conversation checks

Enable Conversation mode before Live mic, with headphones. Ask a question and pause for three seconds: the final transcript should submit automatically, and the same microphone connection should listen again once the provider buffer-clear acknowledgment arrives. Speak a follow-up while the tutor answers: old playing/queued audio should stop, the old response should not resume, and the new question should retain interrupted context. Repeat in Hindi, English, and Hinglish; record late-event, lost-word, and echo failures.

- Repeat two or more turns; diagnostics should show increasing `turn_number` and `connection_reused` after the initial turn, with one outcome per attempted turn.
- Confirm ordinary pauses under three seconds do not submit. Use Done to end a turn manually. Speech during finalization/buffer clearing is muted and can be lost; observe when the UI returns to listening.
- Try Stop, Escape, editing, language change, tab hiding, and page exit during listening/finalization/clearing. Mic tracks should end; late events must not restart capture or submit a new question.
- With analysis blocked/suspended, conversation mode should close and suggest restarting in manual mode. With no detected activity, it should end after sixty seconds; the overall session should end at five minutes. Foreground browser timer timing is approximate.
- In a quiz, confirm an awaited answer submits automatically; After feedback, say next question, agla sawal, or अगला सवाल: it should speak the next prompt without closing capture. Say the same command before answering: it should request the current answer without scoring or advancing. An overlong transcript or speech between quiz questions should end conversation capture while leaving the text for review.
- Compare speaker playback separately; do not count headphone-only results as echo validation. Provider generation cancellation and real-device behavior remain unverified until these checks are performed.

### Progressive provider speech checks (not yet performed)

With an approved model/provider session and streamed speech selected, ask for a multi-sentence explanation in Hindi, English, and Hinglish. Confirm the first complete sentence starts before the model finishes when timing permits, later segments play once in order, and the final unpunctuated fragment is spoken. Observe request count, pauses between segments, and pronunciation; no latency improvement is claimed.

- Stop or press Escape before first audio, during a segment, between segments, and after text completion while speech is queued. No pending or late audio should restart. Repeat with a follow-up, language/voice change, and continuous-mic interruption.
- Stall or fail a segment, including quota rejection: queued speech should clear, the error should stay visible while the model text finishes, and the text should remain readable without an automatic whole-answer replay.
- Check offline answers, previews, quiz and revision tool turns still use the complete-answer speech path.
- Export diagnostics: progressive requests should appear as tutor-segment, separate from whole-answer tutor timings. Segment start timings exclude model generation and queue wait. Automatic browser-voice turn timing should still use the first segment start event, once per turn. Record audible latency separately.

### Streamed playback recovery checks (not yet performed)

For browser speech separately, suppress the first or next chunk's start event and inspect a 30-second browser-start-timeout; suppress the end of a started chunk and inspect a 120-second browser-playback-timeout. Try completed and progressively generated answers, voice preview, and provider-to-browser fallback. Expect one failure, cleared queued speech, readable answer, and bounded incomplete-playback history (preview has no answer history). Normal chunks should clear/rearm deadlines, while progressive generation with an empty speech queue should have no playback timer. Stop/new turns must clear old timers; duplicate start/end events and late events after timeout must not add success samples or restart speech. Force speak() to throw and inspect recovery. Record suspended-tab delays and slow legitimate voice behavior separately; these are local event bounds, not acoustic measurements.

- Block audio-context startup, then use Stop/Escape or let the 90-second data-idle deadline expire: the local speech request should release, with intentional cancellation excluded from failure counts. Resume the context later; canceled speech must not restart.
- Suspend the audio context after download completes, or prevent the final playback-ended event. Wait the remaining scheduled duration plus ten seconds: playback should stop with playback-timeout in diagnostics, and a progressive sentence queue should clear without replay. Browser timer delays must be recorded separately.
- Play a long, normally functioning buffer: it should get its full scheduled duration plus the ten-second margin. Complete playback and start another turn; the old watchdog must not abort the new turn. These are manual cases, not verified results.

### Adjustable quiet-pause checks (not yet performed)

Repeat the same self-authored utterance with 3-, 5-, and 8-second settings, first in standard automatic completion and then Conversation mode. Pause for less than the selected duration and continue: the transcript should stay open. Pause beyond the selected duration after detected activity: completion should begin, subject to the unchanged 20-second limit. Record premature completion, missed quiet speech, noise, and timer-delay cases.

- The pause selector should be unavailable during connecting/listening/finalizing/clearing, then re-enable at session end. Reused conversation turns should retain the connection?s selected duration.
- Manual Done and Stop should work at each setting. Standard mode should retain the final transcript for review; Conversation mode should auto-submit once.
- Export schema 10 diagnostics: each attempt should carry quiet_pause_ms, and summaries should separate settings with the correct configuration.quiet_pause_s. Do not combine their timing distributions or claim a setting is better without comparable measured samples.

### Save and combine live diagnostics

Save each page export as an ignored local-live JSON file and note its corresponding device, browser, prompts, voice and microphone environment in this run sheet. Keep overlapping exports identifiable. Run `node evals/summarize_live_stt.js` with the export paths to recompute completed-attempt distributions, configuration groups, and separate failure/cancellation counts. Check input/unique/deduplicated counts against your session records before using a report. Schema 8 quiet-pause settings remain unknown. Schema 10 IDs enable deduplication; legacy/null-ID metadata deduplication cannot establish globally unique attempts, and exports retain at most 500 attempts per page. Imported session/report behavior is not yet verified; do not treat this command as evidence of accuracy or an acoustic latency benchmark.

### Attempt-ID checks (not yet performed)

Export the same completed live attempt twice: its attempt_id should stay the same, and the report should count one unique attempt with one duplicate by ID. Complete another conversation turn on the reused connection: it should get a different ID. Repeat with an early connection failure and deliberate cancellation; each terminal attempt should retain its allocated ID. With UUID generation unavailable, the exported ID should be null and the report should state its metadata fallback counts.

For report review, check that conflicting selected metadata under one ID is rejected with an input/attempt index, while separate IDs with otherwise matching metadata stay separate. Avoid mixing legacy and current snapshots of the same session. These checks remain manual and unverified.

### Tutor stream deadline checks (not yet performed)

Supply controlled progress responses with null/array containers, missing/string/negative counts, out-of-range scores, duplicate question IDs, mismatched attempt totals, malformed dates, and over-1,000-entry lists. Invalid empty history must not display "No saved quiz answers." Weak-topic entries must exactly match their question records and the latest_complete/latest_score-below-70 rule: check missing, extra, duplicate, and changed entries. Expect an invalid-data message with no partial revision list, then a successful refresh from a compatible response. Confirm zero answers uses a null average and empty arrays; valid repeated attempts and the 70-point boundary should render. These checks cannot establish rubric meaning or database accuracy.

For saved progress, stall read headers/body beyond 20 seconds: expect a refreshable timeout message. Start a newer refresh while an old read is pending; the old request/timer must not replace or abort the newer one. Confirm deletion while reading, then stall its headers: both progress controls should recover at 20 seconds and a fresh read should check state, with an explicit message that scores may already be deleted. Do not automatically retry DELETE. Refreshes triggered by quiz completion while deletion is pending should wait for the subsequent state read. Inspect successful deletion, rejected deletion, post-write timeout, and delayed old responses separately; the client cannot roll back server writes or guarantee the ordering of concurrent score writes.

- Stall a tutor request before response headers, then after one text segment: after 90 seconds without data, verify a timeout message, restored send control, removed incomplete answer, and no pending speech restart. The question should remain in history as a failed turn.
- Keep response chunks arriving less than 90 seconds apart but hold the turn open for five minutes: verify the total deadline ends it. Completed tool effects may remain; inspect actual progress before retrying.
- Stop/Escape or start a follow-up before expiry: the old turn should count as canceled and old timers must not affect the new request. Complete a normal answer then leave playback running: tutor timers should not stop it.
- Export diagnostics: timeouts should increase failure counts, not cancellation or success counts. Record browser timer delays and missing trace metadata separately. Provider generation cancellation remains unverified.

### Follow-up context after stopping completed speech (not yet performed)

Let a tutor finish generating text while its browser/provider voice continues. Stop or interrupt the playback, then ask for an example or explanation of the last topic: the next history payload should keep that answer with one playback-stopped note and the original user question. Repeat before first audio with queued speech, after natural completion, and with a voice preview; only stopped pending tutor speech should annotate its associated answer. A pending model answer still uses its separate interruption note.

Repeat with a long Unicode answer: history must stay within 3,000 code points per assistant message while the displayed answer remains complete. Start New session and confirm earlier annotations do not enter new follow-ups. Do not infer exact heard words or provider cancellation from the note.

### Tutor stream validation checks (not yet performed)

Supply valid completed/error events with missing, null, array, and malformed trace metadata. Include non-array/null tool entries, invalid identities/timestamps, negative/string durations, unsafe counts, oversized names, and incomplete token-usage coverage. Valid answer text should remain usable; error events should restore controls normally. Inspect one client outcome/timing entry with server fields unavailable and server_metadata_status invalid (or unavailable for missing/null metadata), plus the panel's invalid-diagnostics notice. Compatible offline/model/error traces should retain server fields and mark valid. Metadata format acceptance does not prove authenticity or measured quality.

Stall direct quiz start and scoring past 30 seconds in an active tab, including delayed headers and stalled JSON bodies. Check restored controls, preserved replacement-quiz state, and pending answer/retry key. Deliver late responses and start a newer request: neither an old timer nor old response should change the new state. Stop before the deadline should remain intentional cancellation. For a scoring write whose response was lost, retry the unchanged answer and inspect saved progress for one result; revised-answer conflicts should keep their existing message. Do not infer server rollback from local timeout.

Exercise direct Quiz/Submit answer with controlled malformed payloads as well as tutor tool events. Invalid replacement quizzes should preserve the older quiz and composer draft. Invalid score metadata, missing/nonboolean complete flags, or a mismatched question_id should not advance the question or append a score; the answer/retry key should remain available. Retry the same answer after a response rejection and inspect saved progress for duplicate prevention. Null error bodies should produce a readable generic error. Confirm valid direct and tool-driven scores still render and complete the quiz.

Deliver completed responses with null tool entries, nonboolean outcomes, missing result/error metadata, over-six event lists, malformed quiz IDs/prompts/sources, duplicate question IDs, empty/over-three question lists, and invalid score values. The client should reject completion, record a failed turn, restore controls, and avoid creating quiz state. Confirm valid quiz/score responses and failed-tool narration still work. Existing server writes may already have happened; inspect saved progress separately and do not retry automatically or infer rollback from a client rejection.

Fail standalone browser speech, provider playback after first audio, and a queued segment after model completion. Inspect the associated retained assistant history entry for one incomplete-playback note, with displayed answer/sources unchanged. Fail progressive speech before text completion, then finish the answer: the newly remembered answer should receive the note. Early provider failure followed by successful browser fallback should not add it; failed fallback should. Check natural completion, previews, stale callbacks, history eviction, and repeated stops for incorrect/duplicate notes. A history note is not evidence of exact audible coverage.

Feed progressive browser/provider speech a controlled answer with no sentence punctuation, crossing 500/1,000 code points over several deltas before completion. Inspect whether bounded prefixes queue early and the suffix flushes once at finish. Include whitespace, long single words, Hindi combining marks, and supplementary Unicode characters; code-point splitting preserves surrogate pairs but may split grapheme clusters. Check no words duplicate/disappear, Stop clears queued prefixes, and late deltas do not restart speech. Measure first audible sound separately before making latency claims.

With streamed speech selected, use a completed answer longer than 4,096 UTF-16 units (including an offline broad-topic answer). Inspect serial requests of at most 1,000 code points and consistent captured language/voice. Stop/Escape between segments and during PCM playback should clear later speech. Fail a segment after some audio: remaining segments should clear and no full-answer browser replay should occur. If audio context creation is unavailable before queuing, inspect browser fallback. Check history interruption notes, segment timing labels, and the supplied completion status. Record audible gaps/provider usage separately; smaller requests do not prove improved latency or quality.

Use controlled retrieved_sources and completed-payload source lists containing null entries, missing title/section, empty text, oversized fields, relative/HTTP/non-web URLs, embedded credentials, and more than 100 records. These streamed lists should fail the turn instead of rendering invalid links. Valid HTTPS references should remain clickable. Exercise non-streamed quiz/message source paths separately: valid references should render and invalid ones should produce the unavailable-reference notice. Source format acceptance does not prove citation support; review actual answer claims against the cited section separately.

Use controlled local NDJSON streams split across network chunks, including split Unicode characters and a final line without a newline. Valid delta/speech_mode/retrieved_sources/complete events should finish normally. Inspect failure recovery for invalid JSON, null/array events, unknown types, invalid required fields, empty final answers, duplicate completion, trailing delta, and EOF without completion. Exercise the 2 MiB byte and 262,144-unit line boundaries. On rejection, progressive audio should stop, the partial answer should be removed, controls restored, and a failed trace recorded. Check Stop/timeout while reading and ensure late events do not revive playback. No provider calls are needed for these controlled cases.

### Recorded transcript review checks (not yet performed)

Return a successful transcription response containing null/array metadata, missing/nonstring transcript, whitespace-only words, and invalid JSON. Expect invalid-transcript or empty-transcript failures without changing the previous draft or adding successful STT timing samples. Bypass the server guard with controlled responses above 6,000 code points: expect transcript-too-long before composer replacement. Repeat at exactly 6,000 code points with supplementary characters (up to 12,000 UTF-16 units), then one beyond it. Accepted long text remains editable with the composer shortening warning and no automatic submission. Null or overlong HTTP errors should show a generic message; malformed JSON must not echo a raw parser excerpt. Cancel/edit/hide and begin a newer request before old responses arrive to inspect stale-result isolation.

Use controlled recorded-transcription responses below/at/above the active composer limit, then at/above 6,000 Unicode code points. Returned bounded text should remain editable without truncation or automatic submission; oversized composer text should show a shortening warning and fail submission until edited. Repeat in quiz mode with its 1,000-character limit. Above the hard server cap, expect a 422 error and the prior draft to remain available. Include supplementary Unicode characters to document browser UTF-16 versus server code-point length differences. Check edited/canceled attempts still ignore late responses.

### Recorded clip size checks (not yet performed)

During capture, use tutor Stop/Escape, edit the composer, submit a typed follow-up, and hide the page in separate attempts. These controls invalidate transcript delivery before requesting recorder cleanup. Verify the owned recorder still receives stop, its ordinary stop event releases the control, and a missing stop event releases it at the 10-second deadline without upload or an extra failure. Start a fresh capture after cleanup and deliver old callbacks; the new capture must remain intact. Check immediate stop exceptions on these canceled paths too.

With local recorder instrumentation, suppress the stop event after normal Stop or the 20-second limit. After 10 seconds in an active tab, expect one recording-stop-timeout failure, discarded chunks, no upload, track stop commands, and an enabled Record control. Repeat after cancellation, microphone loss, and size overflow: cleanup should release the control without a second failure. Deliver the old stop/error/data callbacks after beginning a new capture; they must not clear its chunks, stop its tracks, change its status, or upload the old clip. Force recorder.stop() to throw and inspect immediate recovery. Normal stop before the deadline should upload once, and no later timer should affect transcription. Observe hardware release and suspended-tab timer delays separately.

Inspect retained chunk bytes with local instrumentation at the exact 5 MiB boundary and above it. At the boundary, normal Stop should keep the upload path; above it, expect one recording-too-large failure, cleared retained chunks, track stop commands, and no upload. Deliver delayed/final chunks after discard and inspect whether they are ignored. Verify ordinary WebM/MP4 capture still creates a usable full clip across one-second chunks. Measure browser encoder memory separately; this cap covers retained chunks, not all browser buffers. Check explicit restart and normal 20-second capture afterward.

### Recorded microphone loss checks (not yet performed)

While Record is capturing, unplug the microphone or revoke its permission. Check that the partial clip is discarded, no transcription upload starts, tracks close, and exactly one capture-ended failure is recorded. Repeat near the 20-second limit and just after pressing recording Stop to inspect track/recorder event ordering. Ordinary Stop and the limit with live tracks should still produce an editable transcript. Cancel/hide the page and check no extra device-loss failure is counted. Reconnect and explicitly start another recording; temporary mute should not be treated as permanent loss.

### Hidden-page speech input checks (not yet performed)

For browser recognition, Live mic, and Record separately, switch tabs/minimize while connecting, listening, and finalizing. No canceled final transcript should submit automatically or overwrite a later draft. Unconfirmed browser/live words should restore the original draft; confirmed browser words should remain for review. For Record, also hide while microphone permission is pending and while the upload is transcribing: newly granted tracks should close, the clip should be discarded, and late results should be ignored. Check the browser's microphone indicator and restart each input explicitly after returning. Navigate away/back to exercise pagehide and cached-page restoration. Repeat during delayed tutor generation, direct quiz work, browser synthesis, queued progressive audio, and provider speech. Navigation should abort local requests, cancel queued speech, mark interrupted context/playback through normal Stop handling, and invalidate late callbacks. Returning from the back/forward cache should show an actionable stopped status and require explicit restart; no old answer should restart playback or overwrite a newer draft. Compare tab hiding alone: microphone input should stop while answer generation/playback is not canceled by this navigation-only rule. These output lifecycle scenarios have not been performed. Record device/lifecycle failures; a local stop command does not prove immediate hardware release or upstream cancellation.

### Tutor-turn report checks (not yet performed)

Download schema 12 diagnostics after completed, failed, and canceled tutor requests. Save ignored local-tutor exports and run summarize_tutor_turns.js on one file, then overlapping snapshots. Check separate outcome durations/sample counts, missing server-time exclusion, language/model/status groups, source metadata counts, and actual reported tools. Repeat identical request IDs: one selected record should remain; conflicting selected metadata should reject with an input/turn index without printing IDs or paths. Null-ID exact selected metadata is deduplicated with its documented collision limitation. Empty exports should produce no groups. Inspect rejection of invalid counts/durations, UTC dates, unknown tool names, overlarge files/lists, and inconsistent invalid/unavailable server fields. Compare report counts to raw private exports manually; do not claim prompt pairing, answer quality, acoustic latency, or billing from this report. No real-session or aggregation checks have been performed.

### Speech-stop diagnostics checks (not yet performed)

Run `node evals/summarize_speech_stops.js evals/local-live-session.json` on your saved schema 11/12 export. Inspect separate reason/state groups, sample counts, command-dispatch percentiles, and exception totals. Repeated overlapping exports should remove identical selected metadata; document possible collisions because stops lack event IDs. Try empty stop arrays and malformed metadata separately. Keep acoustic observations and stale-playback outcomes in the run sheet, outside this command-dispatch report.

During browser speech and streamed PCM playback, try Stop, Escape, a typed follow-up, and continuous-mic detected speech. Export schema 11 diagnostics and match each active/pending stop to its speech_stops reason and pre-stop state. Repeat while idle: no new stop sample should appear. Check queued segments and provider-request startup separately from playing audio. More than 500 samples should retain only the newest records.

Observe whether sound actually stops and whether late playback resumes; record these outcomes separately. stop_dispatch_ms measures local command execution and excludes detection, audio hardware/buffering, and provider cleanup. source_stop_exceptions may include already-ended sources. Neither a small dispatch duration nor zero exceptions proves a successful acoustic interruption.

### Bounded PCM scheduling checks (not yet performed)

Use a long approved provider speech answer and observe that the player schedules no more than about five and a half seconds ahead while reading pauses/resumes. Listen for new gaps or ordering errors; record browser/network buffering separately from Web Audio scheduling. Stop, Escape, or interrupt while the reader is waiting for capacity: pending waits and sources must end without restarting audio.

Suspend the audio context while capacity is exhausted: no clock progress should eventually trigger the 90-second liveness deadline. Normally progressing long playback should refresh that deadline while waiting; after download completes, the remaining-duration playback watchdog should still apply. Record actual resource measurements before claiming a memory improvement.

### TTS listener comparison

Follow [rubric version 1](TTS_RUBRIC.md) for matched prompts and anonymous fluent listeners. Document configuration settings, playback environment, order, and sample size. Score actual private observations with `node evals/score_tts.js evals/local-tts-ratings.json`. Inspect failures and both all-attempt/completed prompt-listener coverage flags before comparing distributions. Do not convert unavailable playback into a low pronunciation score, invent observations, or claim significance from descriptive medians. Scorer runtime and listener collection remain unverified.

### Retrieved sources during streamed speech (not yet performed)

Ask a supported Article 14 question in a configured model session with progressive browser/provider speech. Retrieved note links should appear before answer text completes and remain visible during early speech. At completion, the partial message should be replaced with one final answer/source list. Repeat offline and with quiz/revision tools; the early label describes retrieval, not answer-support validation.

Ask an unsupported question: no early evidence links should be invented. Stop, fail, or supersede a turn after source arrival: its partial sources must not appear under the next answer or resume from a late event. Check the actual final answer against the retrieved note separately before claiming citation support.

### Live microphone loss checks (not yet performed)

Unplug or revoke the active microphone during setup, listening, finalization, and a reused conversation turn. Verify closure, reconnect/type guidance, previous draft restoration, no late submission, and one capture-ended outcome for the current attempt. Deliberately start a new session after reconnecting; old ended events must not affect it.

Compare normal Done, Stop, Escape, and the capture limit: local track cleanup should not become capture-ended or add another terminal outcome. Temporary mute is a separate condition. Record actual browser/device behavior and unavailable cases before claiming verified recovery.

### Live segment length checks (not yet performed)

Repeat a short prompt at 20 and 60 seconds, then use a longer self-authored quiz answer. Confirm standard capture limits start on listening, while continuous limits start after detected activity. Done and selected quiet-pause completion should work earlier; Stop/Escape must cancel either length. The selector should remain disabled throughout one connection and re-enable after closure. Recorded-file capture must still stop at its own 20-second limit.

Export schema 12: attempts should carry capture_limit_ms, summary capture_limit_s should match, and different limits should stay separate. Keep old unknown-limit exports separate. Verify the five-minute session/sixty-second idle limits, long-transcript review safeguards, and final-word retention. Record actual failures; a longer capture option is not evidence of better STT or quiz scoring.

### Multilingual retrieval indexing checks (not yet performed)

Ask "compare Article 14 and Article 21", then a generic clarification without article numbers. Inspect whether both sources appear in mention order in the original turn and follow-up. Reverse order, repeat a reference with Unicode digits, and include a Latin suffix. Duplicate IDs should appear once. Add an unknown article or unrelated substantive topic: expect no forced partial evidence. Check explicit caller limits only after all references validate. Also check Articles 14, 19 and 21, Article 14 vs 21, anuchhed 14 aur 21, and अनुच्छेद १४ और २१, including comma-and lists, suffix IDs, unknown trailing IDs, reversed order, and generic follow-ups. Lists require an initial recognized prefix and immediate supported connectors. Check Articles 14 to 18, 14–18, and अनुच्छेद १४ से १८ तक, then mixed lists/ranges and generic follow-ups. All integer notes should appear inclusively, in order, without duplicates. Descending, over-64-article, suffix-bound, or missing-note ranges should abstain before caller limits. Integer ranges must not silently add inserted suffix IDs such as 21A. Offline notes together do not prove a generated comparison is correct.

Compare ASCII and Devanagari article numbers for bare references, generic clarifications, and substantive supported questions, including a Latin-suffix reference such as २१A. Repeat with a prior Devanagari reference followed by a generic example request. Try an unrelated subject after a suffix reference: the number/suffix itself must not satisfy topic support. Unknown article IDs should return no checked source. Compare Article twenty one, Article twenty-one, Article fifty one A, mixed word/digit lists, and Articles fourteen through eighteen with the numeric equivalents, then generic follow-ups. Include unknown word-number IDs and unrelated substantive subjects; reference words must not become support evidence. A spaced single letter after a word-number is treated as a suffix, so inspect ambiguous transcripts before submission. Hindi number words, ordinals, larger word-numbers, and Hindi letter suffixes remain unrecognized; record them separately.

Choose substantive terms present in checked Hindi/Hinglish titles or summaries but absent from their keyword lists, then inspect retrieved sources for those questions and explicit article references. Compare English/Hindi/Hinglish formulations, unrelated prompts containing common translated words, and article-topic mismatches. Repeated terms across translations should not multiply body-token scores. When evaluation runs are authorized, rerun both scorers on the same dataset/corpus and report gains/regressions by language; do not reuse historical English-body results as current metrics.

### Speech input and retrieval context checks (not yet performed)

For Record, leave microphone permission unresolved for more than 45 seconds in an active tab. Expect the control to return to idle and one capture-timeout failure while the original draft stays intact. Grant the old request afterward: its tracks should stop and no capture/upload should start. Repeat after Cancel/hide and while a newer attempt is pending; the old deadline or permission grant must not cancel the newer one. Permission rejection/normal capture before the deadline should not produce a later timeout failure. Observe browser prompt and microphone indicators separately from local UI state.

Establish a live current item with a delta, finish the turn, then deliver a committed acknowledgment for another ID: the current identity should remain intact and its matching final transcript should still complete. Repeat with missing, empty, nonstring, and over-128-unit IDs, plus duplicate matching acknowledgments. Commit before the first delta should establish one bounded ID; later mismatches must not replace it. A connection-wide error should close even if its item_id names an already completed item. Record provider compatibility and the no-known-identity ambiguity separately.

For controlled reused live turns, establish a current item with a delta and deliver a failed event for a different item: the active turn should remain open. Repeat with a completed prior item and a committed current ID. A failed event matching the current item should close once and report provider-failed; a connection-wide error should still close capture. Unknown transcription event types must not bind item identity before a valid delta arrives. Inspect the first-event case where identity is not yet known separately, and record remaining stale-order ambiguities.

For controlled live transcript events, deliver a final transcript without preceding deltas at exactly 6,000 UTF-16 units and above it. The boundary text can enter review (subject to composer limits); oversized text must fail with transcript-too-long, restore the original draft, and never report completion or auto-submit in Conversation mode. Repeat with accumulated delta overflow, including an oversized first delta: rejected text should not enter the partial callback or first-partial timing. Check tracks/peer/timers close and explicitly start another session. These cases do not measure transcription accuracy.

Use controlled browser recognition results at and above 6,000 joined UTF-16 units, including multiple segments and separating spaces. Overflow should abort once with transcript-too-long and keep earlier confirmed words or the original draft; final words from the rejected event should not count a new timing sample. Bounded final text over the composer limit should remain editable, warn to shorten, and never auto-submit even with the option enabled. Repeat in quiz mode and with supplementary Unicode characters. Deliver late events after overflow and start a new capture to check draft isolation and recovery.

With controlled browser recognition, delay onstart beyond 45 seconds, then keep a separate started session open beyond 60 seconds. Check control recovery and one start-timeout/listening-timeout failure. Repeat with interim-only text and confirmed final text: restore the old draft in the first case and retain final words in the second. Enable automatic submission and deliver late result/end events; timed-out attempts must not submit or replace newer drafts. Stop, edit, hide, and normal end before the deadline should clear timers; start a new attempt and check old deadlines cannot abort it. Keep the tab active for timing checks and document timer delays separately.

Repeat the topic-switch and clarification cases in the offline terminal tutor (`python bolprep.py`) as well as the browser. Inspect printed source sections after Article 14, then Article 21, then an example request, and after a new personal-liberty question. Unsupported current articles should not inherit old sources. Compare source IDs, not natural wording; terminal offline summaries use the default English language setting. No model calls are needed for offline cases.

Ask about Article 14, then send language-only requests such as "Hindi mein samjhao", "in English please", and "Hinglish mein bolo". Repeat with Devanagari language names. Inspect whether Article 14 sources remain available, then send a generic example request to check language-only turns were skipped as topic anchors. Separately check answer text language and speech settings; retained evidence alone does not prove either one changed. Also try a substantive question about minority language/culture protections and inspect whether it selects its own evidence.

After asking about Article 14, ask "personal liberty kya hai?" without an article number. Inspect whether Article 21 evidence is selected from the current question instead of inheriting Article 14. Then ask for an example and check the new topic remains the anchor. Repeat with Hindi and English wording, and record weak lexical matches or false topic switches.

Ask about Article 14, then Article 21, then ask for an example without naming an article. Retrieval should anchor Article 21. Repeat with another generic clarification, Hindi/Roman Hinglish wording, and an explicit current Article 19 request; the current explicit article must win. Switch to a newer substantive topic without an article, and inspect whether its note is supported or clarification is needed.

Try an unsupported recent article and an unrelated substantive question: do not use an older note merely to force evidence. Check full model history separately from the retrieval query, and record false context carryover/abstention cases before claiming multi-turn accuracy.


### Provider-reported tutor model identity (not yet verified)

For an authorized configured tutor turn, compare the requested model with the model ID on each completed provider response, including tool rounds. Inspect page diagnostics, exported tutor metadata, and saved/reopened Request details: response order and unavailable IDs should be retained. Offline turns should report an empty list; older traces without the optional field should remain usable and show unavailable identity. Failed turns must not claim identities that were not retained. Inspect malformed IDs, more than four entries, response-count mismatches, and nonempty offline lists; validators should reject them. Unchanged retries of older saved traces should not gain new fields during server normalization. When authorized, compare report groups with different returned IDs and missing identity, without combining these as one configuration. Returned IDs can be aliases, not immutable versions, and do not describe STT/TTS. No provider, browser, storage, or report runtime checks have been performed for this addition.


### Immediate recorded-input discard (not yet verified)

Cancel a recording through Stop, another study control, and page navigation while the recorder delays its stop event. The discard flag should be set before microphone tracks are stopped, buffers should never upload, and owned recorder cleanup should still complete or time out. Inspect the browser microphone indicator immediately after cancellation; issuing track.stop() does not prove immediate hardware release. Repeat with a stop exception, late data/stop events, and device disconnection. Cancellation should not count as an unexpected capture failure or overwrite a newer draft. For a normal non-discarding Stop/20-second limit, final recorder data must still be collected before tracks close and transcription starts. These device and lifecycle checks have not been performed.


### Bounded recorded-transcription response (not yet verified)

With authorized local browser checks, inspect responses split across UTF-8 character boundaries, invalid/truncated UTF-8, malformed JSON, missing bodies, and bodies just below/above 128 KiB. The client must count received bytes even without a Content-Length header, stop reading oversized data, release its reader, and show generic invalid-response recovery without echoing response text. Repeat with canceled/timed-out fetches, a late response after another turn, and a cancellation promise that does not resolve: recovery must not wait on that promise or replace the newer draft. Valid transcripts still use the existing 6,000-code-point review limit and remain drafts until explicit submission. No browser or response-stream checks have been performed.


### Invalid live event recovery (not yet verified)

During connecting/listening/finalizing/clearing, deliver malformed JSON, null, arrays, scalar values, non-text data, missing/non-string/empty/overlong type fields, and serialized messages above 65,536 UTF-16 units. Each should fail through provider-failed cleanup rather than throw out of the event callback or retain capture: inspect tracks, peer/channel, timers, draft restoration, and one failure sample. Late events should be ignored after closure. Valid object events with unknown types should remain ignored for provider housekeeping compatibility; valid transcript events retain existing review limits. Explicit restart should create fresh state and not automatically reconnect. These are proposed manual scenarios; no event, browser, or provider checks have been performed.


### Bounded quiz and progress JSON (not yet verified)

Inspect quiz start, score, and progress-load responses with malformed JSON containing self-authored private text, invalid/truncated UTF-8, absent bodies, and bodies at/above 1 MiB without Content-Length. The reader should count bytes before parsing, cancel/release streams, and show generic failure text without echoing parser fragments. Existing structural result checks must still reject inconsistent quiz/score/progress objects. Repeat cancel/timeout and late delivery after a new turn/refresh. On scoring failure the same unchanged answer should retain its idempotency key; a timed-out/invalid response may follow a completed write, so check saved results before interpreting it as unsaved. Quiz and progress controls must recover through their existing finally paths. Valid responses and recorded-transcription 128 KiB/6,000-code-point limits should still work. No response injection, storage, browser, or runtime checks have been performed.


### Quiz result arithmetic consistency (not yet verified)

Inspect direct score responses and score_answer tool events with matched/missing concept arrays. Reject empty total rubrics, duplicate/overlapping labels, non-text/overlong labels, oversized lists, partially supplied minimum/total metadata, invalid count types/ranges, mismatched totals, and percentage/completion values inconsistent with the matched count and minimum. New results should carry minimum_concepts and total_concepts; half-point percentages should follow Python round-to-even before capping at 100. Older persisted results with both metadata fields absent must remain accepted when their existing score, feedback, source, and concept-list structure is valid; their arithmetic cannot be proven from missing metadata. Retry unchanged stored scores without rewriting them or advancing a quiz on invalid responses. These checks validate response consistency, not semantic answer quality, and have not been performed.


### One successful quiz start per tutor turn (not yet verified)

When tool-loop verification is authorized, inspect two start_quiz calls in the same response and repeated calls in later rounds. After the first successful start, later starts should return an explicit failed tool result and create no extra quiz rows. The browser should receive one successful quiz and display its returned questions/ID. Failed argument-validation starts should still allow a corrected start; weak-topic/scoring tools and the total call/round bounds should retain existing behavior. A new tutor turn should be able to start a new quiz. Cancellation or a final model failure after creation may still leave an unused quiz; this guard is not transaction rollback or cross-turn idempotency. No model, tool-loop, browser, or storage checks have been performed for this addition.


### Historical score retry identity (not yet verified)

In an authorized isolated legacy-database review, migrate a retained attempt whose idempotency key is null. A new score submission must receive a conflict directing a new quiz, retain the original result/count, and remain visible in progress. Inspect both the direct score endpoint and model score tool: the tool should report failure, rather than present historical feedback as the new answer's result. Existing matching-key attempts should still return the retained result without duplicate writes, and different keys should conflict. Keep the draft available after failure and start a new quiz for a fresh attempt. Do not rewrite real learner records. Migration, conflict, UI recovery, and idempotent replay checks have not been performed.


### Tutor stream encoding and cleanup (not yet verified)

During authorized browser stream checks, split valid Hindi and supplementary characters across chunks, then supply invalid UTF-8 and an unfinished multibyte sequence at end-of-stream. Valid text should assemble normally; damaged encoding should fail with a generic message, cancel progressive output, retain interrupted context, and never report a completed answer. Deliver a malformed/oversized event with a reader cancellation promise that remains pending: reader-lock release and normal turn-finally control recovery must proceed without waiting for cancellation. Repeat explicit Stop, navigation, timeout, and late events after a new request. Existing terminal-event ordering and byte/line limits should still apply. Software cleanup does not establish upstream cancellation or audible stop. These checks have not been performed.


### Provider PCM reader ownership (not yet verified)

Inspect provider playback completion, explicit Stop, a new speech turn, fetch abort, odd final PCM bytes, empty streams, idle/playback timeout, and scheduling errors. Once a reader is acquired, it should release its lock in finally; unfinished streams should receive cancellation without delaying cleanup on that promise. Existing source-stop, deadline, abort-listener, controller-ownership, and fallback behavior must remain intact. Repeat with progressive sentence queues and a cancellation promise that never resolves: canceled output must not block later speech or change the new turn's status. Browser/network buffering and upstream provider work are outside this local cleanup claim. No playback, stream-injection, browser, or provider checks have been performed.


### Study storage unavailable recovery (not yet verified)

With an authorized isolated database, inspect locked/unwritable/corrupt storage during progress GET/DELETE, quiz creation, and score persistence. Expect generic JSON 503 with storage-unavailable, no paths/exception text, and a closed connection. Cookie identity/root-page and ordinary tutor/speech requests should not initialize SQLite; inspect them independently while persistence is unavailable. No quiz/result success should be reported after a failed storage operation. A write or deletion may have completed before a later error; refresh before retrying. Matching retry keys must preserve existing replay behavior once storage recovers. Inspect browser control recovery, root-page loading, and fresh quiz creation without a preexisting session row: owner/quiz should be inserted together, with no new owner retained if quiz insertion fails. After deleting progress, a later quiz should recreate its owner normally. No databases were altered and none of these failure scenarios have been executed.


### Corpus and readiness recovery (not yet verified)

In an authorized isolated copy, inspect /health with missing, invalid-UTF-8, malformed, and metadata-invalid corpus files. Expect generic JSON 503, corpus-unavailable, ok:false, and no session cookie. Restore valid notes and inspect normal offline/model readiness. In the browser, inspect non-2xx, malformed/oversized JSON, nonboolean capability flags, invalid model/note counts, offline/provider contradictions, and a 20-second stalled request. Invalid readiness must not enable provider controls or masquerade as offline practice; show an actionable setup/reload message. Health does not verify credentials, provider latency, database storage, or microphone behavior. No corpus files were changed and these checks were not executed.


### Bounded model answer text (not yet verified)

Inspect completed model answers and streamed deltas at/above 12,000 Unicode code points, including supplementary characters and an oversized first delta. The server must reject overflow before forwarding that delta; completed agent/terminal/legacy answers must not be retained as success or silently truncated. The browser must reject oversized completed model answers and unknown response modes. Exercise tool rounds separately: each provider response's streamed text has its own bound, while existing call/round limits remain active. On overflow inspect progressive speech cancellation, interrupted history, stream closure, control recovery, and ability to ask a narrower question. Already spoken text or tool writes are not rolled back. Offline all-note summaries should retain existing behavior, and this limit does not prove provider cancellation or cap billed usage. No model, browser, boundary, or speech checks have been performed.


### Terminal context bounds (not yet verified)

When local verification is authorized, enter self-authored questions at/above 1,200 Unicode code points, including supplementary characters. Over-limit input should be rejected before retrieval/provider work or history updates; normal input should continue. Inspect a displayed answer over 3,000 code points: full text and citations remain in terminal output, while subsequent context holds a bounded prefix with an explicit clipping marker. Complete more than ten turns and inspect only the latest 20 messages in context. Use /new to clear topic history before a generic clarification, then ask a new supported topic; /quit and /exit should still end cleanly. Reset is in-memory only and does not erase terminal scrollback. No interactive/provider/context-boundary checks have been performed.


### Terminal response preferences (not yet verified)

Select /language hi, ask a supported Article question in Devanagari and then Roman text, and inspect Hindi/Hinglish checked-note headings and summaries respectively. Unsupported questions should use the same preference. Select /language en and repeat both scripts for English notes. Changing language should retain topic context; /new should clear context while keeping the selected preference. /language auto should preserve English offline fallback and existing model language inference. Inspect unknown/missing/extra command arguments, spacing/case variants, and ensure control commands never enter model history or trigger retrieval/provider calls. With authorized model access, inspect translated evidence, preference instructions, and current-question explicit language overrides; compliance remains unverified. No interactive, model, or translation-quality checks have been performed.


### Model tool data-unavailable results (not yet verified)

In authorized isolated tool-loop checks, cause SQLite/file-access failures during start_quiz, score_answer, and get_weak_topics. The model should receive ok:false with generic recovery text, and the browser/trace should receive a failed tool outcome rather than a success result or leaked exception/path details. Inspect the model's narration: it must not claim a quiz started, a score saved, or progress loaded. Existing call/round limits still bound any retries; a failed response does not prove earlier writes were rolled back. Invalid argument and retry-conflict responses should retain their existing behavior, and normal successful tools should still work after recovery. This change is model-tool handling, not evidence of offline/provider/browser or transaction behavior. No tool failure injection, database mutation, model calls, or runtime checks were performed.


### Offline quiz/revision data failure (not yet verified)

In authorized isolated offline checks, cause SQLite/file-access failure during a quiz request and a saved weak-topic/revision request. Expect a recovery reply in English or Roman Hinglish according to preference, one failed start_quiz/get_weak_topics event, no successful tool result, and no quiz UI adoption. The tutor reply may complete while the tool outcome is false; diagnostics must retain that distinction. Inspect reader/controls/speech recovery and subsequent ordinary study questions without persistence. After data becomes available, explicit quiz/revision requests should work normally. Do not infer rollback or erase records during review. These tool, storage, browser, and narration checks have not been performed.


### Leading-zero article references (not yet verified)

In authorized retrieval/browser checks, compare Article 021 with Article 21, Article 021A with Article 21A, connected lists with repeated padded/canonical IDs, and supported padded numeric ranges. Include Devanagari decimal digits, all-zero IDs, unknown padded articles, descending ranges, suffix ranges, and more-than-64-element ranges. Canonicalization should strip leading zeros as text while preserving Latin suffixes; all-zero/unknown IDs must not acquire support, range guards remain, and duplicate references should not duplicate notes. Inspect citations and contextual follow-ups with these references. No retrieval evaluation, parser examples, browser, or provider checks have been executed.


### Revision tool result consistency (not yet verified)

Inspect get_weak_topics tool events with empty valid progress, populated valid progress, inconsistent total attempts, duplicate question/topic IDs, missing/extra weak topics, invalid score/date/count fields, and non-object results. Both model/offline completed payloads should apply the same saved-progress validator used by the progress panel. Unsupported successful tool names must fail the completed response; failed tool events should still retain bounded error reporting, including unavailable tools. Successful start_quiz and score_answer paths must retain their existing validation. On a malformed completed payload, inspect interrupted text/speech cleanup, recovery controls, and lack of quiz/result adoption; no false completed-turn success should be recorded. This validates structural consistency rather than answer quality, data authenticity, or semantic grading. No tool-result injection or browser/runtime checks were performed.


### Broad-topic retrieval scope (not yet verified)

Compare generic fundamental-rights overviews in English, Hindi, and Hinglish with questions that add a supported subject and questions that add an unrelated subject. Generic wording, starter-note/study/UPSC scaffolding, and language/repetition instructions should preserve the broad overview; supported subject terms should rank their matching notes, while the broad label alone must not supply overlap for unrelated subjects. Include explicit article IDs/lists/ranges, which retain their existing reference path, and contextual follow-ups under both overlap/rarity scoring. Inspect sources, unsupported replies, and differences from historical reports. This is lexical scope handling, not semantic eligibility or citation-support proof. No retrieval/scoring/browser checks or benchmark runs were performed.


### Speech provider client cleanup (not yet verified)

During authorized provider checks, repeat recorded transcription and streamed speech, including empty/oversized transcription results, provider rejection/timeout, and browser playback disconnects. Confirm the per-request client context exits after success and failure and that speech/transcription server error logs contain exception types rather than provider response bodies. Streamed speech must finish its response before client closure; a failure after audio headers must close the connection instead of appending a JSON error to PCM. Client cleanup does not prove provider-side cancellation or billing cessation. No provider, network-resource, disconnect, or browser checks were performed.


### Tutor model client ownership (not yet verified)

In authorized model checks, inspect terminal and legacy tutor requests plus agent turns with zero, one, and multiple tool rounds. Confirm one owned client spans the complete agent workflow and closes after a successful answer, rejected tool arguments, tool-round exhaustion, provider failure, or an interrupted streaming callback. Caller-injected response clients must remain open for their owner to reuse. Offline turns should create no provider client; note retrieval and source callbacks should still occur once. Inspect completed response/usage/source metadata and fixed-progress idempotency after cleanup. Closing local connections is not evidence of provider cancellation or rollback of tools already executed. No runtime/provider/resource observations were collected.


### Model stream completion order (not yet verified)

During authorized stream checks, inspect normal deltas followed by one completion; missing response data; duplicate completion; text after completion; and error, failed, or incomplete events both before and after completion. Malformed streams must fail the turn and close their reader/client scope rather than generating a completed answer or continuing tool rounds. Unknown ancillary events remain ignored. Include callback interruption and premature end. Server and terminal tutor error output should show exception types without raw provider messages; browser errors remain generic. Already displayed/spoken deltas and prior successful tool writes cannot be rolled back by this guard. No stream injection, provider, browser, speech, or runtime checks were performed.


### Bounded live setup responses (not yet verified)

In authorized live setup checks, inspect credential JSON at/beyond 64 KiB, connection SDP at/beyond 512 KiB, damaged UTF-8 across chunks, absent/empty bodies, invalid/non-object JSON, empty/oversized/whitespace credentials, and missing/non-integer/expired expiry times. Invalid credentials must fail before the provider connection; invalid SDP must fail before adopting the remote description. Cancel during either read and check prompt reader cleanup, microphone/peer cleanup, generic recovery feedback, and no stale success callback. Inspect valid rate-limited/busy responses for retained retry feedback. Limits bound wire bytes and do not verify credential authenticity, provider cancellation, or billing. No injected-response, browser, network, microphone, or provider checks were performed.


### Unsupported subject after prior context (not yet verified)

In authorized retrieval checks, follow supported questions with unrelated unsupported subjects in English, Hindi, and Hinglish. Include prior topics expressed as explicit article references and ordinary keyword questions, plus several intervening generic requests. Current subject terms must retrieve independently rather than borrowing old topic overlap; no-match questions should remain unsupported. Compare generic repetition/example/translation requests, which can still inherit a recent substantive topic, explicit current references, and supported new-topic switches. Include phrasing outside the generic-token vocabulary to inspect conservative abstention and known lexical limitations. Both scoring configurations share query selection; no semantic scope guarantee is claimed. No retrieval evaluation, examples, browser turns, or provider checks were run.


### Total streamed-audio bounds (not yet verified)

In authorized PCM checks, inspect streams at/beyond 14,400,000 bytes, including a single oversized chunk and continuous small chunks that avoid the 90-second idle timeout. Server output must close on over-limit data without a successful chunked terminator; browser checks must reject excess before copying/scheduling that chunk. Inspect the seven-minute browser deadline during fetch, suspended AudioContext resume, backpressure, and final playback. It should clear active sources, release readers, record overall-timeout/audio-limit where detectable, and mark partial speech incomplete; pending progressive segments should clear. Explicit Stop should remain cancellation rather than timeout. Limits apply per request/segment, not per conversation, and do not establish provider cancellation or billing caps. No long playback, stream injection, device/provider, or runtime checks were performed.


### Completed provider response status (not yet verified)

During authorized model checks, inspect terminal/legacy and agent responses with completed, incomplete, failed, cancelled, queued, in-progress, missing, and malformed status values. Non-completed responses must not become successful answers or execute their pending tool calls even when output_text or function calls exist. Include a completed stream event carrying a non-completed response object, and incomplete later rounds after earlier successful tools. Earlier speech/text or successful persisted tools cannot be rolled back; the whole turn must still fail rather than claiming completion. Caller-supplied response clients must supply the same completed-status contract. Inspect cleanup and generic errors without provider content. No status injections, provider calls, tool workflows, browser/device observations, or runtime checks were performed.


### Spoken Hindi article words (not yet verified)

During authorized retrieval/voice checks, compare Devanagari cardinal references for 12-22 with digit references, including both spellings of 15; English/Latin and Devanagari article prefixes; connected lists; ascending/descending ranges; repeated IDs; and spaced Latin suffixes such as 21 A. Include punctuation, Hindi vowel signs attached to a known word, longer unknown words, ordinals, Roman transliterations, and number words beyond the bounded vocabulary. Known words should normalize through the existing exact ID/range path; unsupported forms must not be silently inferred as supported numbers. A rejected reference can still enter ordinary lexical topic matching, so inspect that separately. Generic follow-ups should preserve recognized references and unsupported subject qualifiers should retain scope guards. No parser examples, retrieval evaluation, speech transcripts, browser/device checks, or provider calls were executed.


### Recorded STT configuration attribution (not yet verified)

For authorized recorded-STT comparisons, set BOLPREP_STT_MODEL to an available compatible transcription model, restart, and reuse the same consented/self-authored inputs and device settings. Inspect successful, empty/oversized, rejected, and timed-out provider responses; requested model metadata should remain distinct in schema 13 recorded_stt groups. Capture/upload failures or older servers without model metadata should remain null, not be assigned to a successful model group. Invalid/empty/overlong/unsafe configured IDs must fail before calling the provider; malformed returned metadata must fail transcript adoption. Live STT and tutor/TTS models remain separate. Existing live/tutor/stop report readers accept schema 13 without changing their own observations. Archive input pairing/environment separately; requested aliases and grouped timings do not prove model resolution, WER, pronunciation, account availability, or comparison fairness. No model comparisons, provider calls, reports, recordings, or browser checks were performed.


### Recorded input language changes (not yet verified)

In authorized browser checks, switch speech language while awaiting microphone permission, capturing a clip, awaiting recorder stop, uploading audio, and reading the transcription response. Old pending capture must be invalidated, discarded microphone tracks released immediately when available, uploads aborted locally, and delayed old transcripts prevented from replacing the draft. A previously reviewed transcript/draft should remain editable. Inspect busy/idle controls until recorder-owner cleanup finishes; start a fresh recording afterward and verify its selected language. Compare typing, Stop, and page hiding, which share the recorded-input cancellation helper. Capture released after a late permission grant must not start a recording. Local abort does not establish provider cancellation, deleted uploaded audio, or stopped billing. No microphone, timing/race injection, browser/device, provider, or runtime checks were performed.


### Known live-event payload validation (not yet verified)

During authorized live-event checks, inspect committed and transcription delta/completed/failed events with missing, empty, non-text, or oversized item IDs. For current items, inspect delta and final-transcript fields that are absent, null, arrays, objects, or numbers. Malformed known payloads must fail promptly with generic provider-failed recovery and capture cleanup before adopting an item or changing a draft, rather than waiting for the final timeout. Empty string transcripts retain the separate empty-transcript failure; valid empty deltas remain allowed. Valid completed-item duplicates and different known item IDs remain ignored as stale, and unknown well-formed event types remain ignored. Repeat during continuous turn clearing/reuse and after cancellation. No event injections, browser/device runs, recordings, or provider checks were performed.


### Tool enablement and argument parsing (not yet verified)

During authorized agent checks, inspect a completed response containing function calls for a turn that did not enable tools; it must fail before execution, output-item continuation, or progress writes. In tool-enabled turns, inspect non-text arguments, JSON at/beyond 16,000 characters, deeply nested arrays/objects, duplicate top-level and nested keys, invalid JSON, and valid supported arguments. Invalid argument bodies must produce failed tool results before scoring/persistence, with correction possible within existing call/round limits; duplicate JSON fields must not silently use a last value. Include failed start retries, repeated successful starts, score idempotency, and revision reads. This bounds local argument parsing, not SDK response buffering, provider billing, or semantic authorization inferred from the intent vocabulary. No mocked/tool/parser cases, provider calls, progress writes, or runtime checks were performed.


### JSON upload framing and parser errors (not yet verified)

In authorized local HTTP checks, inspect missing/duplicate/non-decimal Content-Length, Transfer-Encoding alongside JSON, empty/oversized bodies, truncated uploads, and uploads stalled past the socket timeout. Rejected framing/unread bytes must close the connection; incomplete/timed-out uploads must receive generic errors without entering tutor/tools/storage. Inspect invalid UTF-8, excessive JSON nesting, duplicate keys at top/nested levels, NaN/Infinity constants, non-object JSON, and normal browser requests. Parser failures must return generic 400 responses without echoing request contents; timeout should return 408 where the socket can deliver it. Existing body-size/rate/concurrency controls remain. These guards concern JSON routes; recorded-audio framing is a separate path. No raw-HTTP, parser, timeout, browser, provider, or runtime checks were performed.


### Clarify generic requests without a topic (not yet verified)

In authorized text/voice checks, begin with generic repetition/example/language requests with no recent topic, in English, Hindi, and Hinglish. Terminal, legacy HTTP, and agent paths should ask which article/topic is intended, with no sources invented. Model-configured generic requests should return a local/offline clarification without a provider call. Answer with an explicit supported article and inspect contextual follow-ups. Compare generic requests anchored to an unsupported prior article and standalone unsupported subjects: those should retain insufficient evidence rather than replacing the unsupported scope with a generic clarification. Retain ordinary quiz/revision intent behavior and current topic-switch precedence. This is a bounded lexical ambiguity rule, not semantic intent resolution. No examples, browser turns, model calls, or runtime checks were performed.


### Recorded transcription stage timing (not yet verified)

In authorized recorded-STT observations, inspect successful results with server_transcription_call_ms and older results without it. Timing must measure only the server SDK create call from monotonic start through return, and browser upload-to-result remains separate. Current-page summaries should use language/requested-model groups; exports retain completed-call timing sample counts and missing counts. Invalid strings, negative/non-finite/oversized timing values must fail adoption; null/absent values remain unavailable and must not become zero. Failed calls must not be scored as completed transcript timings. Do not subtract these clock/span measurements to claim network or provider-compute latency, and do not equate them with user speech end to audible response. No timing observations, browser checks, provider calls, or benchmark reports were performed.


### Bounded tutor/speech error bodies (not yet verified)

During authorized browser checks, inspect non-success tutor and speech responses with normal short error text, bodies at/beyond 128 KiB, damaged UTF-8, invalid JSON, arrays/scalars, empty messages, object-valued errors, and messages beyond 2,048 UTF-16 characters. Only a bounded text error should reach UI recovery; malformed/error-body parsing failures should use generic tutor/speech recovery text without parser details. Cancel during the error-body read and inspect preserved AbortError handling, reader release, disabled-control recovery, and no stale speech fallback. Include valid rate-limit/busy errors and authentication expiry. This bounds local body reads rather than provider-side resource use. No response injections, browser runs, provider calls, or runtime checks were performed.


### Recorded-audio upload framing (not yet verified)

In authorized local HTTP/browser checks, inspect missing/duplicate/signed/non-decimal Content-Length, Transfer-Encoding with audio, zero/oversized length, truncated audio, and an upload stalled beyond the server socket timeout. Invalid framing and unread bodies must close the connection; the provider must not be called. A timeout should return a generic 408 with audio-upload-timeout where delivery remains possible, and browser diagnostics should record upload-timeout with unknown model attribution. Compare valid WebM/MP4 blobs, existing size limits, cancellation, and fresh recording recovery. A browser-side 90-second request timeout remains transcription-timeout rather than proof of server upload timeout. No HTTP injections, upload/timeout experiments, browser/device checks, recordings, or provider calls were performed.


### Explicit offline launch (not yet verified)

In authorized setup/runtime checks, launch the server/terminal with --offline or the launcher with -Offline, including an existing configured key. Health should report offline mode and provider speech/input capabilities disabled; direct provider routes should reject before calling providers, and agent/terminal questions should use local notes/tools. BOLPREP_OFFLINE=1 should have the same effect, including caller-injected agent clients; direct ask_model should reject. Confirm .env and configured access password are preserved, and normal mode requires a fresh process without the override. Combine -Frozen/-Offline and inspect dependency/setup behavior separately. Browser recognition/synthesis may still use external services, and offline mode does not revoke a live session created by another process. No installations, server launches, provider calls, browser/device observations, or runtime checks were performed.


### Speech setting changes during pending playback (not yet verified)

In authorized browser checks, change installed voice, provider voice, speech backend, language, and rate during voice preview, full-answer browser playback, progressive speech, pending browser onstart, provider fetch/resume, and queued PCM. Any active/pending output should stop through the existing speech identity/queue/deadline cleanup; subsequent deltas or delayed start/end callbacks must not restart it. Text generation can continue, and the next explicit playback should use the chosen setting. Inspect persisted voice preferences, incomplete-speech history markers, and local stop diagnostics. Changing settings with no active speech should not create an interruption sample. Progressive speech already captures its original configuration; this change makes user controls consistent, not a proof of acoustic stop latency. No audio, browser, race injection, provider, or runtime checks were performed.


### On-page speech timing table (not yet verified)

In authorized browser checks, open Speech diagnostics before collecting data and confirm the empty state. After actual completed, failed, and cancelled attempts, refresh and compare each configuration/metric with the same JSON snapshot. Confirm timing sample counts exclude missing recorded server-call timing and live timing fields, missing values say unavailable, and repeated outcome counts are not summed. Change language, voice/rate, recorded model, and live pause/continuous/reuse settings to inspect separate groups. Check narrow-screen horizontal scrolling, keyboard focus, headers, caption, and opening/refresh behavior. Reload should clear observations; no learner text/audio or preloaded benchmarks should appear. No browser, device, provider, or runtime checks were performed.
