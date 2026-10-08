const form = document.querySelector("#question-form");
const apiFetch = window.BolPrepFetch;
const MAX_SPEECH_PCM_BYTES = 24000 * 2 * 300; // Five minutes of mono 16-bit PCM.
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
const liveCaptureLimit = document.querySelector("#live-capture-limit");
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
const quizDifficulty = document.querySelector("#quiz-difficulty");
const quizPresetLabels = { basic: "Basic", standard: "Standard", challenge: "Challenge" };
const nextQuestionButton = document.querySelector("#next-question");
const endQuizButton = document.querySelector("#end-quiz");
const sendLabel = document.querySelector("#send-label");
const progressSummary = document.querySelector("#progress-summary");
const weakTopics = document.querySelector("#weak-topics");
const progressRefreshButton = document.querySelector("#refresh-progress");
const clearProgressButton = document.querySelector("#clear-progress");

const history = [];
const conversationMessages = [];
let conversationRevision = 0;
let savedConversations = null;
let activeRequest = null;
let activePartialMessage = null;
let recognition = null;
let recognitionAvailable = false;
let recognitionListening = false;
let recognitionRun = 0;
let recognitionDeadlineTimer = null;
let serverTranscriptionAvailable = false;
let liveTranscriptionAvailable = false;
let activeLiveTranscription = null;
let liveSttRun = 0;
let liveSttOriginalInput = "";
let activeTranscriptionController = null;
let activeMediaRecorder = null;
let activeRecordingStop = null;
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
let activeSpeechHistoryEntry = null;
let activeBrowserSpeechDeadline = null;
const speechStopSamples = [];
let progressRequestId = 0;
let activeProgressController = null;
let clearingProgress = false;
let quizSession = null;

function speechLanguageLabel(language) {
  return language === "hi-IN" ? "Hindi/Hinglish" : "English";
}

function renderTutorTraces() {
  const summary = document.querySelector("#tutor-trace-summary");
  const list = document.querySelector("#tutor-trace-list");
  const count = (outcome) => tutorTurnTraces.filter((trace) => trace.outcome === outcome).length;
  summary.textContent = `${tutorTurnTraces.length} recorded: ${count("completed")} completed, ${count("failed")} failed, ${count("cancelled")} canceled.`;
  list.replaceChildren();
  const duration = (value) => Number.isFinite(value) ? `${(value / 1000).toFixed(2)}s` : "unavailable";
  for (const trace of tutorTurnTraces.slice(-10).reverse()) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = `${trace.outcome} · ${speechLanguageLabel(trace.language)} · ${trace.mode || "mode unavailable"}`;
    const details = document.createElement("p");
    details.textContent = `Started ${trace.started_at_utc} | Client ${duration(trace.client_duration_ms)} | Server ${duration(trace.server_duration_ms)} | Sources ${trace.source_count ?? "unavailable"}`;
    const identity = document.createElement("p");
    identity.textContent = `Request ${trace.request_id || "unavailable"} | Requested ${trace.configured_model || "unavailable"} | Provider reported ${reportedModelsText(trace.provider_reported_models)}`;
    const tools = document.createElement("p");
    tools.textContent = trace.tool_outcomes.length
      ? `Tools: ${trace.tool_outcomes.map((tool) => `${tool.name}: ${tool.ok ? "succeeded" : "failed"}`).join(", ")}`
      : "No tool outcomes reported.";
    const usage = document.createElement("p");
    usage.textContent = trace.usage
      ? `Reported tokens: ${trace.usage.input_tokens} input, ${trace.usage.output_tokens} output, ${trace.usage.total_tokens} total across ${trace.usage.response_count} responses. Speech usage excluded.`
      : "Token usage unavailable. Speech usage and monetary cost are not measured.";
    if (trace.server_metadata_status === "invalid") {
      usage.textContent += " Server diagnostics were invalid and omitted.";
    }
    item.append(title, details, identity, tools, usage);
    list.append(item);
  }
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

function validStudySource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return false;
  for (const [field, limit] of [["title", 512], ["section", 128], ["url", 2048]]) {
    if (typeof source[field] !== "string" || !source[field].trim()
      || source[field].length > limit) return false;
  }
  try {
    const url = new URL(source.url);
    return source.url === source.url.trim() && url.protocol === "https:"
      && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function validStudySources(sources) {
  return Array.isArray(sources) && sources.length <= 100 && sources.every(validStudySource);
}

function reportedModelsText(models) {
  return models == null ? "unavailable" : models.length
    ? models.map((model, index) => `${index + 1}: ${model || "unavailable"}`).join(", ")
    : "none (offline)";
}

function validTutorTrace(trace) {
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!object(trace)
    || typeof trace.request_id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trace.request_id)
    || typeof trace.started_at_utc !== "string" || trace.started_at_utc.length > 64
    || !/(?:Z|\+00:00)$/.test(trace.started_at_utc)
    || !Number.isFinite(Date.parse(trace.started_at_utc))
    || !["completed", "failed"].includes(trace.outcome)
    || typeof trace.server_duration_ms !== "number"
    || !Number.isFinite(trace.server_duration_ms) || trace.server_duration_ms < 0
    || !["offline", "model"].includes(trace.mode)
    || !(trace.configured_model === null || (typeof trace.configured_model === "string"
      && trace.configured_model.trim() && trace.configured_model.length <= 256))
    || !count(trace.source_count) || trace.source_count > 100
    || !Array.isArray(trace.tool_outcomes) || trace.tool_outcomes.length > 6
    || !trace.tool_outcomes.every((tool) => object(tool) && typeof tool.name === "string"
      && tool.name.trim() && tool.name.length <= 64 && typeof tool.ok === "boolean")
    || !(trace.model_response_count === null || count(trace.model_response_count))
    || !(trace.usage_response_count === null || count(trace.usage_response_count))) return false;
  if (trace.model_response_count !== null && trace.usage_response_count !== null
    && trace.usage_response_count > trace.model_response_count) return false;
  const models = trace.provider_reported_models;
  if (models != null && (!Array.isArray(models) || models.length > 4
    || models.length !== trace.model_response_count
    || (trace.mode !== "model" && models.length)
    || !models.every((model) => model === null || (typeof model === "string"
      && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model))))) return false;
  if (trace.usage === null) return true;
  return object(trace.usage)
    && ["input_tokens", "output_tokens", "total_tokens", "response_count"]
      .every((field) => count(trace.usage[field]))
    && trace.usage.response_count > 0
    && trace.usage.response_count === trace.model_response_count
    && trace.usage.response_count === trace.usage_response_count;
}

function savedRequestTrace(trace) {
  if (!validTutorTrace(trace) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(trace.request_id)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(trace.started_at_utc)
    || Number(trace.started_at_utc.slice(0, 4)) < 1
    || new Date(trace.started_at_utc).toISOString().slice(0, 19) !== trace.started_at_utc.slice(0, 19)
    || trace.server_duration_ms > 86400000
    || (trace.configured_model !== null && !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(trace.configured_model))
    || !trace.tool_outcomes.every((tool) => ["start_quiz", "score_answer", "save_progress", "get_weak_topics"].includes(tool.name))) return null;
  const fields = ["request_id", "started_at_utc", "outcome", "server_duration_ms", "mode", "configured_model",
    "source_count", "model_response_count", "usage_response_count"];
  const selected = Object.fromEntries(fields.map((field) => [field, trace[field]]));
  if (trace.provider_reported_models !== undefined) {
    selected.provider_reported_models = trace.provider_reported_models === null
      ? null : trace.provider_reported_models.slice();
  }
  selected.tool_outcomes = trace.tool_outcomes.map(({ name, ok }) => ({ name, ok }));
  selected.usage = trace.usage === null ? null : Object.fromEntries(
    ["input_tokens", "output_tokens", "total_tokens", "response_count"].map((field) => [field, trace.usage[field]]));
  return selected;
}

