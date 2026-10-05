const form = document.querySelector("#question-form");
const input = document.querySelector("#question-input");
const conversation = document.querySelector("#conversation");
const statusLine = document.querySelector("#status");
const sendButton = document.querySelector("#send-button");
const micButton = document.querySelector("#mic-button");
const serverTranscribeButton = document.querySelector("#server-transcribe-button");
const serverSttNote = document.querySelector("#server-stt-note");
const stopButton = document.querySelector("#stop-button");
const modeLabel = document.querySelector("#mode-label");
const speechLanguage = document.querySelector("#speech-language");
const speechVoice = document.querySelector("#speech-voice");
const streamedTtsOption = document.querySelector("#streamed-tts");
const streamedTtsVoice = document.querySelector("#streamed-tts-voice");
const inputLabel = document.querySelector('label[for="question-input"]');
const previewVoiceButton = document.querySelector("#preview-voice");
const copySpeechDiagnosticsButton = document.querySelector("#copy-speech-diagnostics");
const downloadSpeechDiagnosticsButton = document.querySelector("#download-speech-diagnostics");
const speechPreferencesKey = "bolprep-speech-preferences";
let speechPreferences = {};
try {
  speechPreferences = JSON.parse(window.localStorage.getItem(speechPreferencesKey) || "{}") || {};
} catch {
  speechPreferences = {};
}
if (["hi-IN", "en-IN"].includes(speechPreferences.language)) {
  speechLanguage.value = speechPreferences.language;
}
if ([...streamedTtsVoice.options].some((option) => option.value === speechPreferences.streamedTtsVoice)) {
  streamedTtsVoice.value = speechPreferences.streamedTtsVoice;
}
const savedVoices = speechPreferences.voices && typeof speechPreferences.voices === "object"
  ? speechPreferences.voices
  : {};
if (speechPreferences.language && speechPreferences.voice && !savedVoices[speechPreferences.language]) {
  savedVoices[speechPreferences.language] = speechPreferences.voice;
}
const quizButton = document.querySelector("#quiz-button");
const nextQuestionButton = document.querySelector("#next-question");
const sendLabel = document.querySelector("#send-label");
const progressSummary = document.querySelector("#progress-summary");
const weakTopics = document.querySelector("#weak-topics");
const progressRefreshButton = document.querySelector("#refresh-progress");
const clearProgressButton = document.querySelector("#clear-progress");

const history = [];
let activeRequest = null;
let recognition = null;
let recognitionAvailable = false;
let recognitionListening = false;
let recognitionRun = 0;
let serverTranscriptionAvailable = false;
let activeTranscriptionController = null;
let activeMediaRecorder = null;
let activeMediaStream = null;
let serverRecordingChunks = [];
let discardServerRecording = false;
let serverRecordingTimer = null;
let serverRecordingStarting = false;
let serverRecordingStartCancelled = false;
let serverRecordingRun = 0;
let recognitionStartedAt = null;
let recognitionHadFinalResult = false;
let pendingQuestion = null;
let matchingSpeechVoices = [];
let streamingTtsAvailable = false;
let activeSpeechController = null;
let speechAudioContext = null;
const scheduledSpeechSources = new Set();
const speechSamples = [];
const speechFailures = [];
const recognitionSamples = [];
const recognitionFailures = [];
let recognitionLastError = null;
let turn = 0;
let speechTurn = 0;
let progressRequestId = 0;
let quizSession = null;

function updateMicrophoneButton(listening, disabled = false) {
  const label = listening ? "Stop" : "Speak";
  const unavailable = !recognitionAvailable;
  const actionLabel = unavailable
    ? "Voice input is unavailable in this browser. You can type your question."
    : listening ? "Stop voice input" : "Start voice input";
  micButton.querySelector(".button-label").textContent = label;
  micButton.setAttribute("aria-label", actionLabel);
  micButton.setAttribute("aria-pressed", String(listening));
  micButton.classList.toggle("is-listening", listening);
  micButton.title = actionLabel;
  micButton.disabled = disabled || unavailable;
}

function addMessage(role, text, sources = []) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "tutor-message"}`;
  const speaker = document.createElement("span");
  speaker.className = "speaker";
  speaker.textContent = role === "user" ? "YOU" : "BOLPREP";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(speaker, paragraph);
  if (sources.length) {
    const sourceList = document.createElement("div");
    sourceList.className = "sources";
    const label = document.createElement("span");
    label.className = "sources-label";
    label.textContent = "STUDY SOURCE";
    sourceList.append(label);
    for (const source of sources) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${source.section} · ${source.title}`;
      sourceList.append(link);
    }
    article.append(sourceList);
  }
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
}

function rememberTurn(userMessage, assistantMessage) {
  history.push(
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  );
  history.splice(0, Math.max(0, history.length - 20));
}

function stopRecognition() {
  recognitionListening = false;
  updateMicrophoneButton(false);
  if (!recognition) return;
  try {
    recognition.abort();
  } catch {
    // The recognizer may already have ended between UI events.
  }
}

function updateServerTranscribeButton(state = "idle") {
  serverTranscribeButton.hidden = !serverTranscriptionAvailable;
  const recording = state === "recording";
  serverTranscribeButton.disabled = !serverTranscriptionAvailable || state === "busy";
  serverTranscribeButton.querySelector(".button-label").textContent = recording ? "Stop" : "Record";
  const label = recording
    ? "Stop recording and transcribe the question"
    : "Record a question for server transcription";
  serverTranscribeButton.setAttribute("aria-label", label);
  serverTranscribeButton.title = label;
  serverTranscribeButton.classList.toggle("is-listening", recording);
  serverTranscribeButton.setAttribute("aria-pressed", String(recording));
}

