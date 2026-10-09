# Speech evaluation collection plan

This is a provider-free way to prepare paired input rows. It does not record audio, transcribe speech, play a voice, recruit listeners, or produce benchmark numbers.

The tracked [`speech_prompts.json`](speech_prompts.json) contains 30 self-authored study questions: ten scenarios with English, Hindi, and Hinglish variants. Six scenarios (18 prompts) are marked `development`; four (12 prompts) are marked `heldout`. All three language variants of a scenario stay in the same split. These labels were authored before collection, but the file is visible to developers and no independent held-out performance is claimed. The question text is the intended STT reference and the matched TTS prompt. Check the spoken wording before an actual run; changing any prompt requires a new plan and hash.

## Freeze configuration metadata

Create a private `evals/local-speech-configs.json` file with settings for the actual device and configurations you intend to compare. Fill in at least two configurations for STT and two for TTS; labels and settings are supplied by you and do not prove provider or device identity. Keep secrets, names, and contact details out. The `Fill in...` strings below are rejected until replaced. Example **structure only**:

```json
{
  "schema_version": 1,
  "repeats_per_prompt": 2,
  "listener_ids": ["listener-01", "listener-02"],
  "stt_configurations": [
    {
      "id": "stt-a",
      "environment": "Fill in actual browser, OS, microphone, room, and date before collection",
      "settings_by_language": {
        "English": "Fill in actual recognizer, requested model, and locale",
        "Hindi": "Fill in actual recognizer, requested model, and locale",
        "Hinglish": "Fill in actual recognizer, requested model, and locale"
      }
    },
    {
      "id": "stt-b",
      "environment": "Fill in actual browser, OS, microphone, room, and date before collection",
      "settings_by_language": {
        "English": "Fill in actual recognizer, requested model, and locale",
        "Hindi": "Fill in actual recognizer, requested model, and locale",
        "Hinglish": "Fill in actual recognizer, requested model, and locale"
      }
    }
  ],
  "tts_configurations": [
    {
      "id": "tts-a",
      "environment": "Fill in actual browser, OS, playback device, volume, room, and date",
      "settings_by_language": {
        "English": "Fill in actual voice, backend, rate, and locale",
        "Hindi": "Fill in actual voice, backend, rate, and locale",
        "Hinglish": "Fill in actual voice, backend, rate, and locale"
      }
    },
    {
      "id": "tts-b",
      "environment": "Fill in actual browser, OS, playback device, volume, room, and date",
      "settings_by_language": {
        "English": "Fill in actual voice, backend, rate, and locale",
        "Hindi": "Fill in actual voice, backend, rate, and locale",
        "Hinglish": "Fill in actual voice, backend, rate, and locale"
      }
    }
  ]
}
```

`repeats_per_prompt` is 1–10 **STT** attempts for every prompt and configuration. TTS has one playback rating per prompt/configuration/anonymous listener, matching the existing TTS scorer's uniqueness rule. For a separate TTS rating round, prepare another collection with a distinct configuration file and keep both rounds separate. Two listener IDs are a planned review design, not evidence that anyone listened.

## Prepare and fill observations

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe evals/prepare_speech_eval.py prepare --config evals/local-speech-configs.json --output evals/local-speech-plan.json
```

The plan copies prompt text into paired rows and records exact raw-byte SHA-256 hashes of the prompt manifest, configuration file, and preparation code. Every row starts with `observation_status: "unobserved"`, `transcript` or `ratings: null`, and `failure_reason: null`. These blanks are **not failed trials**. Preparing a plan does not call a provider or create observations. The command refuses to overwrite an existing output.

During real collection, edit only result fields in this ignored private plan:

- STT success: `observation_status: "completed"`, actual raw `transcript` text (1–6,000 Unicode code points), `failure_reason: null`.
- STT failure: `observation_status: "failed"`, `transcript: null`, and one failure code accepted by [`score_stt.js`](score_stt.js).
- TTS heard playback: `observation_status: "completed"`, three independent 1–5 rubric ratings, `failure_reason: null`.
- TTS playback failure: `observation_status: "failed"`, `ratings: null`, and one code accepted by [`score_tts.js`](score_tts.js). A failed playback receives no invented rating.

Keep prompt IDs, language, split, reference text, configuration IDs, repeat numbers, and listener IDs unchanged. Actual listeners should use anonymous IDs consistently across configurations and follow [`TTS_RUBRIC.md`](TTS_RUBRIC.md). The tool checks fixed fields against the current manifest/configuration, but cannot verify that a person, recording, voice, setting, or transcript is authentic.

## Export only collected rows

Export STT and TTS separately, after **every row in the chosen modality and split** has a completed or failed observation:

```powershell
.\.venv\Scripts\python.exe evals/prepare_speech_eval.py export-stt --config evals/local-speech-configs.json --plan evals/local-speech-plan.json --split development --output evals/local-speech-stt-development.json
.\.venv\Scripts\python.exe evals/prepare_speech_eval.py export-tts --config evals/local-speech-configs.json --plan evals/local-speech-plan.json --split heldout --output evals/local-speech-tts-heldout.json
```

Use `--split all` to require every planned row for that modality. Any unobserved selected row blocks export; the error reports a missing count and writes no scorer input. Exports also reject changed fixed fields, changed manifest/configuration/preparer bytes, invalid results, existing output names, or files over 4 MiB. Each scorer file receives a neighboring `-provenance.json` sidecar containing the manifest, configuration, collection-plan, preparer, scorer, and exact scorer-input hashes plus observed counts. Keep the private plan/configuration and sidecar together for reproduction. SHA-256 identifies exact bytes; it does not authenticate collection or human labels.

After an actual export, score with the existing tools:

```powershell
node evals/score_stt.js evals/local-speech-stt-development.json
node evals/score_tts.js evals/local-speech-tts-heldout.json
```

The scorer input formats do not include the split or plan hash, so retain the sidecar when interpreting a report. These examples are commands, not executed speech benchmarks. Do not compare development and held-out groups as if they were paired attempts, or describe a visible authored split as independent evaluation. Existing scorers report textual WER/CER and listener ratings; speech-end-to-first-audio still needs an actual observed stopwatch measurement.
