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

- Stall a tutor request before response headers, then after one text segment: after 90 seconds without data, verify a timeout message, restored send control, removed incomplete answer, and no pending speech restart. The question should remain in history as a failed turn.
- Keep response chunks arriving less than 90 seconds apart but hold the turn open for five minutes: verify the total deadline ends it. Completed tool effects may remain; inspect actual progress before retrying.
- Stop/Escape or start a follow-up before expiry: the old turn should count as canceled and old timers must not affect the new request. Complete a normal answer then leave playback running: tutor timers should not stop it.
- Export diagnostics: timeouts should increase failure counts, not cancellation or success counts. Record browser timer delays and missing trace metadata separately. Provider generation cancellation remains unverified.

### Follow-up context after stopping completed speech (not yet performed)

Let a tutor finish generating text while its browser/provider voice continues. Stop or interrupt the playback, then ask for an example or explanation of the last topic: the next history payload should keep that answer with one playback-stopped note and the original user question. Repeat before first audio with queued speech, after natural completion, and with a voice preview; only stopped pending tutor speech should annotate its associated answer. A pending model answer still uses its separate interruption note.

Repeat with a long Unicode answer: history must stay within 3,000 code points per assistant message while the displayed answer remains complete. Start New session and confirm earlier annotations do not enter new follow-ups. Do not infer exact heard words or provider cancellation from the note.

### Speech-stop diagnostics checks (not yet performed)

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

### Recent-topic follow-up checks (not yet performed)

Ask about Article 14, then send language-only requests such as "Hindi mein samjhao", "in English please", and "Hinglish mein bolo". Repeat with Devanagari language names. Inspect whether Article 14 sources remain available, then send a generic example request to check language-only turns were skipped as topic anchors. Separately check answer text language and speech settings; retained evidence alone does not prove either one changed. Also try a substantive question about minority language/culture protections and inspect whether it selects its own evidence.

After asking about Article 14, ask "personal liberty kya hai?" without an article number. Inspect whether Article 21 evidence is selected from the current question instead of inheriting Article 14. Then ask for an example and check the new topic remains the anchor. Repeat with Hindi and English wording, and record weak lexical matches or false topic switches.

Ask about Article 14, then Article 21, then ask for an example without naming an article. Retrieval should anchor Article 21. Repeat with another generic clarification, Hindi/Roman Hinglish wording, and an explicit current Article 19 request; the current explicit article must win. Switch to a newer substantive topic without an article, and inspect whether its note is supported or clarification is needed.

Try an unsupported recent article and an unrelated substantive question: do not use an older note merely to force evidence. Check full model history separately from the retrieval query, and record false context carryover/abstention cases before claiming multi-turn accuracy.
