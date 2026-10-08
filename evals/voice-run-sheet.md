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

## Spoken quiz flow

Use the same browser, device, quiz language, and selected speech voice for each attempt. Start a three-question quiz, listen to each prompt, answer aloud using browser **Speak** or the optional **Record** control, review and edit the transcript, then submit it. Continue through all questions. For at least one answer, use a self-authored response that clearly covers a rubric point; do not use real learner recordings. Repeat the flow three times and record each stage as pass, fail, or unavailable.

Check that each question prompt is audible and readable, the transcript remains editable before submission, feedback and score appear after submission, the next question can be reached, and the saved-progress panel reflects completed scores. If using **Record**, note that a configured provider may incur usage; mark that path unavailable if it is not configured. Reload the page before checking saved progress. This manual exercise checks visible flow only; it does not measure speech accuracy or prove that the rubric evaluates meaning beyond its configured phrases.

| Trial | Language / voice | Prompt audible? | Transcript editable? | Feedback and score shown? | Next question reached? | Saved progress visible after reload? | Failure stage / notes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |

## Turn-taking and interruption checks

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