function validTutorToolEvents(events) {
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const text = (value, limit) => typeof value === "string" && Boolean(value.trim()) && value.length <= limit;
  if (!Array.isArray(events) || events.length > 6) return false;
  return events.every((event) => {
    if (!object(event) || !text(event.name, 64) || typeof event.ok !== "boolean") return false;
    if (!event.ok) return text(event.error, 4096);
    const result = event.result;
    if (!object(result)) return false;
    if (event.name === "start_quiz") {
      if (result.difficulty !== undefined && (typeof result.difficulty !== "string"
        || !Object.hasOwn(quizPresetLabels, result.difficulty))) return false;
      const pool = result.difficulty === "basic" ? ["art14_equality", "art21_protection"]
        : result.difficulty === "challenge" ? ["art19_freedoms", "art22_arrest_safeguards"] : null;
      if (!text(result.quiz_id, 128) || !Array.isArray(result.questions)
        || result.questions.length < 1 || result.questions.length > 3) return false;
      if (!result.questions.every((question) => object(question) && text(question.id, 128)
        && text(question.prompt, 3000) && validStudySource(question.source)
        && (!pool || pool.includes(question.id)))) return false;
      return new Set(result.questions.map((question) => question.id)).size === result.questions.length;
    }
    if (event.name === "score_answer") {
      const matched = result.matched_concepts;
      const missing = result.missing_concepts;
      if (![matched, missing].every((items) => Array.isArray(items) && items.length <= 100
        && items.every((item) => text(item, 512)))) return false;
      const labels = [...matched, ...missing];
      if (!labels.length || labels.length > 100 || new Set(labels).size !== labels.length) return false;
      const minimum = result.minimum_concepts;
      const total = result.total_concepts;
      // Older persisted results predate rubric counts. Check arithmetic only
      // when metadata is supplied, and reject partially supplied metadata.
      if (minimum !== undefined || total !== undefined) {
        if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(total)
          || minimum < 1 || minimum > total || total !== labels.length) return false;
        const numerator = 100 * matched.length;
        const whole = Math.floor(numerator / minimum);
        const doubledRemainder = 2 * (numerator % minimum);
        // Match Python's round-to-even at exact half points.
        const rounded = whole + (doubledRemainder > minimum
          || (doubledRemainder === minimum && whole % 2 === 1) ? 1 : 0);
        if (result.score !== Math.min(100, rounded)
          || result.complete !== (matched.length >= minimum)) return false;
      }
      return text(result.question_id, 128) && typeof result.complete === "boolean"
        && text(result.feedback, 4096) && typeof result.score === "number"
        && Number.isFinite(result.score) && result.score >= 0 && result.score <= 100
        && validStudySource(result.source);
    }
    if (event.name === "get_weak_topics") return validSavedProgress(result);
    return false;
  });
}

function addMessage(role, text, sources = [], sourceLabel = "STUDY SOURCE", replay = null, trace = null) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "tutor-message"}`;
  const speaker = document.createElement("span");
  speaker.className = "speaker";
  speaker.textContent = role === "user" ? "YOU" : "BOLPREP";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(speaker, paragraph);
  const sourceRecords = Array.isArray(sources) ? sources.slice(0, 100) : [];
  const displaySources = sourceRecords.filter(validStudySource);
  if (displaySources.length) {
    const sourceList = document.createElement("div");
    sourceList.className = "sources";
    const label = document.createElement("span");
    label.className = "sources-label";
    label.textContent = sourceLabel;
    sourceList.append(label);
    for (const source of displaySources) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${source.section} · ${source.title}`;
      sourceList.append(link);
    }
    article.append(sourceList);
  }
  if (!validStudySources(sources)) {
    const warning = document.createElement("p");
    warning.textContent = "Some source references could not be displayed.";
    article.append(warning);
  }
  if (role === "assistant" && replay && text.trim()) {
    const replayButton = document.createElement("button");
    replayButton.type = "button";
    replayButton.className = "text-button";
    replayButton.textContent = "Listen again";
    replayButton.title = "Replay this text with current speech settings; streamed speech may incur API usage";
    replayButton.addEventListener("click", () => {
      if (!article.isConnected) return;
      stopTutor();
      speak(text, "Replay finished. Ready when you are.", "tutor", replay.historyEntry || null);
    });
    article.append(replayButton);
  }
  const requestTrace = role === "assistant" ? savedRequestTrace(trace) : null;
  if (requestTrace) {
    const details = document.createElement("details");
    details.className = "request-details";
    const summary = document.createElement("summary");
    summary.textContent = "Request details";
    details.append(summary);
    const usage = requestTrace.usage;
    const lines = [
      "Client snapshot of reported request metadata; excludes speech timings and cost.",
      `Provider-reported models by response: ${reportedModelsText(requestTrace.provider_reported_models)}`,
      "Reported identifiers do not guarantee immutable model versions.",
      `${requestTrace.outcome} · ${requestTrace.mode} · ${requestTrace.configured_model || "model unavailable"}`,
      `${requestTrace.started_at_utc} · request ${requestTrace.request_id}`,
      `Reported server duration: ${requestTrace.server_duration_ms} ms · ${requestTrace.source_count} sources`,
      requestTrace.tool_outcomes.length ? `Reported tools: ${requestTrace.tool_outcomes.map((tool) => `${tool.name}: ${tool.ok ? "succeeded" : "failed"}`).join(", ")}` : "Tool outcomes unavailable or none reported.",
      usage ? `Reported tokens: ${usage.input_tokens} input, ${usage.output_tokens} output, ${usage.total_tokens} total (${usage.response_count} responses)` : "Token usage unavailable.",
    ];
    for (const line of lines) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      details.append(paragraph);
    }
    article.append(details);
  }
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  if (text.trim()) {
    conversationMessages.push({ role, content: text, sources: displaySources, historyEntry: replay?.historyEntry, trace: requestTrace });
    if (conversationMessages.length > 20) conversationMessages.splice(0, conversationMessages.length - 20);
    conversationRevision += 1;
    savedConversations?.conversationChanged();
  }
  return article;
}

