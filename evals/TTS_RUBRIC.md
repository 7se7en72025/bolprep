# TTS listener rubric, version 1

This is a collection protocol, not measured speech-quality results. The scorer and rubric have not been exercised with real listeners.

Use the same self-authored prompts, fluent listeners, playback device, volume, and environment across configurations. Assign anonymous listener codes, and keep names, contact details, credentials, transcripts, and recordings out of the ratings file. Use Hindi, English, and Hinglish labels separately; a listener should rate only languages they understand. Counterbalance voice order where possible, and note actual model/voice/rate settings and order in your private run sheet. Prompt IDs must refer to identical text across configurations.

## Ratings

Rate a successfully heard sample from 1 to 5 on each dimension. Use the anchors below consistently; these are subjective ordinal ratings, not a validated population benchmark.

| Score | Pronunciation | Intelligibility | Naturalness |
| --- | --- | --- | --- |
| 1 | Frequent word errors obscure the intended words. | Most intended content cannot be understood. | Strongly broken rhythm or delivery throughout. |
| 2 | Repeated noticeable word errors. | Substantial effort or repeated listening is needed. | Frequent awkward rhythm, stress, or pauses. |
| 3 | Some noticeable errors, with most words recognizable. | Most content is understood, with some unclear parts. | Mixed delivery with several awkward stretches. |
| 4 | Minor errors with words readily recognizable. | Clear content with only minor effort. | Mostly comfortable rhythm with minor awkwardness. |
| 5 | Words and language switches are pronounced clearly to the listener. | All intended content is clear on the first listen. | Comfortable, fluent rhythm, stress, and pauses throughout. |

A failed playback is not a score of 1. Record it as failed with no ratings and a reason: `no-audio`, `playback-error`, `unsupported-language`, or `other`. Low quality from successfully heard audio should receive ratings rather than a playback-failure label.

## Input

Save a private UTF-8 file such as `evals/local-tts-ratings.json`:

```json
{
  "rubric_version": 1,
  "trials": []
}
```

The empty shape above is not a usable evaluation: add 1-10,000 actual listener observations. Each observation has:

| Field | Meaning |
| --- | --- |
| `config` | Short configuration label, linked to exact settings in the run sheet. |
| `language` | `Hindi`, `Hinglish`, or `English`. |
| `prompt_id` | Shared identifier for the exact prompt text. |
| `listener_id` | Anonymous listener code, reused consistently across configurations. |
| `outcome` | `completed` or `failed`. |
| `ratings` | For completed playback, an object with integer `pronunciation`, `intelligibility`, and `naturalness` scores from 1 to 5. For failed playback, null. |
| `failure_reason` | Required for failed playback, omitted for completed playback. |

Configuration/prompt/listener labels must start with a letter or digit and contain only letters, digits, `_`, `.`, or `-`, with at most 64 characters. One configuration/language/prompt/listener combination can appear only once; duplicates are rejected. For repeated-rating studies, use a separate input/report for each round and describe the design instead of inventing new listener identities.

## Report

```powershell
node evals/score_tts.js evals/local-tts-ratings.json | Out-File -Encoding utf8 evals/local-tts-report.json
```

The report gives per-configuration/language attempt, completion, failure, prompt, and listener counts. Rating histograms and nearest-rank medians use completed observations only; an even-sized sample uses the lower median. Failed-only groups have null medians. Separate pairing flags compare all observations and completed observations using prompt/listener IDs. A single configuration cannot establish matched comparison coverage. Inspect failures and unequal coverage before comparing ratings.

No prompt text, listener IDs, audio, or individual rating rows are printed. Configuration labels do appear, so never use names or secrets as labels. Files matching `evals/local-tts-*.json` are ignored by Git. The report cannot verify prompt identity, listeners, order, settings, or supplied ratings, and does not perform a statistical significance test or select a best voice. Keep sample size and design limitations with any shared report. No measured TTS results are claimed.
