const form = document.querySelector("#question-form");
const apiFetch = window.BolPrepFetch;
const logoutButton = document.querySelector("#logout-button");
const input = document.querySelector("#question-input");
const conversation = document.querySelector("#conversation");
const statusLine = document.querySelector("#status");
const sendButton = document.querySelector("#send-button");
const micButton = document.querySelector("#mic-button");
const serverTranscribeButton = document.querySelector("#server-transcribe-button");
const serverSttNote = document.querySelector("#server-stt-note");
const liveSttButton = document.querySelector("#live-stt-button");
const liveSttNote = document.querySelector("#live-stt-note");
const liveAutoFinish = document.querySelector("#live-auto-finish");
const liveQuietPause = document.querySelector("#live-quiet-pause");
const liveConversation = document.querySelector("#live-conversation");
const stopButton = document.querySelector("#stop-button");
const modeLabel = document.querySelector("#mode-label");
const speechLanguage = document.querySelector("#speech-language");
const autoSubmitSpeech = document.querySelector("#auto-submit-speech");
const speechVoice = document.querySelector("#speech-voice");
const speechRateControl = document.querySelector("#speech-rate");
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
if (speechRateControl.options.some((option) => Number(option.value) === speechPreferences.browserSpeechRate)) {
  speechRateControl.value = String(speechPreferences.browserSpeechRate);
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
let activePartialMessage = null;
let recognition = null;
let recognitionAvailable = false;
let recognitionListening = false;
let recognitionRun = 0;
let serverTranscriptionAvailable = false;
let liveTranscriptionAvailable = false;
let activeLiveTranscription = null;
let liveSttRun = 0;
let liveSttOriginalInput = "";
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
let recognitionOriginalInput = "";
let pendingQuestion = null;
let matchingSpeechVoices = [];
let streamingTtsAvailable = false;
let modelModeAvailable = false;
let modelName = "unknown";
let activeSpeechController = null;
let speechAudioContext = null;
const scheduledSpeechSources = new Set();
const speechSamples = [];
const speechFailures = [];
const automaticVoiceTurnSamples = [];
const modelStreamSamples = [];
const modelStreamFailures = [];
const tutorTurnTraces = [];
const recognitionSamples = [];
const recognitionFailures = [];
const recordedTranscriptionSamples = [];
const recordedTranscriptionFailures = [];
const liveTranscriptionAttempts = [];
let turn = 0;
let pendingAutomaticVoiceInput = null;
let activeAutomaticVoiceTurn = null;
let speechTurn = 0;
let activeProgressiveSpeech = null;
let progressRequestId = 0;
let quizSession = null;

function speechLanguageLabel(language) {
  return language === "hi-IN" ? "Hindi/Hinglish" : "English";
}

function updateMicrophoneButton(listening, disabled = false) {
  const label = listening ? "Stop" : "Speak";
  const unavailable = !recognitionAvailable;
  const actionLabel = unavailable
    ? "Voice input is unavailable in this browser. You can type your question."
    : listening ? "Stop voice input" : "Start voice input; interrupts tutor audio or a turn if active";
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
  return article;
}

async function readAgentStream(response, onTextDelta, onSpeechMode) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Tutor request failed.");
  }
  if (!response.body) throw new Error("This browser cannot receive the tutor response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let payload = null;
  function consumeLine(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "delta" && typeof event.text === "string") onTextDelta(event.text);
    else if (event.type === "speech_mode" && typeof event.progressive === "boolean") onSpeechMode?.(event.progressive);
    else if (event.type === "complete") payload = event.payload;
    else if (event.type === "error") {
      const error = new Error(event.error || "Tutor request failed.");
      error.trace = event.trace;
      throw error;
    }
  }
  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop();
    lines.forEach(consumeLine);
    if (done) break;
  }
  if (pending.trim()) consumeLine(pending);
  if (!payload || typeof payload.answer !== "string") throw new Error("The tutor response stream ended early. Try again.");
  return payload;
}

function rememberTurn(userMessage, assistantMessage) {
  history.push(
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  );
  history.splice(0, Math.max(0, history.length - 20));
}

function updateLiveSttButton(state = "idle") {
  liveSttButton.hidden = !liveTranscriptionAvailable;
  liveSttButton.disabled = !liveTranscriptionAvailable;
  liveAutoFinish.disabled = !liveTranscriptionAvailable || state !== "idle" || liveConversation.checked;
  liveQuietPause.disabled = !liveTranscriptionAvailable || state !== "idle";
  liveConversation.disabled = !liveTranscriptionAvailable || state !== "idle";
  const listening = state === "listening";
  const label = listening ? "Done" : state === "idle" ? "Live mic" : "Cancel";
  liveSttButton.querySelector(".button-label").textContent = label;
  liveSttButton.setAttribute("aria-label", listening ? "Finish live transcription" : label);
  liveSttButton.setAttribute("aria-pressed", String(listening));
  liveSttButton.classList.toggle("is-listening", listening);
}

function stopLiveTranscription(restoreUnconfirmed = true) {
  if (!activeLiveTranscription) return;
  if (restoreUnconfirmed) input.value = liveSttOriginalInput;
  liveSttRun += 1;
  const capture = activeLiveTranscription;
  activeLiveTranscription = null;
  capture.cancel();
  updateLiveSttButton();
}

function stopRecognition(restoreUnconfirmed = false, preserveLive = false) {
  if (!preserveLive) stopLiveTranscription(restoreUnconfirmed);
  if (restoreUnconfirmed && recognitionListening && !recognitionHadFinalResult) {
    input.value = recognitionOriginalInput;
  }
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
  const cancelable = state === "starting" || state === "transcribing";
  serverTranscribeButton.disabled = !serverTranscriptionAvailable || state === "busy";
  serverTranscribeButton.querySelector(".button-label").textContent = recording ? "Stop" : cancelable ? "Cancel" : "Record";
  const label = recording
    ? "Stop recording and transcribe the question"
    : cancelable ? "Cancel recording or transcription"
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

function recordingCaptureFailure(error) {
  const failures = {
    NotAllowedError: ["permission-denied", "Microphone access was denied or blocked. Allow it in browser settings, or type your question."],
    SecurityError: ["microphone-blocked", "This browser page is not allowed to use the microphone. Open the local tutor page directly, or type your question."],
    NotFoundError: ["no-microphone", "No microphone was found. Connect one and try again, or type your question."],
    NotReadableError: ["microphone-unavailable", "The microphone could not be opened. Close other apps using it and try again, or type your question."],
    OverconstrainedError: ["microphone-unsupported", "The browser could not start a supported microphone input. Try browser speech input or type your question."],
  };
  return failures[error?.name] || ["capture-failed", "Microphone capture could not start. Try again or type your question."];
}

async function startServerRecording() {
  if (!serverTranscriptionAvailable || activeMediaRecorder || activeTranscriptionController) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function") {
    statusLine.textContent = "This browser cannot record audio. Use browser speech input or type your question.";
    return;
  }
  const recordingLanguage = speechLanguage.value;
  stopTutor();
  serverRecordingStartCancelled = false;
  serverRecordingStarting = true;
  const recordingRun = ++serverRecordingRun;
  updateServerTranscribeButton("starting");
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
      const unexpected = recordingRun === serverRecordingRun && !discardServerRecording;
      if (unexpected) {
        recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "recording-failed" });
        if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
      }
      if (activeMediaRecorder === recorder) stopServerRecording(true);
      if (unexpected) statusLine.textContent = "Recording failed. Try again or type your question.";
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
        recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "empty-recording" });
        if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
        statusLine.textContent = "No audio was recorded. Try again or type your question.";
        return;
      }
      void transcribeRecordedAudio(audio, recordingLanguage);
    };
    recorder.start();
    updateServerTranscribeButton("recording");
    statusLine.textContent = `Recording in ${speechLanguageLabel(recordingLanguage)}. Tap Stop or speak for up to 20 seconds.`;
    serverRecordingTimer = window.setTimeout(() => {
      statusLine.textContent = "20-second recording limit reached. Transcribing your question.";
      stopServerRecording(false);
    }, 20_000);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    if (recordingRun !== serverRecordingRun || serverRecordingStartCancelled) return;
    const [reason, message] = recordingCaptureFailure(error);
    recordedTranscriptionFailures.push({ language: recordingLanguage, reason });
    if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
    activeMediaRecorder = null;
    activeMediaStream = null;
    updateServerTranscribeButton();
    statusLine.textContent = message;
  } finally {
    if (recordingRun === serverRecordingRun) serverRecordingStarting = false;
  }
}