function stopServerRecording(discard = false) {
  if (serverRecordingTimer !== null) {
    window.clearTimeout(serverRecordingTimer);
    serverRecordingTimer = null;
  }
  if (!activeMediaRecorder) return;
  discardServerRecording = discard;
  updateServerTranscribeButton("busy");
  if (activeMediaRecorder.state === "recording") activeMediaRecorder.stop();
}

async function startServerRecording() {
  if (!serverTranscriptionAvailable || activeMediaRecorder || activeTranscriptionController) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function") {
    statusLine.textContent = "This browser cannot record audio. Use browser speech input or type your question.";
    return;
  }
  stopTutor();
  serverRecordingStartCancelled = false;
  serverRecordingStarting = true;
  const recordingRun = ++serverRecordingRun;
  updateServerTranscribeButton("busy");
  statusLine.textContent = "Allow microphone access, then ask a short question. Audio is sent for transcription when you stop.";
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (recordingRun !== serverRecordingRun || serverRecordingStartCancelled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((candidate) => typeof MediaRecorder.isTypeSupported === "function"
        && MediaRecorder.isTypeSupported(candidate));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const baseType = recorder.mimeType.split(";", 1)[0].toLowerCase();
    if (!new Set(["audio/webm", "audio/mp4"]).has(baseType)) {
      throw new Error("This browser did not provide a supported WebM or MP4 recording format.");
    }
    activeMediaStream = stream;
    activeMediaRecorder = recorder;
    serverRecordingChunks = [];
    discardServerRecording = false;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) serverRecordingChunks.push(event.data);
    };
    recorder.onerror = () => {
      stopServerRecording(true);
      statusLine.textContent = "Recording failed. Try again or type your question.";
    };
    recorder.onstop = () => {
      if (serverRecordingTimer !== null) {
        window.clearTimeout(serverRecordingTimer);
        serverRecordingTimer = null;
      }
      const discard = discardServerRecording;
      const audio = new Blob(serverRecordingChunks, { type: recorder.mimeType });
      serverRecordingChunks = [];
      activeMediaRecorder = null;
      activeMediaStream?.getTracks().forEach((track) => track.stop());
      activeMediaStream = null;
      discardServerRecording = false;
      updateServerTranscribeButton();
      if (discard) return;
      if (!audio.size) {
        statusLine.textContent = "No audio was recorded. Try again or type your question.";
        return;
      }
      void transcribeRecordedAudio(audio);
    };
    recorder.start();
    updateServerTranscribeButton("recording");
    statusLine.textContent = "Recording. Tap Stop or speak for up to 20 seconds.";
    serverRecordingTimer = window.setTimeout(() => {
      statusLine.textContent = "20-second recording limit reached. Transcribing your question.";
      stopServerRecording(false);
    }, 20_000);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    if (recordingRun !== serverRecordingRun || serverRecordingStartCancelled) return;
    activeMediaRecorder = null;
    activeMediaStream = null;
    updateServerTranscribeButton();
    statusLine.textContent = `${error.message || "Microphone access failed."} Check browser permission or type your question.`;
  } finally {
    if (recordingRun === serverRecordingRun) serverRecordingStarting = false;
  }
}

async function transcribeRecordedAudio(audio) {
  const controller = new AbortController();
  activeTranscriptionController = controller;
  updateServerTranscribeButton("busy");
  statusLine.textContent = "Transcribing your recording. Review the text before asking.";
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": audio.type.split(";", 1)[0] || "audio/webm",
        "X-Speech-Language": speechLanguage.value,
      },
      body: audio,
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Transcription failed.");
    if (activeTranscriptionController !== controller) return;
    if (typeof payload.transcript !== "string" || !payload.transcript.trim()) {
      throw new Error("The transcription provider returned an empty transcript.");
    }
    input.value = payload.transcript.trim();
    input.focus();
    statusLine.textContent = "Transcript ready. Review it, then ask.";
  } catch (error) {
    if (error.name !== "AbortError" && activeTranscriptionController === controller) {
      statusLine.textContent = `${error.message} You can record again or type your question.`;
    }
  } finally {
    if (activeTranscriptionController === controller) activeTranscriptionController = null;
    updateServerTranscribeButton();
  }
}

function recognitionErrorMessage(error) {
  const messages = {
    "audio-capture": "No microphone was found. Check that one is connected, or type instead.",
    "language-not-supported": "This browser cannot recognize the selected speech language. Choose another language, or type instead.",
    "network": "Speech recognition could not reach its service. Check your connection, or type instead.",
    "not-allowed": "Microphone access was denied. Allow it in your browser settings, or type instead.",
    "no-speech": "No speech was heard. Tap Speak and try again, or type instead.",
    "service-not-allowed": "This browser does not allow its speech recognition service. You can type instead.",
  };
  return messages[error] || `Speech recognition issue (${error}). You can type instead.`;
}

function preserveInterruptedTurn() {
  if (!activeRequest || !pendingQuestion) return;
  const interruptionNote = "I stopped before finishing that answer. You can ask a follow-up or try again.";
  addMessage("assistant", interruptionNote);
  rememberTurn(pendingQuestion, interruptionNote);
  pendingQuestion = null;
}

function stopSpeechOutput() {
  speechTurn += 1;
  window.speechSynthesis?.cancel();
  activeSpeechController?.abort();
  activeSpeechController = null;
  scheduledSpeechSources.forEach((source) => {
    try { source.stop(); } catch { /* The source may already have ended. */ }
  });
  scheduledSpeechSources.clear();
}

function prepareStreamingAudio() {
  if (!streamedTtsOption.checked) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  speechAudioContext ||= new AudioContextClass({ sampleRate: 24000 });
  speechAudioContext.resume().catch(() => {});
  return speechAudioContext;
}

