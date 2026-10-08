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

For browser recognition, Live mic, and Record separately, switch tabs/minimize while connecting, listening, and finalizing. No canceled final transcript should submit automatically or overwrite a later draft. Unconfirmed browser/live words should restore the original draft; confirmed browser words should remain for review. For Record, also hide while microphone permission is pending and while the upload is transcribing: newly granted tracks should close, the clip should be discarded, and late results should be ignored. Check the browser's microphone indicator and restart each input explicitly after returning. Navigate away/back to exercise pagehide and cached-page restoration. Record device/lifecycle failures; a local stop command does not prove immediate hardware release or upstream cancellation.

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