async function transcribeRecordedAudio(audio, language) {
  const startedAt = performance.now();
  const controller = new AbortController();
  let timedOut = false;
  activeTranscriptionController = controller;
  updateServerTranscribeButton("transcribing");
  statusLine.textContent = `Transcribing in ${speechLanguageLabel(language)}. Review the text before asking.`;
  const timeoutId = window.setTimeout(() => {
    if (activeTranscriptionController !== controller) return;
    timedOut = true;
    controller.abort();
  }, 90_000);
  try {
    const response = await apiFetch("/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": audio.type.split(";", 1)[0] || "audio/webm",
        "X-Speech-Language": language,
      },
      body: audio,
      signal: controller.signal,
    });
    const payload = await response.json();
    if (timedOut) throw new Error("Transcription timed out after 90 seconds.");
    if (!response.ok) throw new Error(payload.error || "Transcription failed.");
    if (activeTranscriptionController !== controller) return;
    if (typeof payload.transcript !== "string" || !payload.transcript.trim()) {
      throw new Error("The transcription provider returned an empty transcript.");
    }
    input.value = payload.transcript.trim();
    input.focus();
    recordedTranscriptionSamples.push({ language, elapsedMs: performance.now() - startedAt });
    if (recordedTranscriptionSamples.length > 500) recordedTranscriptionSamples.shift();
    statusLine.textContent = `Transcript ready. Review it, then ask. ${recordedTranscriptionTimingSummary(language)}`;
  } catch (error) {
    if ((error.name !== "AbortError" || timedOut) && activeTranscriptionController === controller) {
      recordedTranscriptionFailures.push({ language, reason: timedOut ? "transcription-timeout" : "transcription-failed" });
      if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
      const message = timedOut ? "Transcription timed out after 90 seconds." : error.message;
      statusLine.textContent = `${message} You can record again or type your question. ${recordedTranscriptionTimingSummary(language)}`;
    }
  } finally {
    window.clearTimeout(timeoutId);
    if (activeTranscriptionController === controller) {
      activeTranscriptionController = null;
      updateServerTranscribeButton();
    }
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
  activePartialMessage?.remove();
  activePartialMessage = null;
  const interruptionNote = "I stopped before finishing that answer. You can ask a follow-up or try again.";
  addMessage("assistant", interruptionNote);
  rememberTurn(pendingQuestion, interruptionNote);
  pendingQuestion = null;
}