function stopTutor() {
  stopSpeechOutput();
  preserveInterruptedTurn();
  activeRequest?.abort();
  activeRequest = null;
  if (quizSession && !quizSession.awaitingAnswer) {
    quizSession.awaitingAnswer = true;
    input.value = quizSession.pendingAnswer || "";
    quizSession.pendingAnswer = "";
  }
  stopRecognition();
  serverRecordingStartCancelled = true;
  serverRecordingRun += 1;
  serverRecordingStarting = false;
  updateServerTranscribeButton();
  if (activeMediaRecorder) stopServerRecording(true);
  activeTranscriptionController?.abort();
  turn += 1;
  sendButton.disabled = false;
  micButton.disabled = !recognitionAvailable;
}

function refreshSpeechVoices() {
  const speechSynthesis = window.speechSynthesis;
  const targetLanguage = speechLanguage.value.split("-")[0].toLowerCase();
  matchingSpeechVoices = (speechSynthesis?.getVoices() || []).filter((voice) =>
    voice.lang.toLowerCase().startsWith(`${targetLanguage}-`) || voice.lang.toLowerCase() === targetLanguage
  );
  speechVoice.replaceChildren();
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "Browser default";
  speechVoice.append(automatic);
  matchingSpeechVoices.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = `${voice.name}|${voice.lang}|${voice.voiceURI}`;
    option.textContent = `${voice.name} (${voice.lang})`;
    speechVoice.append(option);
  });
  speechVoice.value = matchingSpeechVoices.some((voice) =>
    `${voice.name}|${voice.lang}|${voice.voiceURI}` === savedVoices[speechLanguage.value]
  ) ? savedVoices[speechLanguage.value] : "";
  speechVoice.disabled = matchingSpeechVoices.length === 0;
  if (!matchingSpeechVoices.length) {
    const languageName = targetLanguage === "hi" ? "Hindi" : "English";
    automatic.textContent = `Browser default (${languageName} voice unavailable)`;
    speechVoice.title = `No installed ${languageName} voice was found; the browser may use another default voice.`;
  } else {
    speechVoice.title = "Choose an installed voice or use the browser default.";
  }
}

function saveSpeechPreferences() {
  savedVoices[speechLanguage.value] = speechVoice.value;
  speechPreferences = {
    language: speechLanguage.value,
    voices: savedVoices,
    streamedTtsVoice: streamedTtsVoice.value,
  };
  try {
    window.localStorage.setItem(speechPreferencesKey, JSON.stringify(speechPreferences));
  } catch {
    // Speech settings still work for this page when browser storage is unavailable.
  }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function speechTimingSummary(sample) {
  const matchingSamples = speechSamples.filter((item) =>
    item.language === sample.language && item.voice === sample.voice && item.kind === sample.kind
  );
  const matchingFailures = speechFailures.filter((item) =>
    item.language === sample.language && item.voice === sample.voice && item.kind === sample.kind
  );
  let summary = "no completed utterances";
  if (matchingSamples.length) {
    const startTimes = matchingSamples.map((item) => item.startMs);
    const playbackTimes = matchingSamples.map((item) => item.playbackMs);
    const seconds = (milliseconds) => (milliseconds / 1000).toFixed(2);
    summary = `n=${matchingSamples.length}, start p50/p95 `
      + `${seconds(percentile(startTimes, 0.5))}/${seconds(percentile(startTimes, 0.95))}s, `
      + `playback p50/p95 ${seconds(percentile(playbackTimes, 0.5))}/${seconds(percentile(playbackTimes, 0.95))}s`;
  }
  return `${sample.kind} ${sample.language} / ${sample.voice}: ${summary}, failures=${matchingFailures.length}.`;
}

function recognitionTimingSummary(language) {
  const matchingSamples = recognitionSamples.filter((item) => item.language === language);
  const matchingFailures = recognitionFailures.filter((item) => item.language === language);
  let summary = "no final transcripts";
  if (matchingSamples.length) {
    const times = matchingSamples.map((item) => item.firstFinalMs);
    const seconds = (milliseconds) => (milliseconds / 1000).toFixed(2);
    summary = `n=${matchingSamples.length}, first-final p50/p95 `
      + `${seconds(percentile(times, 0.5))}/${seconds(percentile(times, 0.95))}s`;
  }
  return `STT ${language}: ${summary}, failures=${matchingFailures.length}.`;
}

function speechErrorMessage(error) {
  const messages = {
    "audio-busy": "Audio output is busy. Close another app using audio, then try again.",
    "language-unavailable": "No speech voice is available for this language. Choose another installed voice or read the answer above.",
    "not-allowed": "The browser blocked speech playback. Try the voice preview or read the answer above.",
    "synthesis-failed": "The browser could not synthesize this answer. Read it above or try another voice.",
    "synthesis-unavailable": "No speech engine is available in this browser. Read the answer above.",
    "text-too-long": "This answer is too long for the browser to speak in one pass. Read it above.",
    "voice-unavailable": "The selected voice is unavailable. Choose another installed voice or use Browser default.",
  };
  return messages[error] || `Speech playback failed (${error || "unknown error"}). Read the answer above.`;
}

function buildSpeechDiagnostics() {
  const ttsGroups = new Map();
  const getTtsGroup = (sample) => {
    const key = JSON.stringify([sample.language, sample.voice, sample.kind]);
    if (!ttsGroups.has(key)) {
      ttsGroups.set(key, {
        language: sample.language,
        voice: sample.voice,
        sample_type: sample.kind,
        start_event: sample.startEvent || "speech_synthesis_onstart",
        completed: [],
        failures: 0,
        failure_reasons: {},
      });
    }
    return ttsGroups.get(key);
  };
  speechSamples.forEach((sample) => getTtsGroup(sample).completed.push(sample));
  speechFailures.forEach((sample) => {
    const group = getTtsGroup(sample);
    group.failures += 1;
    group.failure_reasons[sample.reason] = (group.failure_reasons[sample.reason] || 0) + 1;
  });

  const sttGroups = new Map();
  const getSttGroup = (language) => {
    if (!sttGroups.has(language)) sttGroups.set(language, { language, completed: [], failures: 0, failure_reasons: {} });
    return sttGroups.get(language);
  };
  recognitionSamples.forEach((sample) => getSttGroup(sample.language).completed.push(sample));
  recognitionFailures.forEach((sample) => {
    const group = getSttGroup(sample.language);
    group.failures += 1;
    group.failure_reasons[sample.reason] = (group.failure_reasons[sample.reason] || 0) + 1;
  });

  const percentiles = (values) => values.length
    ? {
      p50_s: Number((percentile(values, 0.5) / 1000).toFixed(2)),
      p95_s: Number((percentile(values, 0.95) / 1000).toFixed(2)),
    }
    : { p50_s: null, p95_s: null };
  const tts = [...ttsGroups.values()]
    .sort((left, right) => `${left.language}|${left.sample_type}|${left.voice}`
      .localeCompare(`${right.language}|${right.sample_type}|${right.voice}`))
    .map((group) => ({
      language: group.language,
      voice: group.voice,
      sample_type: group.sample_type,
      start_event: group.start_event,
      completed_count: group.completed.length,
      failure_count: group.failures,
      failure_reasons: group.failure_reasons,
      start_delay: percentiles(group.completed.map((sample) => sample.startMs)),
      playback_duration: percentiles(group.completed.map((sample) => sample.playbackMs)),
    }));
  const stt = [...sttGroups.values()]
    .sort((left, right) => left.language.localeCompare(right.language))
    .map((group) => ({
      language: group.language,
      final_transcript_count: group.completed.length,
      failed_or_empty_count: group.failures,
      failure_reasons: group.failure_reasons,
      time_to_first_final: percentiles(group.completed.map((sample) => sample.firstFinalMs)),
    }));
  return {
    schema_version: 1,
    generated_at_utc: new Date().toISOString(),
    scope: "Current page only",
    privacy: "Timing, failure counts, and browser error categories only; no transcript text or audio.",
    tts,
    stt,
  };
}

copySpeechDiagnosticsButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(buildSpeechDiagnostics(), null, 2));
    statusLine.textContent = "Current-page speech diagnostics copied. They contain timings and counts only.";
  } catch {
    statusLine.textContent = "Clipboard access was unavailable. Use Download JSON or allow clipboard access and try again.";
  }
});

