# Browser voice evaluation run sheet

Use this sheet to compare browser-provided speech features on the same device and phrases. It is a small manual check, not a representative benchmark.

## Record the setup

- Date and time:
- Browser and version:
- Operating system and device:
- Network state:
- Speech language selected in BolPrep:
- Installed TTS voice selected (name and locale):
- Browser-provided STT available:

Do not record or upload learner audio for this run. The app keeps timing summaries in page memory and does not retain transcript text in those metrics.

## TTS checks

Use **Preview** for the fixed English phrase. For Hindi and Hinglish, run BolPrep without an API key, ask the corresponding fixed offline question in the STT table, and repeat the same answer at least ten times. Keep the browser, device, language, and question/answer the same when comparing voices. Reloading the page clears the timing samples. Since Hindi/Hinglish samples use tutor answers while English uses Preview, compare p50/p95 only within the same sample type.

| Language | TTS phrase / question | Intelligibility (1-5) | Pronunciation (1-5) | Naturalness (1-5) | Notes / failures |
| --- | --- | ---: | ---: | ---: | --- |
| Hindi | Use Hindi STT prompt below; listen to the offline tutor answer. | | | | |
| Hinglish | Use Hinglish STT prompt below; listen to the offline tutor answer. | | | | |
| English | Hello, let's study fundamental rights together. | | | | |

Record the displayed TTS start-delay p50/p95 and playback-duration p50/p95 separately for each voice, language, and sample type (Preview or tutor answer):

| Language / voice | Sample type | Runs | Start p50 / p95 (s) | Playback p50 / p95 (s) | Failures |
| --- | --- | ---: | ---: | ---: | --- |
| | | | | | |

## STT checks

Read each prompt once at a natural pace. Compare the recognized text with the reference and note omitted, substituted, or extra words. Repeat at least ten times per language before interpreting the displayed latency p50/p95.

| Language | Reference prompt | Recognized text | Exact match? | Error notes |
| --- | --- | --- | --- | --- |
| Hindi | अनुच्छेद 14 में समानता के दो विचार क्या हैं? | | | |
| Hinglish | Article 14 mein equality ke do ideas kya hain? | | | |
| English | What two ideas does Article 14 protect? | | | |

Record the displayed STT time-to-first-final p50/p95 by language:

| Language / STT locale | Runs | First-final p50 / p95 (s) | Failed / empty results | Notes |
| --- | ---: | ---: | ---: | --- |
| | | | | |

## Report carefully

- Include browser, device, selected voice/locale, sample phrase, run count, and failures with any results.
- The UI reports browser event timings, not end-to-end model latency. It does not measure speech quality automatically.
- Listener ratings are subjective. Record them with the rater's consent; do not treat one person's ratings as a general result.
- Never describe these small manual samples as production, learner, or population-level benchmarks.