async function readAgentStream(response, onTextDelta, onSpeechMode, onActivity, onSources) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Tutor request failed.");
  }
  if (!response.body) throw new Error("This browser cannot receive the tutor response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let payload = null;
  let receivedBytes = 0;
  let streamEnded = false;
  const maxStreamBytes = 2 * 1024 * 1024;
  const maxLineCharacters = 256 * 1024;
  function consumeLine(line) {
    if (line.length > maxLineCharacters) throw new Error("A tutor response event exceeded the size limit.");
    if (!line.trim()) return;
    let event;
    try { event = JSON.parse(line); } catch { throw new Error("The tutor sent an invalid response event."); }
    if (!event || typeof event !== "object" || Array.isArray(event) || payload !== null) {
      throw new Error("The tutor response event order or format was invalid.");
    }
    if (event.type === "delta" && typeof event.text === "string") onTextDelta(event.text);
    else if (event.type === "speech_mode" && typeof event.progressive === "boolean") onSpeechMode?.(event.progressive);
    else if (event.type === "retrieved_sources" && validStudySources(event.sources)) onSources?.(event.sources);
    else if (event.type === "complete") {
      const result = event.payload;
      if (!result || typeof result !== "object" || Array.isArray(result)
        || typeof result.answer !== "string" || !result.answer.trim()
        || !["offline", "model"].includes(result.mode)
        || (result.mode === "model" && (result.answer.length > 24_000 || [...result.answer].length > 12_000))
        || (result.sources !== undefined && !validStudySources(result.sources))
        || (result.tool_events !== undefined && !validTutorToolEvents(result.tool_events))) {
        throw new Error("The tutor sent an invalid completed response.");
      }
      payload = result;
    } else if (event.type === "error") {
      const error = new Error(typeof event.error === "string" ? event.error : "Tutor request failed.");
      error.trace = event.trace;
      throw error;
    } else {
      throw new Error("The tutor sent an unsupported or malformed response event.");
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) streamEnded = true;
      receivedBytes += value?.length || 0;
      if (receivedBytes > maxStreamBytes) throw new Error("The tutor response exceeded the 2 MiB limit.");
      if (value?.length) onActivity?.();
      try {
        pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      } catch {
        throw new Error("The tutor response contained invalid UTF-8 text. Try again.");
      }
      const lines = pending.split("\n");
      pending = lines.pop();
      lines.forEach(consumeLine);
      if (pending.length > maxLineCharacters) throw new Error("A tutor response event exceeded the size limit.");
      if (done) break;
    }
    if (pending.trim()) consumeLine(pending);
    if (!payload) throw new Error("The tutor response stream ended early. Try again.");
    return payload;
  } finally {
    // A broken cancellation promise must not keep the turn's controls waiting.
    if (!streamEnded) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function articleContextFromSources(sources) {
  if (!Array.isArray(sources) || sources.length !== 1 || !validStudySource(sources[0])) return null;
  const source = sources[0];
  if (/^article-\d+[a-z]?$/.test(source.id || "")) return source.id;
  const article = /\bArticle\s+(\d+[a-z]?)(?![a-z\d])/i.exec(source.section);
  return article ? `article-${article[1].toLowerCase()}` : null;
}

function rememberMessage(role, content, sources = []) {
  const entry = { role, content: [...content].slice(0, role === "user" ? 1200 : 3000).join("") };
  const context = articleContextFromSources(sources);
  if (context) entry.article_context = context;
  history.push(entry);
  history.splice(0, Math.max(0, history.length - 20));
  return entry;
}

function rememberTurn(userMessage, assistantMessage) {
  rememberMessage("user", userMessage);
  return rememberMessage("assistant", assistantMessage);
}

function updateLiveSttButton(state = "idle") {
  liveSttButton.hidden = !liveTranscriptionAvailable;
  liveSttButton.disabled = !liveTranscriptionAvailable;
  liveAutoFinish.disabled = !liveTranscriptionAvailable || state !== "idle" || liveConversation.checked;
  liveQuietPause.disabled = !liveTranscriptionAvailable || state !== "idle";
  liveCaptureLimit.disabled = !liveTranscriptionAvailable || state !== "idle";
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

function clearRecognitionDeadline() {
  if (recognitionDeadlineTimer !== null) window.clearTimeout(recognitionDeadlineTimer);
  recognitionDeadlineTimer = null;
}

function stopRecognition(restoreUnconfirmed = false, preserveLive = false) {
  clearRecognitionDeadline();
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
  discardServerRecording ||= discard;
  updateServerTranscribeButton("busy");
  activeRecordingStop?.();
  // Discarded capture needs no final audio. Release the microphone even if
  // the recorder delays onstop; its owner still handles buffers and callbacks.
  if (discard) activeMediaStream?.getTracks().forEach((track) => track.stop());
}

function recordingCaptureFailure(error) {
  const failures = {
    NotAllowedError: ["permission-denied", "Microphone access was denied or blocked. Allow it in browser settings, or type your question."],
    SecurityError: ["microphone-blocked", "This browser page is not allowed to use the microphone. Open the local tutor page directly, or type your question."],
    NotFoundError: ["no-microphone", "No microphone was found. Connect one and try again, or type your question."],
    CaptureEndedError: ["capture-ended", "The microphone disconnected. Reconnect it and record again, or type your question."],
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
  const startupTimer = window.setTimeout(() => {
    if (recordingRun !== serverRecordingRun || !serverRecordingStarting) return;
    serverRecordingStartCancelled = true;
    serverRecordingRun += 1;
    serverRecordingStarting = false;
    recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "capture-timeout" });
    if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
    updateServerTranscribeButton();
    statusLine.textContent = "The microphone did not start within 45 seconds. Check permission and record again, or type your question.";
  }, 45_000);
  updateServerTranscribeButton("starting");
  statusLine.textContent = "Allow microphone access, then ask a short question. Audio is sent for transcription when you stop.";
  let stream;
  let detachTrackListeners = () => {};
  let clearStopDeadline = () => {};
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (recordingRun !== serverRecordingRun || serverRecordingStartCancelled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length || audioTracks.some((track) => track.readyState === "ended")) {
      throw Object.assign(new Error("Microphone capture ended."), { name: "CaptureEndedError" });
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
    const captureEnded = () => {
      if (recordingRun !== serverRecordingRun || discardServerRecording
        || activeMediaRecorder !== recorder) return;
      // Mark discard first so recorder errors and repeated track events cannot count twice.
      discardServerRecording = true;
      recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "capture-ended" });
      if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
      stopServerRecording(true);
      stream.getTracks().forEach((track) => track.stop());
      statusLine.textContent = "The microphone disconnected. This recording was discarded. Reconnect it and record again, or type your question.";
    };
    audioTracks.forEach((track) => track.addEventListener("ended", captureEnded));
    detachTrackListeners = () => audioTracks.forEach((track) => track.removeEventListener("ended", captureEnded));
    let recordedBytes = 0;
    const maxRecordedBytes = 5 * 1024 * 1024; // Match server MAX_AUDIO_BYTES.
    recorder.ondataavailable = (event) => {
      if (recordingRun !== serverRecordingRun || activeMediaRecorder !== recorder
        || discardServerRecording || !event.data?.size) return;
      recordedBytes += event.data.size;
      if (recordedBytes > maxRecordedBytes) {
        discardServerRecording = true;
        serverRecordingChunks = [];
        recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "recording-too-large" });
        if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
        stopServerRecording(true);
        stream.getTracks().forEach((track) => track.stop());
        statusLine.textContent = "The recording exceeded 5 MiB and was discarded. Record a shorter question, or type it.";
        return;
      }
      serverRecordingChunks.push(event.data);
    };
    recorder.onerror = () => {
      const unexpected = recordingRun === serverRecordingRun
        && activeMediaRecorder === recorder && !discardServerRecording;
      if (unexpected) {
        recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "recording-failed" });
        if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
      }
      if (activeMediaRecorder === recorder) stopServerRecording(true);
      if (unexpected) statusLine.textContent = "Recording failed. Try again or type your question.";
    };
    let stopDeadline = null;
    clearStopDeadline = () => {
      if (stopDeadline !== null) window.clearTimeout(stopDeadline);
      stopDeadline = null;
    };
    const finishRecording = () => {
      // Cancellation invalidates transcript delivery, but this recorder still owns cleanup.
      if (activeMediaRecorder !== recorder) return;
      clearStopDeadline();
      // Some browsers stop the recorder before delivering the track's ended event.
      if (audioTracks.some((track) => track.readyState === "ended")) captureEnded();
      clearStopDeadline();
      detachTrackListeners();
      if (serverRecordingTimer !== null) {
        window.clearTimeout(serverRecordingTimer);
        serverRecordingTimer = null;
      }
      const discard = discardServerRecording || recordingRun !== serverRecordingRun;
      const audio = discard ? null : new Blob(serverRecordingChunks, { type: recorder.mimeType });
      serverRecordingChunks = [];
      activeMediaRecorder = null;
      activeRecordingStop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      stream.getTracks().forEach((track) => track.stop());
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
    recorder.onstop = finishRecording;
    activeRecordingStop = () => {
      if (activeMediaRecorder !== recorder || stopDeadline !== null) return;
      stopDeadline = window.setTimeout(() => {
        if (activeMediaRecorder !== recorder) return;
        const unexpected = recordingRun === serverRecordingRun && !discardServerRecording;
        discardServerRecording = true;
        if (unexpected) {
          recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "recording-stop-timeout" });
          if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
        }
        finishRecording();
        if (unexpected) statusLine.textContent = "The recording did not finish within 10 seconds and was discarded. Record again, or type your question.";
      }, 10_000);
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        const unexpected = recordingRun === serverRecordingRun && !discardServerRecording;
        discardServerRecording = true;
        if (unexpected) {
          recordedTranscriptionFailures.push({ language: recordingLanguage, reason: "recording-failed" });
          if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
        }
        finishRecording();
        if (unexpected) statusLine.textContent = "Recording could not finish. Record again, or type your question.";
      }
    };
    recorder.start(1000);
    updateServerTranscribeButton("recording");
    statusLine.textContent = `Recording in ${speechLanguageLabel(recordingLanguage)}. Tap Stop or speak for up to 20 seconds.`;
    serverRecordingTimer = window.setTimeout(() => {
      statusLine.textContent = "20-second recording limit reached. Transcribing your question.";
      stopServerRecording(false);
    }, 20_000);
  } catch (error) {
    clearStopDeadline();
    detachTrackListeners();
    stream?.getTracks().forEach((track) => track.stop());
    if (recordingRun !== serverRecordingRun || serverRecordingStartCancelled) return;
    const [reason, message] = recordingCaptureFailure(error);
    recordedTranscriptionFailures.push({ language: recordingLanguage, reason });
    if (recordedTranscriptionFailures.length > 500) recordedTranscriptionFailures.shift();
    activeMediaRecorder = null;
    activeRecordingStop = null;
    activeMediaStream = null;
    updateServerTranscribeButton();
    statusLine.textContent = message;
  } finally {
    window.clearTimeout(startupTimer);
    if (recordingRun === serverRecordingRun) serverRecordingStarting = false;
  }
}