function stopSpeechOutput() {
  speechTurn += 1;
  activeProgressiveSpeech?.cancel();
  activeProgressiveSpeech = null;
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

function stopTutor({ preserveLive = false } = {}) {
  stopSpeechOutput();
  activeAutomaticVoiceTurn = null;
  preserveInterruptedTurn();
  activeRequest?.abort();
  activeRequest = null;
  if (quizSession?.pendingAnswer && !quizSession.awaitingAnswer) {
    quizSession.awaitingAnswer = true;
    if (!input.value.trim()) input.value = quizSession.pendingAnswer;
    quizSession.pendingAnswer = "";
  }
  if (quizSession && !quizSession.awaitingAnswer) nextQuestionButton.hidden = false;
  stopRecognition(true, preserveLive);
  serverRecordingStartCancelled = true;
  serverRecordingRun += 1;
  serverRecordingStarting = false;
  updateServerTranscribeButton();
  if (activeMediaRecorder) stopServerRecording(true);
  const transcriptionController = activeTranscriptionController;
  activeTranscriptionController = null;
  transcriptionController?.abort();
  turn += 1;
  sendButton.disabled = false;
  quizButton.disabled = false;
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
    browserSpeechRate: Number(speechRateControl.value),
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
      && (item.rate ?? null) === (sample.rate ?? null)
  );
  const matchingFailures = speechFailures.filter((item) =>
    item.language === sample.language && item.voice === sample.voice && item.kind === sample.kind
      && (item.rate ?? null) === (sample.rate ?? null)
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
  const rateLabel = typeof sample.rate === "number" ? ` / rate ${sample.rate}x` : "";
  return `${sample.kind} ${sample.language} / ${sample.voice}${rateLabel}: ${summary}, failures=${matchingFailures.length}.`;
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

function recordAutomaticVoiceTurnStart(sample, startedAt) {
  if (!activeAutomaticVoiceTurn) return;
  if (sample.kind !== "tutor" && sample.kind !== "tutor-segment") {
    activeAutomaticVoiceTurn = null;
    return;
  }
  if (activeAutomaticVoiceTurn.requestTurn !== turn) {
    activeAutomaticVoiceTurn = null;
    return;
  }
  automaticVoiceTurnSamples.push({
    inputLanguage: activeAutomaticVoiceTurn.language,
    outputLanguage: sample.language,
    startEvent: sample.startEvent,
    startMs: Math.max(0, startedAt - activeAutomaticVoiceTurn.recognitionEndedAt),
  });
  if (automaticVoiceTurnSamples.length > 500) automaticVoiceTurnSamples.shift();
  activeAutomaticVoiceTurn = null;
}

function recordedTranscriptionTimingSummary(language) {
  const samples = recordedTranscriptionSamples.filter((item) => item.language === language);
  const failures = recordedTranscriptionFailures.filter((item) => item.language === language);
  if (!samples.length) return `Recorded STT ${language}: no completed transcripts, failures=${failures.length}.`;
  const times = samples.map((item) => item.elapsedMs);
  const seconds = (milliseconds) => (milliseconds / 1000).toFixed(2);
  return `Recorded STT ${language}: n=${samples.length}, upload-to-result p50/p95 `
    + `${seconds(percentile(times, 0.5))}/${seconds(percentile(times, 0.95))}s, failures=${failures.length}.`;
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
    const browserRate = sample.rate ?? null;
    const key = JSON.stringify([sample.language, sample.voice, sample.kind, browserRate]);
    if (!ttsGroups.has(key)) {
      ttsGroups.set(key, {
        language: sample.language,
        voice: sample.voice,
        sample_type: sample.kind,
        browser_rate: browserRate,
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
    .sort((left, right) => `${left.language}|${left.sample_type}|${left.voice}|${left.browser_rate}`
      .localeCompare(`${right.language}|${right.sample_type}|${right.voice}|${right.browser_rate}`))
    .map((group) => ({
      language: group.language,
      voice: group.voice,
      sample_type: group.sample_type,
      browser_rate: group.browser_rate,
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
  const recordedSttGroups = new Map();
  const getRecordedSttGroup = (language) => {
    if (!recordedSttGroups.has(language)) {
      recordedSttGroups.set(language, { language, completed: [], failures: 0, failure_reasons: {} });
    }
    return recordedSttGroups.get(language);
  };
  recordedTranscriptionSamples.forEach((sample) => getRecordedSttGroup(sample.language).completed.push(sample));
  recordedTranscriptionFailures.forEach((sample) => {
    const group = getRecordedSttGroup(sample.language);
    group.failures += 1;
    group.failure_reasons[sample.reason] = (group.failure_reasons[sample.reason] || 0) + 1;
  });
  const recordedStt = [...recordedSttGroups.values()]
    .sort((left, right) => left.language.localeCompare(right.language))
    .map((group) => ({
      language: group.language,
      completed_count: group.completed.length,
      failure_count: group.failures,
      failure_reasons: group.failure_reasons,
      upload_to_result: percentiles(group.completed.map((sample) => sample.elapsedMs)),
    }));
  const liveSttGroups = new Map();
  liveTranscriptionAttempts.forEach((attempt) => {
    const key = JSON.stringify([attempt.language, attempt.model, attempt.auto_finish_requested, attempt.pause_detection_used, attempt.continuous, attempt.connection_reused, attempt.quiet_pause_ms]);
    if (!liveSttGroups.has(key)) {
      liveSttGroups.set(key, {
        language: attempt.language,
        model: attempt.model,
        auto_finish_requested: attempt.auto_finish_requested,
        quiet_pause_ms: attempt.quiet_pause_ms,
        pause_detection_used: attempt.pause_detection_used,
        continuous: attempt.continuous,
        connection_reused: attempt.connection_reused,
        attempts: [],
      });
    }
    liveSttGroups.get(key).attempts.push(attempt);
  });
  const reasonCounts = (attempts, field) => {
    const counts = {};
    attempts.forEach((attempt) => {
      if (attempt[field]) counts[attempt[field]] = (counts[attempt[field]] || 0) + 1;
    });
    return counts;
  };
  const liveStt = [...liveSttGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => {
      const completed = group.attempts.filter((attempt) => attempt.outcome === "completed");
      const timing = (field) => {
        const values = completed.map((attempt) => attempt[field]).filter(Number.isFinite);
        return { sample_count: values.length, ...percentiles(values) };
      };
      return {
        language: group.language,
        model: group.model,
        auto_finish_requested: group.auto_finish_requested,
        pause_detection_used: group.pause_detection_used,
        continuous: group.continuous,
        connection_reused: group.connection_reused,
        configuration: { transcription_delay: "low", capture_limit_s: 20, quiet_pause_s: group.quiet_pause_ms / 1000,
          idle_limit_s: group.continuous ? 60 : null, session_limit_s: group.continuous ? 300 : null,
          activity_rms_threshold: 0.015, activity_minimum_ms: 250, quiet_rms_threshold: 0.008 },
        attempt_count: group.attempts.length,
        completed_count: completed.length,
        failure_count: group.attempts.filter((attempt) => attempt.outcome === "failed").length,
        cancellation_count: group.attempts.filter((attempt) => attempt.outcome === "cancelled").length,
        failure_reasons: reasonCounts(group.attempts, "failure_reason"),
        finish_reasons: reasonCounts(group.attempts, "finish_reason"),
        pause_detection_fallback_reasons: reasonCounts(group.attempts, "pause_detection_fallback_reason"),
        timing_scope: "Completed attempts only; software events, not acoustic speech-end latency",
        connection: timing("connection_ms"),
        listening_to_first_partial: timing("listening_to_first_partial_ms"),
        listening_duration: timing("listening_duration_ms"),
        commit_to_final: timing("commit_to_final_ms"),
        total_duration: timing("total_duration_ms"),
      };
    });
  const modelStreamGroups = new Map();
  const getModelStreamGroup = (language, configuredModel) => {
    const key = JSON.stringify([language, configuredModel]);
    if (!modelStreamGroups.has(key)) {
      modelStreamGroups.set(key, { language, model: configuredModel, completed: [], failures: 0, cancellations: 0 });
    }
    return modelStreamGroups.get(key);
  };
  modelStreamSamples.forEach((sample) => getModelStreamGroup(sample.language, sample.model).completed.push(sample));
  modelStreamFailures.forEach((sample) => {
    const group = getModelStreamGroup(sample.language, sample.model);
    if (sample.reason === "cancelled") group.cancellations += 1;
    else group.failures += 1;
  });
  const modelStreams = [...modelStreamGroups.values()]
    .sort((left, right) => `${left.language}|${left.model}`.localeCompare(`${right.language}|${right.model}`))
    .map((group) => ({
      language: group.language,
      model: group.model,
      completed_count: group.completed.length,
      failure_count: group.failures,
      cancellation_count: group.cancellations,
      time_to_first_text: percentiles(group.completed
        .filter((sample) => sample.firstTextMs !== null)
        .map((sample) => sample.firstTextMs)),
      total_response_duration: percentiles(group.completed.map((sample) => sample.totalMs)),
    }));
  const automaticVoiceGroups = new Map();
  automaticVoiceTurnSamples.forEach((sample) => {
    const key = JSON.stringify([sample.inputLanguage, sample.outputLanguage, sample.startEvent]);
    if (!automaticVoiceGroups.has(key)) {
      automaticVoiceGroups.set(key, {
        input_language: sample.inputLanguage,
        output_language: sample.outputLanguage,
        start_event: sample.startEvent,
        samples: [],
      });
    }
    automaticVoiceGroups.get(key).samples.push(sample.startMs);
  });
  const automaticVoiceTurns = [...automaticVoiceGroups.values()]
    .sort((left, right) => `${left.input_language}|${left.output_language}|${left.start_event}`
      .localeCompare(`${right.input_language}|${right.output_language}|${right.start_event}`))
    .map((group) => ({
      input_language: group.input_language,
      output_language: group.output_language,
      start_event: group.start_event,
      sample_count: group.samples.length,
      recognition_end_to_start: percentiles(group.samples),
    }));
  return {
    schema_version: 9,
    generated_at_utc: new Date().toISOString(),
    scope: "Current page only",
    privacy: "Diagnostics metadata only; no learner text, audio, cookies, or credentials.",
    tts,
    stt,
    recorded_stt: recordedStt,
    live_stt: liveStt,
    live_stt_attempts: liveTranscriptionAttempts.slice(),
    model_streams: modelStreams,
    automatic_voice_turns: automaticVoiceTurns,
    tutor_turns: tutorTurnTraces.slice(),
  };
}

copySpeechDiagnosticsButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(buildSpeechDiagnostics(), null, 2));
    statusLine.textContent = "Current-page diagnostics copied. They contain no transcript text or audio.";
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
  statusLine.textContent = "Current-page diagnostics downloaded. They contain no transcript text or audio.";
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

async function speakStreamed(text, completionText, kind, requestSpeechTurn, options = {}) {
  const { language = speechLanguage.value, voice = streamedTtsVoice.value,
    allowFallback = true, onStart = null } = options;
  const context = prepareStreamingAudio();
  if (!context) {
    statusLine.textContent = "This browser cannot play streamed audio here.";
    if (allowFallback) speakWithBrowser(text, completionText, kind);
    return false;
  }
  const controller = new AbortController();
  activeSpeechController = controller;
  const sample = {
    language,
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
  const onAbort = () => resolvePlayback();
  controller.signal.addEventListener("abort", onAbort, { once: true });
  let timedOut = false;
  let playbackTimedOut = false;
  let idleTimer = null;
  let playbackTimer = null;
  const resetIdleDeadline = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90_000);
  };
  resetIdleDeadline();
  try {
    const response = await apiFetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language, voice }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Streamed speech is unavailable.");
    }
    const contentType = (response.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
    const sampleRate = Number(response.headers.get("X-Audio-Sample-Rate"));
    if (contentType !== "audio/pcm" || sampleRate !== 24000) {
      throw new Error("The speech server returned an unsupported audio format.");
    }
    if (!response.body) throw new Error("This browser cannot receive streamed audio.");
    // A suspended audio context can leave resume pending even after fetch aborts.
    let rejectResume;
    const resumeAborted = new Promise((resolve, reject) => { rejectResume = reject; });
    const onResumeAbort = () => rejectResume(new DOMException("Speech stopped.", "AbortError"));
    controller.signal.addEventListener("abort", onResumeAbort, { once: true });
    try {
      if (controller.signal.aborted) onResumeAbort();
      await Promise.race([Promise.resolve().then(() => context.resume()), resumeAborted]);
    } finally {
      controller.signal.removeEventListener("abort", onResumeAbort);
    }
    if (controller.signal.aborted) {
      if (timedOut) throw new Error("Streamed speech timed out.");
      return;
    }
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
      const buffer = context.createBuffer(1, sampleCount, sampleRate);
      buffer.copyToChannel(samples, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const startAt = Math.max(nextStartAt, context.currentTime + 0.025);
      if (firstAudioAt === null) {
        firstAudioAt = performance.now() + Math.max(0, startAt - context.currentTime) * 1000;
        recordAutomaticVoiceTurnStart(sample, firstAudioAt);
        onStart?.();
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
      if (!value.length) continue;
      resetIdleDeadline();
      const combined = new Uint8Array(pending.length + value.length);
      combined.set(pending);
      combined.set(value, pending.length);
      const usableLength = combined.length - (combined.length % 2);
      if (usableLength) queuePcm(combined.subarray(0, usableLength));
      pending = combined.slice(usableLength);
    }
    if (pending.length) throw new Error("The speech stream ended on an incomplete audio sample.");
    if (!audioChunks) throw new Error("The speech provider returned no audio.");
    window.clearTimeout(idleTimer);
    streamFinished = true;
    if (requestSources.size === 0) resolvePlayback();
    const remainingPlaybackMs = Math.max(0, nextStartAt - context.currentTime) * 1000;
    playbackTimer = window.setTimeout(() => {
      playbackTimedOut = true;
      controller.abort();
    }, remainingPlaybackMs + 10_000);
    await playbackDone;
    if (playbackTimedOut) throw new Error("Streamed audio did not finish playing.");
    if (timedOut) throw new Error("Streamed speech timed out.");
    if (requestSpeechTurn !== speechTurn || controller.signal.aborted) return;
    const endedAt = performance.now();
    const startDelay = ((firstAudioAt - queuedAt) / 1000).toFixed(2);
    const playbackDuration = ((endedAt - firstAudioAt) / 1000).toFixed(2);
    speechSamples.push({ ...sample, startMs: firstAudioAt - queuedAt, playbackMs: endedAt - firstAudioAt });
    if (speechSamples.length > 500) speechSamples.shift();
    statusLine.textContent = `${completionText} Stream start ${startDelay}s, playback ${playbackDuration}s. `
      + speechTimingSummary(sample);
    return true;
  } catch (error) {
    if ((error.name === "AbortError" && !timedOut && !playbackTimedOut) || requestSpeechTurn !== speechTurn) return;
    controller.abort();
    requestSources.forEach((source) => {
      try { source.stop(); } catch { /* The source may already have ended. */ }
      scheduledSpeechSources.delete(source);
    });
    requestSources.clear();
    speechFailures.push({ ...sample, reason: playbackTimedOut ? "playback-timeout" : timedOut ? "stream-timeout" : "stream-failed" });
    if (speechFailures.length > 500) speechFailures.shift();
    const message = playbackTimedOut ? "Audio playback stalled. Try again or reload the page."
      : timedOut ? "No streamed speech data arrived for 90 seconds." : error.message;
    if (firstAudioAt === null && allowFallback) {
      statusLine.textContent = `${message} Falling back to the browser voice.`;
      speakWithBrowser(text, completionText, kind);
    } else {
      statusLine.textContent = `${message} Streamed speech stopped.`;
    }
    return false;
  } finally {
    window.clearTimeout(idleTimer);
    window.clearTimeout(playbackTimer);
    controller.signal.removeEventListener("abort", onAbort);
    if (activeSpeechController === controller) activeSpeechController = null;
  }
}

function createProgressiveStreamedSpeech(completionText = "Answer ready.") {
  if (!prepareStreamingAudio()) return null;
  const requestSpeechTurn = speechTurn;
  const language = speechLanguage.value;
  const voice = streamedTtsVoice.value;
  const queue = [];
  let buffer = "";
  let running = false;
  let speaking = false;
  let finished = false;
  let failed = false;
  let cancelled = false;
  let hadQueuedSpeech = false;
  const current = () => requestSpeechTurn === speechTurn && !cancelled && !failed;

  const drain = async () => {
    if (running || !current()) return;
    running = true;
    try {
      while (queue.length && current()) {
        const text = queue.shift();
        const ok = await speakStreamed(text, "Speech segment finished.", "tutor-segment", requestSpeechTurn, {
          language, voice, allowFallback: false,
          onStart: () => { if (current()) speaking = true; },
        });
        speaking = false;
        if (!current()) return;
        if (!ok) {
          failed = true;
          queue.length = 0;
          buffer = "";
          statusLine.textContent += " Read the answer above; pending speech was cleared.";
          return;
        }
      }
      if (current()) statusLine.textContent = finished ? completionText : "Tutor is answering…";
    } finally {
      running = false;
      // Stop after text completion must still reach a queued speech segment.
      if ((finished || failed || cancelled) && activeProgressiveSpeech === session) activeProgressiveSpeech = null;
    }
  };

  const enqueue = (text) => {
    if (!current()) return;
    for (const chunk of splitSpeechText(text, 1000)) {
      // Coalesce waiting sentences to reduce requests while the current segment plays.
      const last = queue.length - 1;
      if (last >= 0 && [...queue[last], ...chunk].length + 1 <= 1000) queue[last] += ` ${chunk}`;
      else queue.push(chunk);
      hadQueuedSpeech = true;
    }
    void drain();
  };

  const consume = (delta) => {
    if (!current() || finished) return;
    buffer += delta;
    const sentenceEnd = /[.!?\u0964\u0965]["'\u2019\u201d)\]]*\s+/u;
    let match = sentenceEnd.exec(buffer);
    while (match) {
      const end = match.index + match[0].length;
      enqueue(buffer.slice(0, end).trim());
      buffer = buffer.slice(end);
      match = sentenceEnd.exec(buffer);
    }
  };

  const session = {
    consume,
    finish: () => {
      if (!current() || finished) return cancelled || failed || hadQueuedSpeech;
      if (buffer.trim()) enqueue(buffer.trim());
      buffer = "";
      finished = true;
      if (!running && activeProgressiveSpeech === session) activeProgressiveSpeech = null;
      return hadQueuedSpeech;
    },
    cancel: () => { cancelled = true; buffer = ""; queue.length = 0; },
    isSpeaking: () => speaking || queue.length > 0 || running,
    hasFailed: () => failed,
    keepUntilPlaybackEnds: true,
  };
  return session;
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
  const speechRate = Number(speechRateControl.value) || 0.96;
  const sample = {
    language: speechLanguage.value,
    voice: selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : "browser default",
    rate: speechRate,
    kind,
    startEvent: "speech_synthesis_onstart",
  };
  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = speechLanguage.value;
    utterance.rate = speechRate;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => {
      if (requestSpeechTurn !== speechTurn || failed || startedAt !== null) return;
      startedAt = performance.now();
      recordAutomaticVoiceTurnStart(sample, startedAt);
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

function createProgressiveBrowserSpeech(completionText = "Answer ready.") {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return null;
  const requestSpeechTurn = speechTurn;
  const queuedAt = performance.now();
  const language = speechLanguage.value;
  const selectedVoice = matchingSpeechVoices.find((voice) =>
    `${voice.name}|${voice.lang}|${voice.voiceURI}` === speechVoice.value
  );
  const speechRate = Number(speechRateControl.value) || 0.96;
  const sample = {
    language,
    voice: selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : "browser default",
    rate: speechRate,
    kind: "tutor",
    startEvent: "speech_synthesis_onstart",
  };
  let buffer = "";
  let queuedCount = 0;
  let startedAt = null;
  let finished = false;
  let failed = false;
  let cancelled = false;
  let hadQueuedSpeech = false;

  const complete = () => {
    if (!finished || queuedCount || requestSpeechTurn !== speechTurn || failed || cancelled) return;
    if (startedAt === null) {
      statusLine.textContent = completionText;
      return;
    }
    const endedAt = performance.now();
    const startDelay = ((startedAt - queuedAt) / 1000).toFixed(2);
    const playbackDuration = ((endedAt - startedAt) / 1000).toFixed(2);
    speechSamples.push({ ...sample, startMs: startedAt - queuedAt, playbackMs: endedAt - startedAt });
    if (speechSamples.length > 500) speechSamples.shift();
    statusLine.textContent = `${completionText} This run: start ${startDelay}s, playback ${playbackDuration}s. `
      + speechTimingSummary(sample);
  };

  const enqueue = (text) => {
    for (const chunk of splitSpeechText(text)) {
      if (requestSpeechTurn !== speechTurn || failed || cancelled) return;
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = language;
      utterance.rate = speechRate;
      if (selectedVoice) utterance.voice = selectedVoice;
      queuedCount += 1;
      hadQueuedSpeech = true;
      utterance.onstart = () => {
        if (requestSpeechTurn !== speechTurn || failed || startedAt !== null) return;
        startedAt = performance.now();
        recordAutomaticVoiceTurnStart(sample, startedAt);
        const startDelay = ((startedAt - queuedAt) / 1000).toFixed(2);
        statusLine.textContent = `Tutor is speaking as the answer arrives (started in ${startDelay}s). Tap Stop audio or Speak to interrupt.`;
      };
      utterance.onend = () => {
        if (requestSpeechTurn !== speechTurn || failed) return;
        queuedCount = Math.max(0, queuedCount - 1);
        complete();
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
    }
  };

  const consume = (delta) => {
    if (requestSpeechTurn !== speechTurn || failed || cancelled || finished) return;
    buffer += delta;
    const sentenceEnd = /[.!?\u0964\u0965]["'\u2019\u201d)\]]*\s+/u;
    let match = sentenceEnd.exec(buffer);
    while (match) {
      const end = match.index + match[0].length;
      enqueue(buffer.slice(0, end).trim());
      buffer = buffer.slice(end);
      match = sentenceEnd.exec(buffer);
    }
  };

  const finish = () => {
    if (requestSpeechTurn !== speechTurn) return cancelled || hadQueuedSpeech;
    if (failed || cancelled || finished) return cancelled || hadQueuedSpeech;
    if (buffer.trim()) enqueue(buffer.trim());
    buffer = "";
    finished = true;
    complete();
    return queuedCount > 0 || startedAt !== null;
  };

  return {
    consume,
    finish,
    cancel: () => { cancelled = true; buffer = ""; },
    isSpeaking: () => startedAt !== null && queuedCount > 0,
    hasFailed: () => failed,
  };
}

previewVoiceButton.addEventListener("click", () => {
  stopLiveTranscription();
  const preview = speechLanguage.value === "en-IN"
    ? "Hello, let's study fundamental rights together."
    : "Namaste, aaj hum maulik adhikar seekhenge.";
  speak(preview, "Voice preview finished.", "preview");
});

async function sendQuestion(question, { preserveLive = false } = {}) {
  if (!preserveLive) stopLiveTranscription(false);
  prepareStreamingAudio();
  serverRecordingStartCancelled = true;
  serverRecordingRun += 1;
  serverRecordingStarting = false;
  if (activeMediaRecorder) stopServerRecording(true);
  activeTranscriptionController?.abort();
  activeTranscriptionController = null;
  updateServerTranscribeButton();
  stopSpeechOutput();
  const requestTurn = ++turn;
  preserveInterruptedTurn();
  activeRequest?.abort();
  activeRequest = new AbortController();
  const controller = activeRequest;
  const requestLanguage = speechLanguage.value;
  const requestStartedAt = performance.now();
  const clientStartedAtUtc = new Date().toISOString();
  let requestId = null;
  let traceRecorded = false;
  const recordTrace = (outcome, trace = null) => {
    if (traceRecorded) return;
    traceRecorded = true;
    tutorTurnTraces.push({
      request_id: trace?.request_id || requestId,
      started_at_utc: trace?.started_at_utc || clientStartedAtUtc,
      outcome,
      language: requestLanguage,
      client_duration_ms: Number((performance.now() - requestStartedAt).toFixed(2)),
      server_duration_ms: trace?.server_duration_ms ?? null,
      mode: trace?.mode ?? null,
      configured_model: trace?.configured_model ?? null,
      source_count: trace?.source_count ?? null,
      tool_outcomes: (trace?.tool_outcomes || []).map(({ name, ok }) => ({ name, ok: ok === true })),
      usage: trace?.usage ? {
        input_tokens: trace.usage.input_tokens,
        output_tokens: trace.usage.output_tokens,
        total_tokens: trace.usage.total_tokens,
        response_count: trace.usage.response_count,
      } : null,
      model_response_count: trace?.model_response_count ?? null,
      usage_response_count: trace?.usage_response_count ?? null,
    });
    if (tutorTurnTraces.length > 500) tutorTurnTraces.shift();
  };
  let firstTextMs = null;
  const useProgressiveProviderSpeech = streamedTtsOption.checked && streamingTtsAvailable;
  let progressiveSpeech = null;
  pendingQuestion = question;
  sendButton.disabled = true;
  statusLine.textContent = "Thinking…";
  addMessage("user", question);

  try {
    const response = await apiFetch("/api/agent/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: history.slice(-20), language: requestLanguage }),
      signal: controller.signal,
    });
    requestId = response.headers.get("X-Request-ID");
    const payload = await readAgentStream(response, (delta) => {
      if (requestTurn !== turn) return;
      if (firstTextMs === null) firstTextMs = performance.now() - requestStartedAt;
      if (!activePartialMessage) activePartialMessage = addMessage("assistant", "");
      activePartialMessage.querySelector("p").textContent += delta;
      progressiveSpeech?.consume(delta);
      if (!progressiveSpeech?.hasFailed()) {
        statusLine.textContent = progressiveSpeech?.isSpeaking()
          ? "Tutor is answering and speaking…"
          : "Tutor is answering…";
      }
    }, (progressive) => {
      if (requestTurn !== turn || !progressive || progressiveSpeech) return;
      progressiveSpeech = useProgressiveProviderSpeech
        ? createProgressiveStreamedSpeech()
        : createProgressiveBrowserSpeech();
      activeProgressiveSpeech = progressiveSpeech;
    });
    if (requestTurn !== turn) {
      recordTrace("cancelled", payload.trace);
      if (payload.mode === "model") {
        modelStreamFailures.push({ language: requestLanguage, model: modelName, reason: "cancelled" });
        if (modelStreamFailures.length > 500) modelStreamFailures.shift();
      }
      return;
    }
    recordTrace("completed", payload.trace);
    const usedProgressiveSpeech = progressiveSpeech?.finish() || false;
    if (activeProgressiveSpeech === progressiveSpeech && !progressiveSpeech?.keepUntilPlaybackEnds) activeProgressiveSpeech = null;
    if (payload.mode === "model") {
      modelStreamSamples.push({
        language: requestLanguage,
        model: modelName,
        firstTextMs,
        totalMs: performance.now() - requestStartedAt,
      });
      if (modelStreamSamples.length > 500) modelStreamSamples.shift();
    }
    activePartialMessage?.remove();
    activePartialMessage = null;
    addMessage("assistant", payload.answer, payload.sources || []);
    rememberTurn(question, payload.answer);
    pendingQuestion = null;
    if (!progressiveSpeech?.hasFailed()) {
      statusLine.textContent = usedProgressiveSpeech && progressiveSpeech?.isSpeaking()
        ? "Answer ready; speech is finishing."
        : "Answer ready.";
    }
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
    } else if (!usedProgressiveSpeech) {
      speak(payload.answer);
    }
  } catch (error) {
    recordTrace(error.name === "AbortError" || requestTurn !== turn ? "cancelled" : "failed", error.trace);
    if (progressiveSpeech && requestTurn === turn && error.name !== "AbortError") stopSpeechOutput();
    if (modelModeAvailable) {
      modelStreamFailures.push({
        language: requestLanguage,
        model: modelName,
        reason: error.name === "AbortError" || requestTurn !== turn ? "cancelled" : "failed",
      });
      if (modelStreamFailures.length > 500) modelStreamFailures.shift();
    }
    if (error.name !== "AbortError" && requestTurn === turn) {
      activePartialMessage?.remove();
      activePartialMessage = null;
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
    const response = await apiFetch("/api/quiz/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "fundamental rights", question_count: 3, language: speechLanguage.value }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not start the quiz.");
    if (requestTurn !== turn) return;
    quizSession = { quizId: payload.quiz_id, questions: payload.questions, index: 0, results: [], awaitingAnswer: false };
    input.value = "";
    showQuizQuestion();
  } catch (error) {
    if (requestTurn === turn) {
      addMessage("assistant", error.message);
      statusLine.textContent = "Quiz could not start. Your conversation is still open.";
    }
  } finally {
    if (requestTurn === turn) {
      quizButton.disabled = false;
      if (quizSession && !quizSession.awaitingAnswer) nextQuestionButton.hidden = false;
    }
    if (activeRequest === controller) activeRequest = null;
  }
}

function isNextQuizCommand(text) {
  const command = text.normalize("NFC").toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
  return new Set([
    "next", "next question", "next question please", "please next question",
    "agla sawal", "agla sawaal", "agla prashn", "agla prashna", "agla sawal pucho",
    "अगला सवाल", "अगला प्रश्न", "अगला सवाल पूछो", "अगला प्रश्न पूछो",
  ]).has(command);
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
  const readyText = activeLiveTranscription?.continuous
    ? "Speak your answer. After feedback, say next question or agla sawal to continue."
    : "Your answer is ready when you are.";
  statusLine.textContent = readyText;
  if (speakPrompt) speak(current.prompt, readyText);
}

async function submitQuizAnswer(answer, { preserveLive = false } = {}) {
  if (!preserveLive) stopLiveTranscription(false);
  prepareStreamingAudio();
  if (!quizSession || !quizSession.awaitingAnswer) return;
  stopSpeechOutput();
  const current = quizSession.questions[quizSession.index];
  if (current.submittedAnswer !== answer) {
    current.idempotencyKey = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    current.submittedAnswer = answer;
  }
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
    const response = await apiFetch("/api/quiz/score", {
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
      input.maxLength = 1200;
      input.placeholder = "Type a question… e.g. Right to Equality kya hai?";
      statusLine.textContent = `Quiz complete: ${completeCount} of ${totalQuestions} answers covered the rubric. Results are saved for this browser.`;
      speak(feedback, statusLine.textContent);
    } else {
      const nextStep = activeLiveTranscription?.continuous
        ? "say next question or agla sawal, or tap Next question"
        : "tap Next question";
      statusLine.textContent = `Answer checked. ${quizSession.index} of ${quizSession.questions.length} complete; ${nextStep} when ready.`;
      nextQuestionButton.hidden = false;
      speak(feedback, statusLine.textContent);
    }
  } catch (error) {
    if (requestTurn === turn) {
      quizSession.awaitingAnswer = true;
      quizSession.pendingAnswer = "";
      if (!input.value.trim()) input.value = answer;
      addMessage("assistant", error.message);
      statusLine.textContent = error.message.toLowerCase().includes("already saved")
        ? "This quiz question already has a saved score. Start a new quiz to try a revised answer."
        : "Scoring failed. You can try submitting the answer again.";
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
  if (activeLiveTranscription) {
    statusLine.textContent = "Tap Done and wait for the final live transcript before sending, or cancel and type.";
    return;
  }
  const automaticVoiceInput = pendingAutomaticVoiceInput;
  pendingAutomaticVoiceInput = null;
  if (recognitionListening && !recognitionHadFinalResult) {
    statusLine.textContent = "Wait for a final transcript, or stop listening and type your question before sending.";
    return;
  }
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
    activeAutomaticVoiceTurn = automaticVoiceInput
      ? { ...automaticVoiceInput, requestTurn: turn + 1 }
      : null;
    submitQuizAnswer(question);
    return;
  }
  stopTutor();
  activeAutomaticVoiceTurn = automaticVoiceInput
    ? { ...automaticVoiceInput, requestTurn: turn + 1 }
    : null;
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
  if (!activeRequest && !activeSpeechController && !activeProgressiveSpeech && !scheduledSpeechSources.size
    && !recognitionListening && !activeMediaRecorder && !serverRecordingStarting
    && !activeTranscriptionController && !activeLiveTranscription && !speechSynthesis?.speaking && !speechSynthesis?.pending) return;
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
    const response = await apiFetch("/api/progress");
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
    const response = await apiFetch("/api/progress", { method: "DELETE" });
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
  if (activeProgressiveSpeech || activeSpeechController || scheduledSpeechSources.size || speechSynthesis?.speaking || speechSynthesis?.pending) {
    stopSpeechOutput();
    statusLine.textContent = "Speech language changed. Current playback stopped; the new language applies next time.";
  }
});
streamedTtsOption.addEventListener("change", () => {
  if (activeProgressiveSpeech || activeSpeechController || scheduledSpeechSources.size) stopSpeechOutput();
  if (streamedTtsOption.checked && !prepareStreamingAudio()) {
    streamedTtsOption.checked = false;
    statusLine.textContent = "This browser cannot play streamed audio. Use the installed browser voice instead.";
  }
  speechRateControl.disabled = streamedTtsOption.checked;
  streamedTtsVoice.disabled = !streamingTtsAvailable || !streamedTtsOption.checked;
});
streamedTtsVoice.addEventListener("change", () => {
  if (activeProgressiveSpeech || activeSpeechController || scheduledSpeechSources.size) {
    stopSpeechOutput();
    statusLine.textContent = "Streamed voice changed. The new voice applies to the next playback.";
  }
  saveSpeechPreferences();
});
speechLanguage.addEventListener("change", saveSpeechPreferences);
speechVoice.addEventListener("change", saveSpeechPreferences);
speechRateControl.addEventListener("change", () => {
  const speechSynthesis = window.speechSynthesis;
  if (activeProgressiveSpeech || speechSynthesis?.speaking || speechSynthesis?.pending) {
    stopSpeechOutput();
    statusLine.textContent = "Browser speech rate changed. Current playback stopped; the new rate applies next time.";
  }
  saveSpeechPreferences();
});
window.speechSynthesis?.addEventListener?.("voiceschanged", refreshSpeechVoices);
refreshSpeechVoices();

if (SpeechRecognition) {
  recognitionAvailable = true;
  autoSubmitSpeech.disabled = false;
  recognition = null;
  speechLanguage.addEventListener("change", () => {
    if (recognitionListening) {
      stopRecognition(true);
      statusLine.textContent = "Speech language changed. Partial words were discarded; tap Speak to start a new transcript.";
    }
  });
}

updateMicrophoneButton(false);
input.addEventListener("input", () => {
  if (activeLiveTranscription) {
    stopLiveTranscription(false);
    statusLine.textContent = "Live transcription stopped so your edit stays in the question box.";
  }
  if (recognitionListening) {
    stopRecognition();
    statusLine.textContent = "Voice input stopped so your edit stays in the question box. Review it, then ask.";
  }
  if (serverRecordingStarting || activeMediaRecorder || activeTranscriptionController) {
    serverRecordingStartCancelled = true;
    serverRecordingRun += 1;
    serverRecordingStarting = false;
    if (activeMediaRecorder) stopServerRecording(true);
    const controller = activeTranscriptionController;
    activeTranscriptionController = null;
    controller?.abort();
    updateServerTranscribeButton(activeMediaRecorder ? "busy" : "idle");
    statusLine.textContent = "Recording or transcription stopped so your edit stays in the question box. Review it, then ask.";
  }
});
micButton.addEventListener("click", () => {
  if (!recognitionAvailable) return;
  if (recognitionListening) {
    const hadFinalResult = recognitionHadFinalResult;
    stopRecognition(true);
    statusLine.textContent = hadFinalResult
      ? "Listening stopped. Review the final transcript, then ask."
      : "Listening stopped. Partial words were discarded; your previous text is restored.";
    return;
  }
  stopTutor();
  window.speechSynthesis?.cancel();
  const run = ++recognitionRun;
  const capture = new SpeechRecognition();
  const inputBeforeListening = input.value;
  recognitionOriginalInput = inputBeforeListening;
  recognitionHadFinalResult = false;
  let finalTranscript = "";
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
    statusLine.textContent = "Listening… speak now.";
  };
  capture.onresult = (event) => {
    if (run !== recognitionRun || !recognitionListening) return;
    const transcriptParts = [];
    const finalParts = [];
    for (let i = 0; i < event.results.length; i += 1) {
      const part = event.results[i][0].transcript.trim();
      if (part) transcriptParts.push(part);
      if (event.results[i].isFinal && part) finalParts.push(part);
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
    if (finalParts.length) finalTranscript = finalParts.join(" ");
    input.value = finalTranscript || transcriptParts.join(" ");
  };
  capture.onerror = (event) => {
    if (run !== recognitionRun || !recognitionListening) return;
    const hadFinalResult = recognitionHadFinalResult;
    stopRecognition();
    if (!hadFinalResult) {
      input.value = inputBeforeListening;
      recognitionFailures.push({ language: capture.lang, reason: event.error || "unknown" });
      if (recognitionFailures.length > 500) recognitionFailures.shift();
      statusLine.textContent = `${recognitionErrorMessage(event.error)} ${recognitionTimingSummary(capture.lang)}`;
    }
  };
  capture.onend = () => {
    if (run !== recognitionRun) return;
    const wasListening = recognitionListening;
    recognitionListening = false;
    updateMicrophoneButton(false);
    if (wasListening && !recognitionHadFinalResult) {
      input.value = inputBeforeListening;
      const language = capture.lang;
      recognitionFailures.push({ language, reason: "no-final-transcript" });
      if (recognitionFailures.length > 500) recognitionFailures.shift();
      statusLine.textContent = `No final transcript was received; partial words were discarded. Try again or type. ${recognitionTimingSummary(language)}`;
    } else if (wasListening && recognitionHadFinalResult && autoSubmitSpeech.checked && input.value.trim()) {
      statusLine.textContent = "Final transcript received. Sending it to the tutor.";
      const automaticVoiceInput = { language: capture.lang, recognitionEndedAt: performance.now() };
      pendingAutomaticVoiceInput = automaticVoiceInput;
      form.requestSubmit();
      if (pendingAutomaticVoiceInput === automaticVoiceInput) pendingAutomaticVoiceInput = null;
    }
  };
  recognitionListening = true;
  updateMicrophoneButton(false, true);
  try {
    capture.start();
  } catch (error) {
    recognitionListening = false;
    recognitionRun += 1;
    updateMicrophoneButton(false);
    const reason = error?.name || "start-failed";
    recognitionFailures.push({ language: capture.lang, reason });
    if (recognitionFailures.length > 500) recognitionFailures.shift();
    const message = reason === "NotAllowedError" || reason === "SecurityError"
      ? "Microphone access was blocked. Check browser permission, or type instead."
      : "Voice input could not start. Try again, or type instead.";
    statusLine.textContent = `${message} ${recognitionTimingSummary(capture.lang)}`;
  }
});

liveSttButton.addEventListener("click", () => {
  if (!liveTranscriptionAvailable) return;
  if (activeLiveTranscription) {
    if (activeLiveTranscription.state === "listening") activeLiveTranscription.finish();
    else {
      stopLiveTranscription();
      statusLine.textContent = "Live transcription canceled. Your previous text is restored.";
    }
    return;
  }
  stopTutor();
  const run = ++liveSttRun;
  const continuous = liveConversation.checked;
  liveSttOriginalInput = input.value;
  const capture = new window.BolPrepLiveTranscription({
    metrics: (attempt) => {
      liveTranscriptionAttempts.push(attempt);
      if (liveTranscriptionAttempts.length > 500) liveTranscriptionAttempts.shift();
    },
    partial: (text) => {
      if (run === liveSttRun) input.value = text;
    },
    speechStart: () => {
      if (run !== liveSttRun || !continuous) return;
      stopTutor({ preserveLive: true });
      input.value = "";
      statusLine.textContent = "Listening to your new turn. Previous tutor output stopped.";
    },
    final: (text) => {
      if (run !== liveSttRun) return;
      input.value = text;
      if (continuous) {
        if (quizSession && isNextQuizCommand(text)) {
          stopTutor({ preserveLive: true });
          input.value = "";
          liveSttOriginalInput = "";
          if (quizSession.awaitingAnswer) {
            statusLine.textContent = "Answer the current question before moving on. Next question does not skip an unanswered question.";
          } else {
            showQuizQuestion();
          }
          return;
        }
        if (text.length > input.maxLength || (quizSession && !quizSession.awaitingAnswer)) {
          stopLiveTranscription(false);
          statusLine.textContent = text.length > input.maxLength
            ? `Conversation paused. Shorten the transcript to ${input.maxLength} characters before sending.`
            : "Conversation paused. Tap Next question to continue your quiz; the transcript remains for review.";
          return;
        }
        stopTutor({ preserveLive: true });
        input.value = "";
        liveSttOriginalInput = "";
        if (quizSession) void submitQuizAnswer(text, { preserveLive: true });
        else void sendQuestion(text, { preserveLive: true });
        return;
      }
      statusLine.textContent = text.length > input.maxLength
        ? `Final transcript received. Shorten it to ${input.maxLength} characters before sending.`
        : "Final live transcript received. Review it, then send.";
    },
    status: (text, state) => {
      if (run !== liveSttRun) return;
      statusLine.textContent = text;
      updateLiveSttButton(state);
    },
    error: (message) => {
      if (run !== liveSttRun) return;
      input.value = liveSttOriginalInput;
      statusLine.textContent = message;
    },
    closed: () => {
      if (activeLiveTranscription !== capture) return;
      activeLiveTranscription = null;
      updateLiveSttButton();
    },
  }, { autoFinish: liveAutoFinish.checked, continuous, quietPauseMs: Number(liveQuietPause.value) });
  activeLiveTranscription = capture;
  updateLiveSttButton("connecting");
  statusLine.textContent = "Connecting live microphone…";
  void capture.start(speechLanguage.value);
});
liveConversation.addEventListener("change", () => updateLiveSttButton());
speechLanguage.addEventListener("change", () => {
  if (!activeLiveTranscription) return;
  stopLiveTranscription();
  statusLine.textContent = "Language changed. Start a new live transcript; partial words were discarded.";
});
window.addEventListener("pagehide", () => stopLiveTranscription(false));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden || !activeLiveTranscription) return;
  stopLiveTranscription();
  statusLine.textContent = "Live microphone stopped when the page was hidden. Start Live mic again when ready.";
});

serverTranscribeButton.addEventListener("click", () => {
  if (serverRecordingStarting || activeTranscriptionController) {
    stopTutor();
    statusLine.textContent = "Recording or transcription canceled. You can record again or type your question.";
    return;
  }
  if (activeMediaRecorder?.state === "recording") {
    stopServerRecording(false);
    return;
  }
  void startServerRecording();
});

apiFetch("/health").then((response) => response.json()).then((health) => {
  logoutButton.hidden = !health.access_protected;
  const mode = health.mode === "model" ? "Model answers enabled" : "Offline practice mode";
  modelModeAvailable = health.mode === "model";
  modelName = typeof health.model_name === "string" && health.model_name ? health.model_name : "unknown";
  streamingTtsAvailable = Boolean(health.streaming_tts);
  streamedTtsOption.disabled = !streamingTtsAvailable;
  streamedTtsVoice.disabled = !streamingTtsAvailable || !streamedTtsOption.checked;
  serverTranscriptionAvailable = Boolean(health.server_transcription);
  liveTranscriptionAvailable = Boolean(health.live_transcription)
    && Boolean(window.BolPrepLiveTranscription && window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
  liveSttNote.hidden = !liveTranscriptionAvailable;
  updateLiveSttButton();
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
window.addEventListener("bolprep-access-expired", () => stopTutor());
logoutButton.addEventListener("click", async () => {
  stopTutor();
  logoutButton.disabled = true;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await apiFetch("/api/logout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not sign out. Try again.");
    window.location.replace("/login");
  } catch (error) {
    statusLine.textContent = error.name === "AbortError"
      ? "Sign out timed out. Try again or reload."
      : error.message || "Could not sign out. Try again.";
  } finally {
    clearTimeout(deadline);
    logoutButton.disabled = false;
  }
});
loadProgress();
