# BolPrep demo outline

This is a recording plan, not a demo video or a claim that every step has been verified. Use the [voice run sheet](evals/voice-run-sheet.md) to check each browser and device interaction before recording. Show actual behavior and results from that session.

## Reproducible local walkthrough

Start BolPrep with `tools/run-local.ps1` and open `http://127.0.0.1:8000`. Keep the app in offline mode so the walkthrough does not need a model credential or incur provider usage.

1. **Show the setup state.** Point out that the page reports offline practice mode and that the question is answered from the local, source-linked study notes.
2. **Ask in Hinglish.** Submit “Article 14 kya kehta hai?” Show the answer and open its Constitution source link. Say that this answer is a checked note summary, not a generated model explanation.
3. **Play the answer.** Select Hindi / Hinglish and let the browser read the answer. Show the speech-start status and listen for intelligibility. If the browser has no suitable installed voice, say so and keep the result marked unavailable; do not treat the browser event time as first-audible latency.
4. **Interrupt playback.** Start an answer, then press **Stop** while it is speaking. Confirm the audio stops and does not resume. This checks local playback interruption; it does not prove that an upstream model request was canceled.
5. **Run a quiz.** Start the built-in quiz, answer one question, and show the rubric feedback and saved progress. Explain that scoring matches listed phrases and does not judge semantic equivalence.
6. **Show diagnostics.** Open Speech diagnostics. Export only after collecting actual attempts; explain that the export contains timings and failure counts, not speech text or audio. Use the run sheet to record language, voice, configuration, and failures.
7. **Close with limits.** State which browser and voice were used, which steps worked, and what was unavailable. Do not describe constructed retrieval results as learner, STT, pronunciation, or answer-quality benchmarks.

## Optional model-mode segment

Only include this segment when a server-side API key is configured and usage is approved. Keep the key out of the recording and repository, and mention any provider usage that may be billed.

1. Show that the page is in model mode and submit a self-authored Hindi or Hinglish study question.
2. With browser speech selected, show text arriving as the model streams and complete sentences entering the browser speech queue. Optionally repeat with provider speech selected: confirm the first sentence plays before text completion, later segments stay ordered, and Stop still clears the queue after the text is complete. Report gaps and unavailable playback honestly.
3. Press **Escape** before the first queued sentence starts, then ask a follow-up. Show that the interrupted client turn stays stopped and the new turn works. Describe provider-side cancellation as unverified unless it has been independently measured.
4. If demonstrating quiz or revision tools, label the exact live model session and inspect its tool result. The local deterministic quiz button is a separate flow and does not prove model tool selection.

## Before recording

- Use self-authored questions and your own microphone if you demonstrate speech input. Do not use learner recordings.
- Check the selected language, installed voice, browser speech rate, and microphone permission on the recording device.
- Run the relevant interruption, quiz, and speech cases in the [voice run sheet](evals/voice-run-sheet.md); mark unavailable cases honestly.
- Record measured values only from the visible diagnostics or a timed run-sheet attempt. Keep acoustic first-audible timing separate from browser synthesis `onstart` timing.
- Capture a short technical explanation of the browser STT/TTS path, optional provider paths, source-grounded offline mode, and one observed failure that led to a fix.

## Optional demo access checks

Before recording a password-gated demo, configure a separate private BOLPREP_ACCESS_PASSWORD in the ignored .env and restart. Do not show the file or password in the recording. In a fresh browser session, confirm the tutor redirects to sign-in and unauthenticated API requests cannot access tutor, speech, quiz, or progress data. Check a wrong password, a successful login, six-attempt login throttling, Sign out, expired/revoked access, and server restart. Confirm the browser stops mic/output before redirect and that signing out preserves browser-scoped progress without sharing it between browser progress cookies. These behaviors remain unverified; the default offline smoke check runs with login disabled. This gate is for localhost and has not been deployed or audited for hosted access.
