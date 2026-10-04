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