downloadSpeechDiagnosticsButton.addEventListener("click", () => {
  const diagnostics = buildSpeechDiagnostics();
  const payload = JSON.stringify(diagnostics, null, 2);
  const timestamp = diagnostics.generated_at_utc.replace(/[:.]/g, "-");
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `bolprep-speech-diagnostics-${timestamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  statusLine.textContent = "Current-page speech diagnostics downloaded as JSON. They contain timings and counts only.";
});

function splitSpeechText(text, maxCodePoints = 500) {
  const normalized = text.trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?\u0964\u0965\n]+[.!?\u0964\u0965]*/gu) || [normalized];
  const chunks = [];
  let current = "";
  const append = (part) => {
    const candidate = current ? `${current} ${part}` : part;
    if ([...candidate].length <= maxCodePoints) {
      current = candidate;
      return;
    }
    if (current) chunks.push(current);
    current = "";
    if ([...part].length <= maxCodePoints) {
      current = part;
      return;
    }
    const words = part.split(/\s+/u);
    for (const word of words) {
      if ([...word].length > maxCodePoints) {
        if (current) chunks.push(current);
        current = "";
        const characters = [...word];
        for (let index = 0; index < characters.length; index += maxCodePoints) {
          const fragment = characters.slice(index, index + maxCodePoints).join("");
          if (index + maxCodePoints < characters.length) chunks.push(fragment);
          else current = fragment;
        }
      } else if (current && [...current, ...word].length + 1 <= maxCodePoints) {
        current += ` ${word}`;
      } else {
        if (current) chunks.push(current);
        current = word;
      }
    }
  };

  for (const sentence of sentences) {
    const part = sentence.trim();
    if (part) append(part);
  }
  if (current) chunks.push(current);
  return chunks;
}

function speak(text, completionText = "Ready when you are.", kind = "tutor") {
  stopSpeechOutput();
  if (streamedTtsOption.checked && streamingTtsAvailable) {
    if (text.length > 4096) {
      statusLine.textContent = "This answer is too long for streamed speech; using the browser voice.";
      speakWithBrowser(text, completionText, kind);
      return;
    }
    void speakStreamed(text, completionText, kind, speechTurn);
    return;
  }
  speakWithBrowser(text, completionText, kind);
}

async function speakStreamed(text, completionText, kind, requestSpeechTurn) {
  const context = prepareStreamingAudio();
  if (!context) {
    statusLine.textContent = "This browser cannot play streamed audio here. Using the browser voice.";
    speakWithBrowser(text, completionText, kind);
    return;
  }
  const controller = new AbortController();
  activeSpeechController = controller;
  const voice = streamedTtsVoice.value;
  const sample = {
    language: speechLanguage.value,
    voice: `OpenAI ${voice}`,
    kind,
    startEvent: "first_pcm_buffer_scheduled",
  };
  const queuedAt = performance.now();
  let firstAudioAt = null;
  let nextStartAt = 0;
  let streamFinished = false;
  let resolvePlayback;
  const requestSources = new Set();
  const playbackDone = new Promise((resolve) => { resolvePlayback = resolve; });
  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: speechLanguage.value, voice }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Streamed speech is unavailable.");
    }
    if (!response.body) throw new Error("This browser cannot receive streamed audio.");
    await context.resume();
    const reader = response.body.getReader();
    let pending = new Uint8Array(0);
    let audioChunks = 0;
    const queuePcm = (bytes) => {
      if (requestSpeechTurn !== speechTurn || controller.signal.aborted) return;
      const sampleCount = Math.floor(bytes.byteLength / 2);
      if (!sampleCount) return;
      const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
      const samples = new Float32Array(sampleCount);
      for (let index = 0; index < sampleCount; index += 1) {
        samples[index] = view.getInt16(index * 2, true) / 32768;
      }
      const buffer = context.createBuffer(1, sampleCount, 24000);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(nextStartAt, context.currentTime + 0.025);
      if (firstAudioAt === null) {
        firstAudioAt = performance.now() + Math.max(0, startAt - context.currentTime) * 1000;
        statusLine.textContent = "Tutor is speaking with streamed audio. Tap Stop audio or Speak to interrupt.";
      }
      nextStartAt = startAt + buffer.duration;
      requestSources.add(source);
      scheduledSpeechSources.add(source);
      source.onended = () => {
        requestSources.delete(source);
        scheduledSpeechSources.delete(source);
        if (streamFinished && requestSources.size === 0) resolvePlayback();
      };
      source.start(startAt);
      audioChunks += 1;
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const combined = new Uint8Array(pending.length + value.length);
      combined.set(pending);
      combined.set(value, pending.length);
      const usableLength = combined.length - (combined.length % 2);
      if (usableLength) queuePcm(combined.subarray(0, usableLength));
      pending = combined.slice(usableLength);
    }
    if (pending.length) throw new Error("The speech stream ended on an incomplete audio sample.");
    if (!audioChunks) throw new Error("The speech provider returned no audio.");
    streamFinished = true;
    if (scheduledSpeechSources.size === 0) resolvePlayback();
    await playbackDone;
    if (requestSpeechTurn !== speechTurn) return;
    const endedAt = performance.now();
    const startDelay = ((firstAudioAt - queuedAt) / 1000).toFixed(2);
    const playbackDuration = ((endedAt - firstAudioAt) / 1000).toFixed(2);
    speechSamples.push({ ...sample, startMs: firstAudioAt - queuedAt, playbackMs: endedAt - firstAudioAt });
    if (speechSamples.length > 500) speechSamples.shift();
    statusLine.textContent = `${completionText} Stream start ${startDelay}s, playback ${playbackDuration}s. `
      + speechTimingSummary(sample);
  } catch (error) {
    if (error.name === "AbortError" || requestSpeechTurn !== speechTurn) return;
    requestSources.forEach((source) => {
      try { source.stop(); } catch { /* The source may already have ended. */ }
      scheduledSpeechSources.delete(source);
    });
    requestSources.clear();
    speechFailures.push({ ...sample, reason: "stream-failed" });
    if (speechFailures.length > 500) speechFailures.shift();
    if (firstAudioAt === null) {
      statusLine.textContent = `${error.message} Falling back to the browser voice.`;
      speakWithBrowser(text, completionText, kind);
    } else {
      statusLine.textContent = `${error.message} Streamed speech stopped.`;
    }
  } finally {
    if (activeSpeechController === controller) activeSpeechController = null;
  }
}

function speakWithBrowser(text, completionText = "Ready when you are.", kind = "tutor") {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    statusLine.textContent = "Speech playback is not available in this browser. Read the answer above.";
    return;
  }
  const requestSpeechTurn = ++speechTurn;
  window.speechSynthesis.cancel();
  const chunks = splitSpeechText(text);
  if (!chunks.length) {
    statusLine.textContent = completionText;
    return;
  }
  const queuedAt = performance.now();
  let startedAt = null;
  let failed = false;
  const selectedVoice = matchingSpeechVoices.find((voice) =>
    `${voice.name}|${voice.lang}|${voice.voiceURI}` === speechVoice.value
  );
  const sample = {
    language: speechLanguage.value,
    voice: selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : "browser default",
    kind,
    startEvent: "speech_synthesis_onstart",
  };
  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = speechLanguage.value;
    utterance.rate = 0.96;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => {
      if (requestSpeechTurn !== speechTurn || failed || startedAt !== null) return;
      startedAt = performance.now();
      const startDelay = ((startedAt - queuedAt) / 1000).toFixed(2);
      statusLine.textContent = `Tutor is speaking (started in ${startDelay}s). Tap Stop audio or Speak to interrupt.`;
    };
    utterance.onend = () => {
      if (requestSpeechTurn !== speechTurn || failed || index !== chunks.length - 1) return;
      if (startedAt === null) {
        statusLine.textContent = completionText;
        return;
      }
      const endedAt = performance.now();
      const startDelay = ((startedAt - queuedAt) / 1000).toFixed(2);
      const playbackDuration = ((endedAt - startedAt) / 1000).toFixed(2);
      speechSamples.push({
        ...sample,
        startMs: startedAt - queuedAt,
        playbackMs: endedAt - startedAt,
      });
      if (speechSamples.length > 500) speechSamples.shift();
      statusLine.textContent = `${completionText} This run: start ${startDelay}s, playback ${playbackDuration}s. `
        + speechTimingSummary(sample);
    };
    utterance.onerror = (event) => {
      if (requestSpeechTurn !== speechTurn || failed) return;
      failed = true;
      speechFailures.push({ ...sample, reason: event.error || "unknown" });
      if (speechFailures.length > 500) speechFailures.shift();
      statusLine.textContent = `${speechErrorMessage(event.error)} ${speechTimingSummary(sample)}`;
      window.speechSynthesis.cancel();
    };
    window.speechSynthesis.speak(utterance);
  });
}

previewVoiceButton.addEventListener("click", () => {
  const preview = speechLanguage.value === "en-IN"
    ? "Hello, let's study fundamental rights together."
    : "Namaste, aaj hum maulik adhikar seekhenge.";
  speak(preview, "Voice preview finished.", "preview");
});

async function sendQuestion(question) {
  prepareStreamingAudio();
  const requestTurn = ++turn;
  preserveInterruptedTurn();
  activeRequest?.abort();
  activeRequest = new AbortController();
  const controller = activeRequest;
  pendingQuestion = question;
  sendButton.disabled = true;
  statusLine.textContent = "Thinking…";
  addMessage("user", question);

  try {
    const response = await fetch("/api/agent/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: history.slice(-20), language: speechLanguage.value }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Tutor request failed.");
    if (requestTurn !== turn) return;
    addMessage("assistant", payload.answer, payload.sources || []);
    rememberTurn(question, payload.answer);
    pendingQuestion = null;
    statusLine.textContent = "Answer ready.";
    const startedQuiz = (payload.tool_events || []).find((event) => event.name === "start_quiz" && event.ok);
    const scoredAnswer = (payload.tool_events || []).find((event) => event.name === "score_answer" && event.ok);
    if (startedQuiz && startedQuiz.result.questions?.length) {
      quizSession = {
        quizId: startedQuiz.result.quiz_id,
        questions: startedQuiz.result.questions,
        index: 0,
        results: [],
        awaitingAnswer: false,
      };
      showQuizQuestion(false);
      speak(`${payload.answer} ${quizSession.questions[0].prompt}`, "Your answer is ready when you are.");
    } else if (scoredAnswer) {
      const score = scoredAnswer.result;
      addMessage("assistant", `${score.feedback} Score: ${score.score}%.`, [score.source]);
      speak(`${payload.answer} ${score.feedback}`, "Answer ready.");
      loadProgress();
    } else {
      speak(payload.answer);
    }
  } catch (error) {
    if (error.name !== "AbortError" && requestTurn === turn) {
      pendingQuestion = null;
      addMessage("assistant", error.message);
      rememberTurn(question, "The tutor request failed before an answer was produced.");
      statusLine.textContent = "Request failed. Your conversation is still open.";
    }
  } finally {
    if (requestTurn === turn) {
      sendButton.disabled = false;
      activeRequest = null;
    }
  }
}

async function startQuiz() {
  stopTutor();
  prepareStreamingAudio();
  const requestTurn = turn;
  const controller = new AbortController();
  activeRequest = controller;
  quizButton.disabled = true;
  nextQuestionButton.hidden = true;
  statusLine.textContent = "Preparing a three-question Fundamental Rights quiz…";
  try {
    const response = await fetch("/api/quiz/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "fundamental rights", question_count: 3, language: speechLanguage.value }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not start the quiz.");
    if (requestTurn !== turn) return;
    quizSession = { quizId: payload.quiz_id, questions: payload.questions, index: 0, results: [], awaitingAnswer: false };
    showQuizQuestion();
  } catch (error) {
    if (requestTurn === turn) {
      addMessage("assistant", error.message);
      statusLine.textContent = "Quiz could not start. Your conversation is still open.";
    }
  } finally {
    quizButton.disabled = false;
    if (activeRequest === controller) activeRequest = null;
  }
}

function showQuizQuestion(speakPrompt = true) {
  if (!quizSession || quizSession.index >= quizSession.questions.length) return;
  const current = quizSession.questions[quizSession.index];
  quizSession.awaitingAnswer = true;
  nextQuestionButton.hidden = true;
  sendLabel.textContent = "Submit answer";
  inputLabel.textContent = "Your quiz answer";
  input.maxLength = 1000;
  input.placeholder = "Speak or type your answer…";
  addMessage("assistant", `Question ${quizSession.index + 1} of ${quizSession.questions.length}: ${current.prompt}`, [current.source]);
  const readyText = "Your answer is ready when you are.";
  statusLine.textContent = readyText;
  if (speakPrompt) speak(current.prompt, readyText);
}

async function submitQuizAnswer(answer) {
  prepareStreamingAudio();
  if (!quizSession || !quizSession.awaitingAnswer) return;
  const current = quizSession.questions[quizSession.index];
  current.idempotencyKey ||= window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  quizSession.awaitingAnswer = false;
  quizSession.pendingAnswer = answer;
  const requestTurn = ++turn;
  activeRequest = new AbortController();
  const controller = activeRequest;
  sendButton.disabled = true;
  micButton.disabled = true;
  statusLine.textContent = "Checking your answer against the rubric…";
  addMessage("user", answer);
  try {
    const response = await fetch("/api/quiz/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizSession.quizId, question_id: current.id, idempotency_key: current.idempotencyKey, answer, language: speechLanguage.value }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not score the answer.");
    if (requestTurn !== turn) return;
    quizSession.pendingAnswer = "";
    quizSession.results.push(result);
    loadProgress();
    const feedback = `${result.feedback} Score: ${result.score}%.`;
    addMessage("assistant", feedback, [result.source]);
    quizSession.index += 1;
    const isLast = quizSession.index >= quizSession.questions.length;
    const completeCount = quizSession.results.filter((item) => item.complete).length;
    if (isLast) {
      const totalQuestions = quizSession.questions.length;
      quizSession = null;
      sendLabel.textContent = "Ask tutor";
      inputLabel.textContent = "Your question";
      input.placeholder = "Type a question… e.g. Right to Equality kya hai?";
      statusLine.textContent = `Quiz complete: ${completeCount} of ${totalQuestions} answers covered the rubric. Results are saved for this browser.`;
      speak(feedback, statusLine.textContent);
    } else {
      statusLine.textContent = `Answer checked. ${quizSession.index} of ${quizSession.questions.length} complete; tap Next question when ready.`;
      nextQuestionButton.hidden = false;
      speak(feedback, statusLine.textContent);
    }
  } catch (error) {
    if (requestTurn === turn) {
      quizSession.awaitingAnswer = true;
      quizSession.pendingAnswer = "";
      input.value = answer;
      addMessage("assistant", error.message);
      statusLine.textContent = "Scoring failed. You can try submitting the answer again.";
      input.focus();
    }
  } finally {
    if (requestTurn === turn) {
      sendButton.disabled = false;
      micButton.disabled = !recognitionAvailable;
      activeRequest = null;
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || sendButton.disabled) return;
  if (question.length > input.maxLength) {
    const responseName = quizSession ? "answer" : "question";
    statusLine.textContent = `This ${responseName} is over the ${input.maxLength}-character limit. Edit it before sending.`;
    return;
  }
  if (quizSession) {
    if (!quizSession.awaitingAnswer) {
      statusLine.textContent = "Tap Next question to continue the quiz, or start a new session.";
      return;
    }
    input.value = "";
    stopTutor();
    submitQuizAnswer(question);
    return;
  }
  stopTutor();
  input.value = "";
  sendQuestion(question);
});

stopButton.addEventListener("click", () => {
  const stoppingQuizScore = Boolean(quizSession && !quizSession.awaitingAnswer);
  stopTutor();
  sendButton.disabled = false;
  statusLine.textContent = stoppingQuizScore
    ? "Quiz scoring stopped. Your answer is ready to retry."
    : "Tutor turn stopped. You can continue the conversation.";
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const speechSynthesis = window.speechSynthesis;
  if (!activeRequest && !activeSpeechController && !scheduledSpeechSources.size
    && !recognitionListening && !activeMediaRecorder && !serverRecordingStarting
    && !activeTranscriptionController && !speechSynthesis?.speaking && !speechSynthesis?.pending) return;
  event.preventDefault();
  const stoppingQuizScore = Boolean(quizSession && !quizSession.awaitingAnswer);
  stopTutor();
  statusLine.textContent = stoppingQuizScore
    ? "Quiz scoring stopped. Your answer is ready to retry."
    : "Tutor turn stopped. You can continue the conversation.";
});

document.querySelector("#clear-button").addEventListener("click", () => {
  stopTutor();
  quizSession = null;
  history.length = 0;
  input.value = "";
  conversation.replaceChildren();
  addMessage("assistant", "Namaste! Fundamental Rights ke baare mein kya jaan-na hai?");
  nextQuestionButton.hidden = true;
  sendLabel.textContent = "Ask tutor";
  inputLabel.textContent = "Your question";
  input.maxLength = 1200;
  input.placeholder = "Type a question… e.g. Right to Equality kya hai?";
  statusLine.textContent = "New session started.";
  input.focus();
});

quizButton.addEventListener("click", startQuiz);
nextQuestionButton.addEventListener("click", showQuizQuestion);

async function loadProgress() {
  const requestId = ++progressRequestId;
  weakTopics.replaceChildren();
  progressSummary.textContent = "Loading saved results…";
  try {
    const response = await fetch("/api/progress");
    if (requestId !== progressRequestId) return;
    const progress = await response.json();
    if (requestId !== progressRequestId) return;
    if (!response.ok) throw new Error(progress.error || "Could not load saved results.");
    if (!progress.attempt_count) {
      progressSummary.textContent = "No saved quiz answers yet. Complete a quiz to build your revision list.";
      return;
    }
    progressSummary.textContent = `${progress.attempt_count} saved answer${progress.attempt_count === 1 ? "" : "s"} · ${progress.average_score}% average score`;
    for (const topic of progress.weak_topics) {
      const item = document.createElement("li");
      item.textContent = `${topic.topic}: ${topic.latest_score}% on the latest try (${topic.attempts} attempt${topic.attempts === 1 ? "" : "s"})`;
      weakTopics.append(item);
    }
    if (!progress.weak_topics.length) {
      const item = document.createElement("li");
      item.textContent = "No recent weak areas. Keep practising to build a longer history.";
      weakTopics.append(item);
    }
  } catch {
    if (requestId !== progressRequestId) return;
    weakTopics.replaceChildren();
    progressSummary.textContent = "Saved progress could not load. Check that the local server is running.";
  }
}

progressRefreshButton.addEventListener("click", loadProgress);
clearProgressButton.addEventListener("click", async () => {
  if (!window.confirm("Delete saved quiz scores for this browser?")) return;
  ++progressRequestId;
  weakTopics.replaceChildren();
  progressSummary.textContent = "Clearing saved results…";
  progressRefreshButton.disabled = true;
  clearProgressButton.disabled = true;
  try {
    const response = await fetch("/api/progress", { method: "DELETE" });
    if (!response.ok) throw new Error("Could not clear saved results.");
    await loadProgress();
    statusLine.textContent = "Saved quiz progress cleared.";
  } catch (error) {
    statusLine.textContent = error.message;
    await loadProgress();
  } finally {
    progressRefreshButton.disabled = false;
    clearProgressButton.disabled = false;
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
speechLanguage.addEventListener("change", () => {
  refreshSpeechVoices();
  const speechSynthesis = window.speechSynthesis;
  if (activeSpeechController || scheduledSpeechSources.size || speechSynthesis?.speaking || speechSynthesis?.pending) {
    stopSpeechOutput();
    statusLine.textContent = "Speech language changed. Current playback stopped; the new language applies next time.";
  }
});
streamedTtsOption.addEventListener("change", () => {
  if (activeSpeechController || scheduledSpeechSources.size) stopSpeechOutput();
  if (streamedTtsOption.checked && !prepareStreamingAudio()) {
    streamedTtsOption.checked = false;
    statusLine.textContent = "This browser cannot play streamed audio. Use the installed browser voice instead.";
  }
  streamedTtsVoice.disabled = !streamingTtsAvailable || !streamedTtsOption.checked;
});
streamedTtsVoice.addEventListener("change", () => {
  if (activeSpeechController || scheduledSpeechSources.size) {
    stopSpeechOutput();
    statusLine.textContent = "Streamed voice changed. The new voice applies to the next playback.";
  }
  saveSpeechPreferences();
});
speechLanguage.addEventListener("change", saveSpeechPreferences);
speechVoice.addEventListener("change", saveSpeechPreferences);
window.speechSynthesis?.addEventListener?.("voiceschanged", refreshSpeechVoices);
refreshSpeechVoices();

if (SpeechRecognition) {
  recognitionAvailable = true;
  recognition = null;
  speechLanguage.addEventListener("change", () => {
    if (recognitionListening) {
      stopRecognition();
      statusLine.textContent = "Speech language changed. Tap Speak to start a new transcript.";
    }
  });
}

updateMicrophoneButton(false);
micButton.addEventListener("click", () => {
  if (!recognitionAvailable) return;
  if (recognitionListening) {
    stopRecognition();
    statusLine.textContent = "Listening stopped. You can type or tap Speak again.";
    return;
  }
  stopTutor();
  window.speechSynthesis?.cancel();
  const run = ++recognitionRun;
  const capture = new SpeechRecognition();
  recognition = capture;
  capture.lang = speechLanguage.value;
  capture.interimResults = true;
  capture.continuous = false;
  capture.onstart = () => {
    if (run !== recognitionRun || !recognitionListening) {
      capture.abort();
      return;
    }
    updateMicrophoneButton(true);
    recognitionStartedAt = performance.now();
    recognitionHadFinalResult = false;
    recognitionLastError = null;
    statusLine.textContent = "Listening… speak now.";
  };
  capture.onresult = (event) => {
    if (run !== recognitionRun || !recognitionListening) return;
    let transcript = "";
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal && event.results[i][0].transcript.trim()
        && !recognitionHadFinalResult && recognitionStartedAt !== null) {
        recognitionHadFinalResult = true;
        const elapsedMs = performance.now() - recognitionStartedAt;
        recognitionSamples.push({ language: capture.lang, firstFinalMs: elapsedMs });
        if (recognitionSamples.length > 500) recognitionSamples.shift();
        const elapsed = (elapsedMs / 1000).toFixed(2);
        statusLine.textContent = `Final transcript received in ${elapsed}s. Review it, then ask. `
          + recognitionTimingSummary(capture.lang);
      }
    }
    input.value = transcript.trim();
  };
  capture.onerror = (event) => {
    if (run === recognitionRun && recognitionListening) {
      recognitionLastError = event.error;
      statusLine.textContent = recognitionErrorMessage(event.error);
    }
  };
  capture.onend = () => {
    if (run !== recognitionRun) return;
    const wasListening = recognitionListening;
    recognitionListening = false;
    updateMicrophoneButton(false);
    if (wasListening && !recognitionHadFinalResult) {
      const language = capture.lang;
      recognitionFailures.push({ language, reason: recognitionLastError || "no-final-transcript" });
      if (recognitionFailures.length > 500) recognitionFailures.shift();
      const reason = recognitionLastError
        ? recognitionErrorMessage(recognitionLastError)
        : "No final transcript was received.";
      statusLine.textContent = `${reason} ${recognitionTimingSummary(language)}`;
    }
  };
  recognitionListening = true;
  updateMicrophoneButton(false, true);
  try {
    capture.start();
  } catch {
    recognitionListening = false;
    recognitionRun += 1;
    updateMicrophoneButton(false);
    statusLine.textContent = "Microphone is already starting. Please wait a moment.";
  }
});

serverTranscribeButton.addEventListener("click", () => {
  if (activeMediaRecorder?.state === "recording") {
    stopServerRecording(false);
    return;
  }
  void startServerRecording();
});

fetch("/health").then((response) => response.json()).then((health) => {
  const mode = health.mode === "model" ? "Model answers enabled" : "Offline practice mode";
  streamingTtsAvailable = Boolean(health.streaming_tts);
  streamedTtsOption.disabled = !streamingTtsAvailable;
  streamedTtsVoice.disabled = !streamingTtsAvailable || !streamedTtsOption.checked;
  serverTranscriptionAvailable = Boolean(health.server_transcription);
  serverSttNote.hidden = !serverTranscriptionAvailable;
  updateServerTranscribeButton();
  streamedTtsOption.title = streamingTtsAvailable
    ? "Streams generated speech from the server. API usage may be billed."
    : "Add an API key to the local server configuration to enable streamed speech.";
  modeLabel.textContent = `${mode} · history stays in this tab`;
  if (!recognitionAvailable) {
    statusLine.textContent = serverTranscriptionAvailable
      ? "Ready to type or record a question for server transcription."
      : "Ready to type. Speech recognition is not available in this browser.";
  }
}).catch(() => {
  modeLabel.textContent = "Start the local server to connect";
});
loadProgress();