async function readBoundedJson(response, signal, maxBytes = 128 * 1024) {
  if (!response.body) throw new Error("The server response body is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Request canceled.", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("The server response exceeded its size limit.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (signal.aborted) throw new DOMException("Request canceled.", "AbortError");
    return JSON.parse(text);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    // Parser errors can contain response text. Keep learner data out of UI errors.
    throw new Error("The server returned invalid JSON or exceeded the response size limit.");
  } finally {
    // Do not delay recovery on an unresponsive stream cancellation promise.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function transcribeRecordedAudio(audio, language) {
  const startedAt = performance.now();
  const controller = new AbortController();
  let timedOut = false;
  let failureReason = "transcription-failed";
  let configuredModel = null;
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
    const payload = await readBoundedJson(response, controller.signal).catch((error) => {
      if (error.name === "AbortError") throw error;
      failureReason = "invalid-transcript";
      throw new Error("The server returned an invalid transcription response.");
    });
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || (payload.configured_model !== undefined && (typeof payload.configured_model !== "string"
        || payload.configured_model.trim() !== payload.configured_model
        || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(payload.configured_model)))) {
      failureReason = "invalid-transcript";
      throw new Error("The server returned invalid transcription metadata.");
    }
    configuredModel = payload.configured_model ?? null;
    if (timedOut) throw new Error("Transcription timed out after 90 seconds.");
    if (!response.ok) {
      throw new Error(typeof payload?.error === "string" && payload.error.trim() && payload.error.length <= 2048
        ? payload.error : "Transcription failed.");
    }
    if (activeTranscriptionController !== controller) return;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || typeof payload.transcript !== "string") {
      failureReason = "invalid-transcript";
      throw new Error("The server returned an invalid transcription response.");
    }
    const transcript = payload.transcript.trim();
    if (!transcript) {
      failureReason = "empty-transcript";
      throw new Error("The transcription provider returned an empty transcript.");
    }
    // Avoid constructing a code-point array for an already oversized UTF-16 string.
    if (transcript.length > 12_000 || [...transcript].length > 6000) {
      failureReason = "transcript-too-long";
      throw new Error("The transcript exceeded the 6,000-character review limit. Record a shorter clip.");
    }
    input.value = transcript;
    input.focus();
    recordedTranscriptionSamples.push({ language, configuredModel, elapsedMs: performance.now() - startedAt });
    if (recordedTranscriptionSamples.length > 500) recordedTranscriptionSamples.shift();
    statusLine.textContent = input.value.length > input.maxLength
      ? `Transcript ready. Shorten it to ${input.maxLength} characters before sending. ${recordedTranscriptionTimingSummary(language)}`
      : `Transcript ready. Review it, then ask. ${recordedTranscriptionTimingSummary(language)}`;
  } catch (error) {
    if ((error.name !== "AbortError" || timedOut) && activeTranscriptionController === controller) {
      recordedTranscriptionFailures.push({ language, configuredModel, reason: timedOut ? "transcription-timeout" : failureReason });
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

function markSpeechIncomplete(entry = activeSpeechHistoryEntry) {
  if (!entry || !history.includes(entry)) return;
  const note = "\n[Speech playback stopped before completion; the learner may not have heard the full answer.]";
  if (!entry.content.endsWith(note)) {
    entry.content = [...entry.content].slice(0, 3000 - [...note].length).join("") + note;
  }
}

function stopSpeechOutput(reason = "other-control") {
  const startedAt = performance.now();
  const snapshot = {
    started_at_utc: new Date().toISOString(),
    reason,
    speech_turn: speechTurn,
    browser_speaking: window.speechSynthesis?.speaking === true,
    browser_pending: window.speechSynthesis?.pending === true,
    provider_request_active: Boolean(activeSpeechController),
    scheduled_pcm_sources: scheduledSpeechSources.size,
    progressive_session_active: Boolean(activeProgressiveSpeech),
  };
  const speechPending = activeSpeechController || scheduledSpeechSources.size
    || activeBrowserSpeechDeadline || activeProgressiveSpeech?.isSpeaking()
    || window.speechSynthesis?.speaking || window.speechSynthesis?.pending;
  if (speechPending) markSpeechIncomplete();
  activeSpeechHistoryEntry = null;
  speechTurn += 1;
  activeBrowserSpeechDeadline?.clear();
  activeProgressiveSpeech?.cancel();
  activeProgressiveSpeech = null;
  window.speechSynthesis?.cancel();
  activeSpeechController?.abort();
  activeSpeechController = null;
  let sourceStopExceptions = 0;
  scheduledSpeechSources.forEach((source) => {
    try { source.stop(); } catch { sourceStopExceptions += 1; /* The source may already have ended. */ }
  });
  scheduledSpeechSources.clear();
  if (speechPending) {
    speechStopSamples.push({ ...snapshot,
      stop_dispatch_ms: Number((performance.now() - startedAt).toFixed(2)),
      source_stop_exceptions: sourceStopExceptions,
    });
    if (speechStopSamples.length > 500) speechStopSamples.shift();
  }
}

function prepareStreamingAudio() {
  if (!streamedTtsOption.checked) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  speechAudioContext ||= new AudioContextClass({ sampleRate: 24000 });
  speechAudioContext.resume().catch(() => {});
  return speechAudioContext;
}

function stopTutor({ preserveLive = false, speechStopReason = "other-control" } = {}) {
  stopSpeechOutput(speechStopReason);
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
    "browser-start-timeout": "Browser speech did not start within 30 seconds. Try the voice preview or read the answer above.",
    "browser-playback-timeout": "A browser speech chunk did not finish within 120 seconds. Playback stopped; read the answer above or try another voice.",
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
  const getRecordedSttGroup = (sample) => {
    const configuredModel = sample.configuredModel ?? null;
    const key = JSON.stringify([sample.language, configuredModel]);
    if (!recordedSttGroups.has(key)) {
      recordedSttGroups.set(key, { language: sample.language, configuredModel, completed: [], failures: 0, failure_reasons: {} });
    }
    return recordedSttGroups.get(key);
  };
  recordedTranscriptionSamples.forEach((sample) => getRecordedSttGroup(sample).completed.push(sample));
  recordedTranscriptionFailures.forEach((sample) => {
    const group = getRecordedSttGroup(sample);
    group.failures += 1;
    group.failure_reasons[sample.reason] = (group.failure_reasons[sample.reason] || 0) + 1;
  });
  const recordedStt = [...recordedSttGroups.values()]
    .sort((left, right) => left.language.localeCompare(right.language)
      || (left.configuredModel || "").localeCompare(right.configuredModel || ""))
    .map((group) => ({
      language: group.language,
      configured_model: group.configuredModel,
      completed_count: group.completed.length,
      failure_count: group.failures,
      failure_reasons: group.failure_reasons,
      upload_to_result: percentiles(group.completed.map((sample) => sample.elapsedMs)),
    }));
  const liveSttGroups = new Map();
  liveTranscriptionAttempts.forEach((attempt) => {
    const key = JSON.stringify([attempt.language, attempt.model, attempt.auto_finish_requested, attempt.pause_detection_used, attempt.continuous, attempt.connection_reused, attempt.quiet_pause_ms, attempt.capture_limit_ms]);
    if (!liveSttGroups.has(key)) {
      liveSttGroups.set(key, {
        language: attempt.language,
        model: attempt.model,
        auto_finish_requested: attempt.auto_finish_requested,
        quiet_pause_ms: attempt.quiet_pause_ms,
        capture_limit_ms: attempt.capture_limit_ms,
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
        configuration: { transcription_delay: "low", capture_limit_s: group.capture_limit_ms / 1000, quiet_pause_s: group.quiet_pause_ms / 1000,
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
    schema_version: 13,
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
    speech_stops: speechStopSamples.slice(),
    speech_stop_timing_scope: "Local stop command dispatch only; excludes speech detection and does not measure audible audio-stop latency.",
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

function flushLongSpeechBuffer(text, maxCodePoints, enqueue) {
  const characters = [...text];
  let offset = 0;
  while (characters.length - offset > maxCodePoints) {
    let end = offset + maxCodePoints;
    while (end > offset && !/\s/u.test(characters[end])) end -= 1;
    if (end === offset) end = offset + maxCodePoints;
    const chunk = characters.slice(offset, end).join("").trim();
    if (chunk) enqueue(chunk);
    offset = end;
  }
  return characters.slice(offset).join("");
}

function speak(text, completionText = "Ready when you are.", kind = "tutor", historyEntry = null) {
  stopSpeechOutput();
  activeSpeechHistoryEntry = historyEntry;
  if (streamedTtsOption.checked && streamingTtsAvailable) {
    if (text.length > 4096) {
      const session = createProgressiveStreamedSpeech(completionText);
      if (session) {
        activeProgressiveSpeech = session;
        session.consume(text);
        session.finish();
        return;
      }
      statusLine.textContent = "This browser cannot start segmented streamed speech; using the browser voice.";
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
  let overallTimedOut = false;
  let audioLimitExceeded = false;
  let audioBytes = 0;
  const overallTimer = window.setTimeout(() => {
    overallTimedOut = true;
    controller.abort();
  }, 420_000);
  let idleTimer = null;
  let playbackTimer = null;
  let speechReader = null;
  let speechReadEnded = false;
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
      if (overallTimedOut) throw new Error("Streamed speech exceeded its seven-minute request deadline.");
      if (timedOut) throw new Error("Streamed speech timed out.");
      return;
    }
    speechReader = response.body.getReader();
    let pending = new Uint8Array(0);
    let audioChunks = 0;
    const waitForPlayback = () => new Promise((resolve, reject) => {
      const onAbort = () => {
        window.clearTimeout(timer);
        controller.signal.removeEventListener("abort", onAbort);
        reject(new DOMException("Speech stopped.", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        controller.signal.removeEventListener("abort", onAbort);
        resolve();
      }, 50);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      if (controller.signal.aborted) onAbort();
    });
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
      const { value, done } = await speechReader.read();
      if (done) { speechReadEnded = true; break; }
      if (!value.length) continue;
      audioBytes += value.byteLength;
      if (audioBytes > MAX_SPEECH_PCM_BYTES) {
        audioLimitExceeded = true;
        throw new Error("Streamed audio exceeded the five-minute per-request limit.");
      }
      resetIdleDeadline();
      const combined = new Uint8Array(pending.length + value.length);
      combined.set(pending);
      combined.set(value, pending.length);
      const usableLength = combined.length - (combined.length % 2);
      // Schedule at most five seconds ahead, in buffers no longer than half a second.
      // Pausing reads here limits Web Audio allocation, not browser/network buffering.
      const maxBufferBytes = Math.floor(sampleRate * 0.5) * 2;
      for (let offset = 0; offset < usableLength; offset += maxBufferBytes) {
        let previousPlaybackTime = context.currentTime;
        while (nextStartAt - context.currentTime > 5) {
          await waitForPlayback();
          if (context.currentTime > previousPlaybackTime) resetIdleDeadline();
          previousPlaybackTime = context.currentTime;
        }
        if (controller.signal.aborted || requestSpeechTurn !== speechTurn) {
          throw new DOMException("Speech stopped.", "AbortError");
        }
        queuePcm(combined.subarray(offset, Math.min(usableLength, offset + maxBufferBytes)));
      }
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
    if (overallTimedOut) throw new Error("Streamed speech exceeded its seven-minute request deadline.");
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
    if ((error.name === "AbortError" && !timedOut && !playbackTimedOut && !overallTimedOut) || requestSpeechTurn !== speechTurn) return;
    controller.abort();
    requestSources.forEach((source) => {
      try { source.stop(); } catch { /* The source may already have ended. */ }
      scheduledSpeechSources.delete(source);
    });
    requestSources.clear();
    speechFailures.push({ ...sample, reason: overallTimedOut ? "overall-timeout" : audioLimitExceeded ? "audio-limit" : playbackTimedOut ? "playback-timeout" : timedOut ? "stream-timeout" : "stream-failed" });
    if (speechFailures.length > 500) speechFailures.shift();
    const message = overallTimedOut ? "Streamed speech exceeded its seven-minute request deadline."
      : playbackTimedOut ? "Audio playback stalled. Try again or reload the page."
      : timedOut ? "Streamed speech stopped progressing for 90 seconds." : error.message;
    if (firstAudioAt === null && allowFallback) {
      statusLine.textContent = `${message} Falling back to the browser voice.`;
      speakWithBrowser(text, completionText, kind);
    } else {
      markSpeechIncomplete();
      statusLine.textContent = `${message} Streamed speech stopped.`;
    }
    return false;
  } finally {
    window.clearTimeout(overallTimer);
    window.clearTimeout(idleTimer);
    window.clearTimeout(playbackTimer);
    if (speechReader) {
      if (!speechReadEnded) void speechReader.cancel().catch(() => {});
      speechReader.releaseLock();
    }
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
          markSpeechIncomplete();
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
    buffer = flushLongSpeechBuffer(buffer, 1000, enqueue);
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

function createBrowserSpeechDeadline(isCurrent, onTimeout) {
  let timer = null;
  const deadline = {
    clear: () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      if (activeBrowserSpeechDeadline === deadline) activeBrowserSpeechDeadline = null;
    },
    arm: (playing = false) => {
      deadline.clear();
      activeBrowserSpeechDeadline = deadline;
      timer = window.setTimeout(() => {
        deadline.clear();
        if (isCurrent()) onTimeout(playing ? "browser-playback-timeout" : "browser-start-timeout");
      }, playing ? 120_000 : 30_000);
    },
  };
  return deadline;
}

function speakWithBrowser(text, completionText = "Ready when you are.", kind = "tutor") {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    markSpeechIncomplete();
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
  const fail = (reason) => {
    if (requestSpeechTurn !== speechTurn || failed) return;
    failed = true;
    deadline.clear();
    markSpeechIncomplete();
    speechFailures.push({ ...sample, reason });
    if (speechFailures.length > 500) speechFailures.shift();
    statusLine.textContent = `${speechErrorMessage(reason)} ${speechTimingSummary(sample)}`;
    window.speechSynthesis.cancel();
  };
  const deadline = createBrowserSpeechDeadline(() => requestSpeechTurn === speechTurn && !failed, fail);
  deadline.arm();
  chunks.forEach((chunk, index) => {
    if (failed) return;
    const utterance = new SpeechSynthesisUtterance(chunk);
    let chunkStarted = false;
    let chunkEnded = false;
    utterance.lang = speechLanguage.value;
    utterance.rate = speechRate;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => {
      if (requestSpeechTurn !== speechTurn || failed || chunkStarted || chunkEnded) return;
      chunkStarted = true;
      deadline.arm(true);
      if (startedAt !== null) return;
      startedAt = performance.now();
      recordAutomaticVoiceTurnStart(sample, startedAt);
      const startDelay = ((startedAt - queuedAt) / 1000).toFixed(2);
      statusLine.textContent = `Tutor is speaking (started in ${startDelay}s). Tap Stop audio or Speak to interrupt.`;
    };
    utterance.onend = () => {
      if (requestSpeechTurn !== speechTurn || failed || chunkEnded) return;
      chunkEnded = true;
      if (index !== chunks.length - 1) {
        deadline.arm();
        return;
      }
      deadline.clear();
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
      if (chunkEnded) return;
      fail(event.error || "unknown");
    };
    try { window.speechSynthesis.speak(utterance); } catch { fail("synthesis-failed"); }
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

  const fail = (reason) => {
    if (requestSpeechTurn !== speechTurn || failed || cancelled) return;
    failed = true;
    deadline.clear();
    buffer = "";
    queuedCount = 0;
    markSpeechIncomplete();
    speechFailures.push({ ...sample, reason });
    if (speechFailures.length > 500) speechFailures.shift();
    statusLine.textContent = `${speechErrorMessage(reason)} ${speechTimingSummary(sample)}`;
    window.speechSynthesis.cancel();
  };
  const deadline = createBrowserSpeechDeadline(
    () => requestSpeechTurn === speechTurn && !failed && !cancelled, fail,
  );

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
      let chunkStarted = false;
      let chunkEnded = false;
      utterance.lang = language;
      utterance.rate = speechRate;
      if (selectedVoice) utterance.voice = selectedVoice;
      if (queuedCount === 0) deadline.arm();
      queuedCount += 1;
      hadQueuedSpeech = true;
      utterance.onstart = () => {
        if (requestSpeechTurn !== speechTurn || failed || cancelled || chunkStarted || chunkEnded) return;
        chunkStarted = true;
        deadline.arm(true);
        if (startedAt !== null) return;
        startedAt = performance.now();
        recordAutomaticVoiceTurnStart(sample, startedAt);
        const startDelay = ((startedAt - queuedAt) / 1000).toFixed(2);
        statusLine.textContent = `Tutor is speaking as the answer arrives (started in ${startDelay}s). Tap Stop audio or Speak to interrupt.`;
      };
      utterance.onend = () => {
        if (requestSpeechTurn !== speechTurn || failed || cancelled || chunkEnded) return;
        chunkEnded = true;
        queuedCount = Math.max(0, queuedCount - 1);
        if (queuedCount) deadline.arm();
        else deadline.clear();
        complete();
      };
      utterance.onerror = (event) => {
        if (chunkEnded) return;
        fail(event.error || "unknown");
      };
      try { window.speechSynthesis.speak(utterance); } catch { fail("synthesis-failed"); }
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
    buffer = flushLongSpeechBuffer(buffer, 500, enqueue);
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
    cancel: () => { cancelled = true; buffer = ""; deadline.clear(); },
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
  stopSpeechOutput("follow-up");
  const requestTurn = ++turn;
  preserveInterruptedTurn();
  activeRequest?.abort();
  activeRequest = new AbortController();
  const controller = activeRequest;
  const requestLanguage = speechLanguage.value;
  const requestStartedAt = performance.now();
  const clientStartedAtUtc = new Date().toISOString();
  let timeoutReason = null;
  let idleTimer = null;
  const expire = (reason) => {
    if (controller.signal.aborted) return;
    timeoutReason = reason;
    controller.abort();
  };
  const resetIdleDeadline = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => expire("idle"), 90_000);
  };
  resetIdleDeadline();
  const totalTimer = window.setTimeout(() => expire("total"), 300_000);
  let requestId = null;
  let traceRecorded = false;
  const recordTrace = (outcome, trace = null) => {
    if (traceRecorded) return;
    const serverMetadataStatus = trace == null ? "unavailable" : validTutorTrace(trace) ? "valid" : "invalid";
    if (serverMetadataStatus !== "valid") trace = null;
    traceRecorded = true;
    tutorTurnTraces.push({
      server_metadata_status: serverMetadataStatus,
      request_id: trace?.request_id || requestId,
      started_at_utc: trace?.started_at_utc || clientStartedAtUtc,
      outcome,
      language: requestLanguage,
      client_duration_ms: Number((performance.now() - requestStartedAt).toFixed(2)),
      server_duration_ms: trace?.server_duration_ms ?? null,
      mode: trace?.mode ?? null,
      configured_model: trace?.configured_model ?? null,
      provider_reported_models: trace?.provider_reported_models?.slice() ?? null,
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
    renderTutorTraces();
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
      body: JSON.stringify({ question, history: history.slice(-20), language: requestLanguage,
        quiz_difficulty: quizDifficulty.value }),
      signal: controller.signal,
    });
    requestId = response.headers.get("X-Request-ID");
    resetIdleDeadline();
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
    }, resetIdleDeadline, (sources) => {
      if (requestTurn !== turn || controller.signal.aborted || !sources.length) return;
      if (!activePartialMessage) activePartialMessage = addMessage("assistant", "", sources, "RETRIEVED NOTES");
    });
    window.clearTimeout(idleTimer);
    window.clearTimeout(totalTimer);
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
    const answerHistoryEntry = rememberTurn(question, payload.answer);
    addMessage("assistant", payload.answer, payload.sources || [], "STUDY SOURCE", { historyEntry: answerHistoryEntry }, payload.trace);
    if (progressiveSpeech?.hasFailed()) markSpeechIncomplete(answerHistoryEntry);
    if (usedProgressiveSpeech && !progressiveSpeech?.hasFailed()) activeSpeechHistoryEntry = answerHistoryEntry;
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
        difficulty: startedQuiz.result.difficulty || "standard",
        index: 0,
        results: [],
        awaitingAnswer: false,
      };
      showQuizQuestion(false);
      speak(`${payload.answer} ${quizSession.questions[0].prompt}`, "Your answer is ready when you are.", "tutor", answerHistoryEntry);
    } else if (scoredAnswer) {
      const score = scoredAnswer.result;
      addMessage("assistant", `${score.feedback} Score: ${score.score}%.`, [score.source], "STUDY SOURCE", {});
      speak(`${payload.answer} ${score.feedback}`, "Answer ready.", "tutor", answerHistoryEntry);
      loadProgress();
    } else if (!usedProgressiveSpeech) {
      speak(payload.answer, "Ready when you are.", "tutor", answerHistoryEntry);
    }
  } catch (error) {
    const cancelled = requestTurn !== turn || (error.name === "AbortError" && !timeoutReason);
    controller.abort();
    recordTrace(cancelled ? "cancelled" : "failed", error.trace);
    if (progressiveSpeech && requestTurn === turn && !cancelled) stopSpeechOutput("request-failed");
    if (modelModeAvailable) {
      modelStreamFailures.push({
        language: requestLanguage,
        model: modelName,
        reason: cancelled ? "cancelled" : "failed",
      });
      if (modelStreamFailures.length > 500) modelStreamFailures.shift();
    }
    if (!cancelled && requestTurn === turn) {
      activePartialMessage?.remove();
      activePartialMessage = null;
      pendingQuestion = null;
      const message = timeoutReason === "idle"
        ? "No tutor data arrived for 90 seconds. Try again or ask a shorter question."
        : timeoutReason === "total"
          ? "The tutor request reached its five-minute limit. Try again with a shorter question."
          : error.message;
      addMessage("assistant", message, [], "STUDY SOURCE", null, error.trace);
      rememberTurn(question, "The tutor request failed before an answer was produced.");
      statusLine.textContent = timeoutReason
        ? "Tutor request timed out. Your conversation is still open."
        : "Request failed. Your conversation is still open.";
    }
  } finally {
    window.clearTimeout(idleTimer);
    window.clearTimeout(totalTimer);
    if (requestTurn === turn) {
      sendButton.disabled = false;
      activeRequest = null;
    }
  }
}

async function startQuiz() {
  const difficulty = quizDifficulty.value;
  const questionCount = difficulty === "standard" ? 3 : 2;
  stopTutor();
  prepareStreamingAudio();
  const requestTurn = turn;
  const controller = new AbortController();
  activeRequest = controller;
  let timedOut = false;
  const deadlineTimer = window.setTimeout(() => {
    if (requestTurn !== turn || activeRequest !== controller) return;
    timedOut = true;
    controller.abort();
  }, 30_000);
  quizButton.disabled = true;
  nextQuestionButton.hidden = true;
  statusLine.textContent = `Preparing a ${questionCount}-question ${quizPresetLabels[difficulty]} quiz…`;
  try {
    const response = await apiFetch("/api/quiz/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "fundamental rights", question_count: questionCount,
        language: speechLanguage.value, difficulty }),
      signal: controller.signal,
    });
    const payload = await readBoundedJson(response, controller.signal, 1024 * 1024);
    if (timedOut) throw new Error("Quiz preparation timed out after 30 seconds. Try again.");
    if (!response.ok) throw new Error(payload?.error || "Could not start the quiz.");
    if (requestTurn !== turn) return;
    if (!validTutorToolEvents([{ name: "start_quiz", ok: true, result: payload }])
      || payload.difficulty !== difficulty || payload.questions.length !== questionCount) {
      throw new Error("The server returned an invalid quiz. Try starting it again.");
    }
    quizSession = { quizId: payload.quiz_id, difficulty: payload.difficulty,
      questions: payload.questions, index: 0, results: [], awaitingAnswer: false };
    input.value = "";
    showQuizQuestion();
  } catch (error) {
    if (requestTurn === turn) {
      addMessage("assistant", timedOut ? "Quiz preparation timed out after 30 seconds. Try again." : error.message);
      statusLine.textContent = "Quiz could not start. Your conversation is still open.";
    }
  } finally {
    window.clearTimeout(deadlineTimer);
    if (requestTurn === turn) {
      quizButton.disabled = false;
      if (quizSession && !quizSession.awaitingAnswer) nextQuestionButton.hidden = false;
    }
    if (activeRequest === controller) activeRequest = null;
  }
}

function normalizedQuizCommand(text) {
  return text.normalize("NFC").toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
}

function isEndQuizCommand(text) {
  return new Set([
    "end quiz", "stop quiz", "exit quiz", "quiz band karo", "quiz khatam karo",
    "क्विज बंद करो", "क्विज़ बंद करो", "क्विज खत्म करो", "क्विज़ खत्म करो",
  ]).has(normalizedQuizCommand(text));
}

function resetTutorComposer() {
  endQuizButton.hidden = true;
  nextQuestionButton.hidden = true;
  sendLabel.textContent = "Ask tutor";
  inputLabel.textContent = "Your question";
  input.maxLength = 1200;
  input.placeholder = "Type a question… e.g. Right to Equality kya hai?";
}

function endQuiz({ preserveLive = false, clearDraft = false } = {}) {
  if (!quizSession) return;
  const scoringPending = Boolean(quizSession.pendingAnswer);
  stopTutor({ preserveLive });
  quizSession = null;
  resetTutorComposer();
  if (clearDraft) input.value = "";
  const message = scoringPending
    ? "Quiz ended. The interrupted score may already be saved; check saved progress. You can ask the tutor a question."
    : "Quiz ended. Saved scores remain available. You can ask the tutor a question.";
  addMessage("assistant", message);
  statusLine.textContent = message;
  void loadProgress();
  input.focus();
}

function isNextQuizCommand(text) {
  const command = normalizedQuizCommand(text);
  return new Set([
    "next", "next question", "next question please", "please next question",
    "agla sawal", "agla sawaal", "agla prashn", "agla prashna", "agla sawal pucho",
    "अगला सवाल", "अगला प्रश्न", "अगला सवाल पूछो", "अगला प्रश्न पूछो",
  ]).has(command);
}

function showQuizQuestion(speakPrompt = true) {
  if (!quizSession || quizSession.index >= quizSession.questions.length) return;
  endQuizButton.hidden = false;
  const current = quizSession.questions[quizSession.index];
  quizSession.awaitingAnswer = true;
  nextQuestionButton.hidden = true;
  sendLabel.textContent = "Submit answer";
  inputLabel.textContent = "Your quiz answer";
  input.maxLength = 1000;
  input.placeholder = "Speak or type your answer…";
  const prompt = `${quizPresetLabels[quizSession.difficulty || "standard"]} quiz · Question ${quizSession.index + 1} of ${quizSession.questions.length}: ${current.prompt}`;
  const promptHistoryEntry = rememberMessage("assistant", prompt, [current.source]);
  addMessage("assistant", prompt, [current.source], "QUIZ QUESTION SOURCE", { historyEntry: promptHistoryEntry });
  const readyText = activeLiveTranscription?.continuous
    ? "Speak your answer. After feedback, say next question or agla sawal. Say end quiz or quiz band karo to return to tutoring."
    : "Your answer is ready when you are.";
  statusLine.textContent = readyText;
  if (speakPrompt) speak(current.prompt, readyText, "tutor", promptHistoryEntry);
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
  let timedOut = false;
  const deadlineTimer = window.setTimeout(() => {
    if (requestTurn !== turn || activeRequest !== controller) return;
    timedOut = true;
    controller.abort();
  }, 30_000);
  sendButton.disabled = true;
  micButton.disabled = true;
  statusLine.textContent = "Checking your answer against the rubric…";
  const answerHistoryEntry = rememberMessage("user", answer, [current.source]);
  addMessage("user", answer, [current.source], "QUIZ QUESTION SOURCE", { historyEntry: answerHistoryEntry });
  try {
    const response = await apiFetch("/api/quiz/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizSession.quizId, question_id: current.id, idempotency_key: current.idempotencyKey, answer, language: speechLanguage.value }),
      signal: controller.signal,
    });
    const result = await readBoundedJson(response, controller.signal, 1024 * 1024);
    if (timedOut) throw new Error("Scoring timed out after 30 seconds.");
    if (!response.ok) throw new Error(result?.error || "Could not score the answer.");
    if (requestTurn !== turn) return;
    if (!validTutorToolEvents([{ name: "score_answer", ok: true, result }]) || result.question_id !== current.id) {
      throw new Error("The server returned an invalid score response. Your answer remains available for retry.");
    }
    quizSession.pendingAnswer = "";
    quizSession.results.push(result);
    loadProgress();
    const feedback = `${result.feedback} Score: ${result.score}%.`;
    const feedbackHistoryEntry = rememberMessage("assistant", feedback, [result.source]);
    addMessage("assistant", feedback, [result.source], "STUDY SOURCE", { historyEntry: feedbackHistoryEntry });
    quizSession.index += 1;
    const isLast = quizSession.index >= quizSession.questions.length;
    const completeCount = quizSession.results.filter((item) => item.complete).length;
    if (isLast) {
      const totalQuestions = quizSession.questions.length;
      quizSession = null;
      resetTutorComposer();
      statusLine.textContent = `Quiz complete: ${completeCount} of ${totalQuestions} answers covered the rubric. Results are saved for this browser.`;
      speak(feedback, statusLine.textContent, "tutor", feedbackHistoryEntry);
    } else {
      const nextStep = activeLiveTranscription?.continuous
        ? "say next question or agla sawal, or tap Next question"
        : "tap Next question";
      statusLine.textContent = `Answer checked. ${quizSession.index} of ${quizSession.questions.length} complete; ${nextStep} when ready.`;
      nextQuestionButton.hidden = false;
      speak(feedback, statusLine.textContent, "tutor", feedbackHistoryEntry);
    }
  } catch (error) {
    if (requestTurn === turn) {
      quizSession.awaitingAnswer = true;
      quizSession.pendingAnswer = "";
      if (!input.value.trim()) input.value = answer;
      const message = timedOut
        ? "Scoring timed out after 30 seconds. The score may already be saved. Retry the same answer to check it."
        : error.message;
      rememberMessage("assistant", message, [current.source]);
      addMessage("assistant", message);
      statusLine.textContent = message.toLowerCase().includes("already saved")
        ? "This quiz question already has a saved score. Start a new quiz to try a revised answer."
        : "Scoring failed. You can try submitting the answer again.";
      input.focus();
    }
  } finally {
    window.clearTimeout(deadlineTimer);
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
  if (!question) return;
  if (quizSession && isEndQuizCommand(question)) {
    endQuiz({ clearDraft: true });
    return;
  }
  if (sendButton.disabled) return;
  if (question.length > input.maxLength) {
    const responseName = quizSession ? "answer" : "question";
    statusLine.textContent = `This ${responseName} is over the ${input.maxLength}-character limit. Edit it before sending.`;
    return;
  }
  if (quizSession) {
    if (!quizSession.awaitingAnswer) {
      statusLine.textContent = "Tap Next question to continue the quiz, or End quiz to return to tutoring.";
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
  stopTutor({ speechStopReason: "stop-button" });
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
  stopTutor({ speechStopReason: "escape" });
  statusLine.textContent = stoppingQuizScore
    ? "Quiz scoring stopped. Your answer is ready to retry."
    : "Tutor turn stopped. You can continue the conversation.";
});

document.querySelector("#clear-button").addEventListener("click", () => {
  stopTutor();
  quizSession = null;
  history.length = 0;
  conversationMessages.length = 0;
  input.value = "";
  conversation.replaceChildren();
  addMessage("assistant", "Namaste! Fundamental Rights ke baare mein kya jaan-na hai?");
  resetTutorComposer();
  statusLine.textContent = "New session started.";
  input.focus();
});

quizButton.addEventListener("click", startQuiz);
nextQuestionButton.addEventListener("click", showQuizQuestion);
endQuizButton.addEventListener("click", () => endQuiz());

function validSavedProgress(progress) {
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const score = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  const text = (value, limit) => typeof value === "string" && Boolean(value.trim()) && value.length <= limit;
  if (!object(progress) || !Number.isSafeInteger(progress.attempt_count) || progress.attempt_count < 0
    || !Array.isArray(progress.questions) || progress.questions.length > 1000
    || !Array.isArray(progress.weak_topics) || progress.weak_topics.length > 1000) return false;
  if (progress.attempt_count === 0) {
    return progress.average_score === null && !progress.questions.length && !progress.weak_topics.length;
  }
  if (!score(progress.average_score) || !progress.questions.length) return false;
  const questions = new Map();
  let attempts = 0;
  for (const question of progress.questions) {
    if (!object(question) || !text(question.question_id, 128) || !text(question.topic, 256)
      || questions.has(question.question_id)
      || !Number.isSafeInteger(question.attempts) || question.attempts < 1
      || !score(question.average_score) || !score(question.latest_score)
      || typeof question.latest_complete !== "boolean"
      || !text(question.last_attempt_at, 64)
      || !/(?:Z|\+00:00)$/.test(question.last_attempt_at)
      || !Number.isFinite(Date.parse(question.last_attempt_at))) return false;
    attempts += question.attempts;
    if (!Number.isSafeInteger(attempts)) return false;
    questions.set(question.question_id, question);
  }
  if (attempts !== progress.attempt_count) return false;
  const expectedWeak = [...questions.values()].filter((question) =>
    !question.latest_complete || question.latest_score < 70
  );
  if (expectedWeak.length !== progress.weak_topics.length) return false;
  const seenWeak = new Set();
  return progress.weak_topics.every((topic) => {
    if (!object(topic) || seenWeak.has(topic.question_id)) return false;
    const question = questions.get(topic.question_id);
    if (!question || (question.latest_complete && question.latest_score >= 70)) return false;
    seenWeak.add(topic.question_id);
    return ["topic", "attempts", "average_score", "latest_score", "latest_complete", "last_attempt_at"]
      .every((field) => topic[field] === question[field]);
  });
}

async function loadProgress() {
  if (clearingProgress) return;
  const requestId = ++progressRequestId;
  activeProgressController?.abort();
  const controller = new AbortController();
  activeProgressController = controller;
  let timedOut = false;
  let invalidProgress = false;
  const deadline = window.setTimeout(() => {
    if (requestId !== progressRequestId || activeProgressController !== controller) return;
    timedOut = true;
    controller.abort();
  }, 20_000);
  weakTopics.replaceChildren();
  progressSummary.textContent = "Loading saved results…";
  try {
    const response = await apiFetch("/api/progress", { signal: controller.signal });
    if (requestId !== progressRequestId) return;
    const progress = await readBoundedJson(response, controller.signal, 1024 * 1024);
    if (requestId !== progressRequestId) return;
    if (timedOut) throw new Error("Progress request timed out.");
    if (!response.ok) throw new Error(progress?.error || "Could not load saved results.");
    if (!validSavedProgress(progress)) {
      invalidProgress = true;
      throw new Error("Saved progress data was invalid.");
    }
    if (!progress.attempt_count) {
      progressSummary.textContent = "No saved quiz answers yet. Complete a quiz to build your revision list.";
      return;
    }
    progressSummary.textContent = `${progress.attempt_count} saved answer${progress.attempt_count === 1 ? "" : "s"} · ${progress.average_score}% average score`;
    for (const topic of progress.weak_topics) {
      const item = document.createElement("li");
      item.textContent = `${topic.topic}: ${topic.latest_score}% on the latest try (${topic.attempts} attempt${topic.attempts === 1 ? "" : "s"})`;
      const articleNumber = /^art(\d+[a-z]?)_/i.exec(topic.question_id)?.[1];
      if (articleNumber) {
        const reviseButton = document.createElement("button");
        reviseButton.type = "button";
        reviseButton.className = "text-button";
        reviseButton.textContent = `Revise Article ${articleNumber}`;
        reviseButton.title = "Open an explanation with current speech settings; ends an active quiz";
        reviseButton.addEventListener("click", () => {
          if (!item.isConnected) return;
          if (quizSession) endQuiz({ clearDraft: true });
          else stopTutor();
          input.value = "";
          void sendQuestion(`Explain Article ${articleNumber}.`);
        });
        item.append(reviseButton);
      }
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
    progressSummary.textContent = timedOut
      ? "Saved progress did not load within 20 seconds. Check the local server and refresh results."
      : invalidProgress ? "Saved progress data was invalid. Refresh results or check the local server."
        : "Saved progress could not load. Check that the local server is running.";
  } finally {
    window.clearTimeout(deadline);
    if (activeProgressController === controller) activeProgressController = null;
  }
}

progressRefreshButton.addEventListener("click", loadProgress);
clearProgressButton.addEventListener("click", async () => {
  if (clearingProgress) return;
  if (!window.confirm("Delete saved quiz scores for this browser?")) return;
  clearingProgress = true;
  ++progressRequestId;
  activeProgressController?.abort();
  activeProgressController = null;
  const controller = new AbortController();
  let timedOut = false;
  const deadline = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);
  weakTopics.replaceChildren();
  progressSummary.textContent = "Clearing saved results…";
  progressRefreshButton.disabled = true;
  clearProgressButton.disabled = true;
  try {
    const response = await apiFetch("/api/progress", { method: "DELETE", signal: controller.signal });
    if (timedOut) throw new Error("Progress deletion timed out.");
    if (!response.ok) throw new Error("Could not clear saved results.");
    statusLine.textContent = "Saved quiz progress cleared.";
  } catch (error) {
    statusLine.textContent = timedOut
      ? "Clearing progress timed out after 20 seconds. Scores may already be deleted; checking saved results."
      : error.message;
  } finally {
    window.clearTimeout(deadline);
    clearingProgress = false;
    progressRefreshButton.disabled = false;
    clearProgressButton.disabled = false;
  }
  await loadProgress();
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
  const armDeadline = (duration, reason) => {
    clearRecognitionDeadline();
    recognitionDeadlineTimer = window.setTimeout(() => {
      if (run !== recognitionRun || !recognitionListening) return;
      const hadFinalResult = recognitionHadFinalResult;
      stopRecognition(true);
      recognitionFailures.push({ language: capture.lang, reason });
      if (recognitionFailures.length > 500) recognitionFailures.shift();
      const message = reason === "start-timeout"
        ? "Voice input did not start within 45 seconds. Try again or type instead."
        : hadFinalResult
          ? "Voice input reached its 60-second limit. Review the final words, then send."
          : "Voice input reached its 60-second limit without final words. Your previous draft was restored. Try again or type instead.";
      statusLine.textContent = `${message} ${recognitionTimingSummary(capture.lang)}`;
    }, duration);
  };
  capture.onstart = () => {
    if (run !== recognitionRun || !recognitionListening) {
      capture.abort();
      return;
    }
    updateMicrophoneButton(true);
    recognitionStartedAt = performance.now();
    recognitionHadFinalResult = false;
    armDeadline(60_000, "listening-timeout");
    statusLine.textContent = "Listening… speak now.";
  };
  capture.onresult = (event) => {
    if (run !== recognitionRun || !recognitionListening) return;
    const transcriptParts = [];
    const finalParts = [];
    let transcriptCharacters = 0;
    for (let i = 0; i < event.results.length; i += 1) {
      const part = event.results[i][0].transcript.trim();
      transcriptCharacters += part.length + (part && transcriptParts.length ? 1 : 0);
      if (transcriptCharacters > 6000) {
        stopRecognition(true);
        recognitionFailures.push({ language: capture.lang, reason: "transcript-too-long" });
        if (recognitionFailures.length > 500) recognitionFailures.shift();
        statusLine.textContent = "Voice input exceeded the 6,000-character review limit. Earlier confirmed words or your previous draft were kept. Record a shorter question or type instead.";
        return;
      }
      if (part) transcriptParts.push(part);
      if (event.results[i].isFinal && part) finalParts.push(part);
    }
    if (finalParts.length && !recognitionHadFinalResult && recognitionStartedAt !== null) {
      recognitionHadFinalResult = true;
      const elapsedMs = performance.now() - recognitionStartedAt;
      recognitionSamples.push({ language: capture.lang, firstFinalMs: elapsedMs });
      if (recognitionSamples.length > 500) recognitionSamples.shift();
      const elapsed = (elapsedMs / 1000).toFixed(2);
      statusLine.textContent = `Final transcript received in ${elapsed}s. Review it, then ask. `
        + recognitionTimingSummary(capture.lang);
    }
    if (finalParts.length) finalTranscript = finalParts.join(" ");
    input.value = finalTranscript || transcriptParts.join(" ");
    if (finalTranscript.length > input.maxLength) {
      statusLine.textContent = `Final transcript received. Shorten it to ${input.maxLength} characters before sending.`;
    }
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
    clearRecognitionDeadline();
    const wasListening = recognitionListening;
    recognitionListening = false;
    updateMicrophoneButton(false);
    if (wasListening && !recognitionHadFinalResult) {
      input.value = inputBeforeListening;
      const language = capture.lang;
      recognitionFailures.push({ language, reason: "no-final-transcript" });
      if (recognitionFailures.length > 500) recognitionFailures.shift();
      statusLine.textContent = `No final transcript was received; partial words were discarded. Try again or type. ${recognitionTimingSummary(language)}`;
    } else if (wasListening && recognitionHadFinalResult && input.value.length > input.maxLength) {
      statusLine.textContent = `Final transcript received. Shorten it to ${input.maxLength} characters before sending.`;
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
    armDeadline(45_000, "start-timeout");
    capture.start();
  } catch (error) {
    clearRecognitionDeadline();
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
      stopTutor({ preserveLive: true, speechStopReason: "detected-speech" });
      input.value = "";
      statusLine.textContent = "Listening to your new turn. Previous tutor output stopped.";
    },
    final: (text) => {
      if (run !== liveSttRun) return;
      input.value = text;
      if (continuous) {
        if (quizSession && isEndQuizCommand(text)) {
          endQuiz({ preserveLive: true, clearDraft: true });
          liveSttOriginalInput = "";
          return;
        }
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
  }, { autoFinish: liveAutoFinish.checked, continuous, quietPauseMs: Number(liveQuietPause.value), captureLimitMs: Number(liveCaptureLimit.value) });
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
function stopHiddenPageInput() {
  const active = recognitionListening || activeLiveTranscription || serverRecordingStarting
    || activeMediaRecorder || activeMediaStream || activeTranscriptionController;
  if (!active) return false;
  // Restore unconfirmed drafts and block late transcripts before releasing capture.
  stopRecognition(true);
  serverRecordingStartCancelled = true;
  serverRecordingRun += 1;
  serverRecordingStarting = false;
  if (activeMediaRecorder) stopServerRecording(true);
  // Release tracks now; a hidden/frozen page may delay the recorder's onstop event.
  activeMediaStream?.getTracks().forEach((track) => track.stop());
  const controller = activeTranscriptionController;
  activeTranscriptionController = null;
  controller?.abort();
  updateServerTranscribeButton(activeMediaRecorder ? "busy" : "idle");
  return true;
}

window.addEventListener("pagehide", () => {
  // A cached page can resume later. Invalidate its old turn and speech queues
  // before suspension, rather than letting delayed output restart on return.
  stopHiddenPageInput();
  stopTutor();
  statusLine.textContent = "Active study work stopped when leaving the page. Review your draft or start a new turn when ready.";
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden || !stopHiddenPageInput()) return;
  statusLine.textContent = "Speech input canceled when the page was hidden. Review your draft or start the microphone again when ready.";
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

async function readServerHealth() {
  const controller = new AbortController();
  const deadline = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await apiFetch("/health", { signal: controller.signal });
    const health = await readBoundedJson(response, controller.signal);
    if (!response.ok) throw new Error("The local server is not ready.");
    if (!health || typeof health !== "object" || Array.isArray(health) || health.ok !== true
      || !["offline", "model"].includes(health.mode)
      || !Number.isSafeInteger(health.study_notes) || health.study_notes < 1 || health.study_notes > 10_000
      || !["streaming_tts", "server_transcription", "live_transcription", "access_protected"]
        .every((field) => typeof health[field] === "boolean")
      || !(health.model_name === null || (typeof health.model_name === "string"
        && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(health.model_name)))
      || (health.mode === "model" && health.model_name === null)
      || (health.mode === "offline" && (health.model_name !== null || health.streaming_tts
        || health.server_transcription || health.live_transcription))) {
      throw new Error("The local server returned invalid readiness data.");
    }
    return health;
  } finally {
    window.clearTimeout(deadline);
  }
}

const healthStartupTurn = turn;
readServerHealth().then((health) => {
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
  if (!recognitionAvailable && turn === healthStartupTurn) {
    statusLine.textContent = serverTranscriptionAvailable
      ? "Ready to type or record a question for server transcription."
      : "Ready to type. Speech recognition is not available in this browser.";
  }
}).catch(() => {
  modeLabel.textContent = "Server readiness unavailable";
  if (turn === healthStartupTurn) statusLine.textContent = "Could not confirm server readiness. Check the local server and study notes, then reload.";
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
function savedConversationSnapshot() {
  return {
    language: speechLanguage.value,
    messages: conversationMessages.map((message) => {
      const content = message.historyEntry && history.includes(message.historyEntry)
        ? message.historyEntry.content : message.content;
      const sourceIds = message.sources.map((source) => {
        if (/^article-\d+[a-z]?$/.test(source.id || "")) return source.id;
        const article = /\bArticle\s+(\d+[a-z]?)(?![a-z\d])/i.exec(source.section);
        return article ? `article-${article[1].toLowerCase()}` : null;
      }).filter(Boolean);
      return { role: message.role, content: [...content].slice(0, message.role === "user" ? 1200 : 3000).join(""),
        source_ids: [...new Set(sourceIds)], ...(message.trace ? { trace: message.trace } : {}) };
    }),
  };
}

function restoreSavedConversation(snapshot) {
  stopTutor();
  quizSession = null;
  resetTutorComposer();
  history.length = 0;
  conversationMessages.length = 0;
  conversation.replaceChildren();
  input.value = "";
  speechLanguage.value = snapshot.language;
  refreshSpeechVoices();
  saveSpeechPreferences();
  for (const message of snapshot.messages) {
    const historyEntry = rememberMessage(message.role, message.content, message.sources);
    addMessage(message.role, message.content, message.sources,
      message.role === "user" ? "SAVED QUESTION SOURCE" : "SAVED STUDY SOURCE",
      message.role === "assistant" ? { historyEntry } : null, message.trace);
  }
  statusLine.textContent = "Saved text opened. Ask a follow-up or choose Listen again. Quiz state is not resumed.";
  input.focus();
}

input.addEventListener("input", () => { conversationRevision += 1; });
savedConversations = window.BolPrepSavedConversations({
  apiFetch, snapshot: savedConversationSnapshot, restore: restoreSavedConversation, validStudySources,
  validRequestTrace: (trace) => savedRequestTrace(trace) !== null,
  revision: () => JSON.stringify([conversationRevision, turn, speechTurn, liveSttRun,
    serverRecordingRun, recognitionRun, input.value, speechLanguage.value]),
});
loadProgress();
