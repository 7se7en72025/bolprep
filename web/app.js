const form = document.querySelector("#question-form");
const input = document.querySelector("#question-input");
const conversation = document.querySelector("#conversation");
const statusLine = document.querySelector("#status");
const sendButton = document.querySelector("#send-button");
const micButton = document.querySelector("#mic-button");
const stopButton = document.querySelector("#stop-button");
const modeLabel = document.querySelector("#mode-label");
const speechLanguage = document.querySelector("#speech-language");
const speechVoice = document.querySelector("#speech-voice");
const previewVoiceButton = document.querySelector("#preview-voice");
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
const quizButton = document.querySelector("#quiz-button");
const nextQuestionButton = document.querySelector("#next-question");
const sendLabel = document.querySelector("#send-label");
const progressSummary = document.querySelector("#progress-summary");
const weakTopics = document.querySelector("#weak-topics");

const history = [];
let activeRequest = null;
let recognition = null;
let recognitionAvailable = false;
let matchingSpeechVoices = [];
let turn = 0;
let speechTurn = 0;
let quizSession = null;

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

function stopTutor() {
  speechTurn += 1;
  window.speechSynthesis?.cancel();
  activeRequest?.abort();
  activeRequest = null;
  turn += 1;
  sendButton.disabled = false;
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
    `${voice.name}|${voice.lang}|${voice.voiceURI}` === speechPreferences.voice
  ) ? speechPreferences.voice : "";
  speechVoice.disabled = matchingSpeechVoices.length === 0;
  if (!matchingSpeechVoices.length) {
    automatic.textContent = "No matching voice";
    speechVoice.title = `No installed ${speechLanguage.value} voice was found; the browser will use its default.`;
  } else {
    speechVoice.title = "Choose an installed voice or use the browser default.";
  }
}

function saveSpeechPreferences() {
  speechPreferences = { language: speechLanguage.value, voice: speechVoice.value };
  try {
    window.localStorage.setItem(speechPreferencesKey, JSON.stringify(speechPreferences));
  } catch {
    // Speech settings still work for this page when browser storage is unavailable.
  }
}

function speak(text, completionText = "Ready when you are.") {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    statusLine.textContent = "Speech playback is not available in this browser. Read the answer above.";
    return;
  }
  const requestSpeechTurn = ++speechTurn;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLanguage.value;
  const selectedVoice = matchingSpeechVoices.find((voice) =>
    `${voice.name}|${voice.lang}|${voice.voiceURI}` === speechVoice.value
  );
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = 0.96;
  utterance.onstart = () => {
    if (requestSpeechTurn === speechTurn) statusLine.textContent = "Tutor is speaking. Tap Stop audio or Speak to interrupt.";
  };
  utterance.onend = () => {
    if (requestSpeechTurn === speechTurn) statusLine.textContent = completionText;
  };
  utterance.onerror = () => {
    if (requestSpeechTurn === speechTurn) statusLine.textContent = "Audio playback stopped.";
  };
  window.speechSynthesis.speak(utterance);
}

previewVoiceButton.addEventListener("click", () => {
  const preview = speechLanguage.value === "en-IN"
    ? "Hello, let's study fundamental rights together."
    : "Namaste, aaj hum maulik adhikar seekhenge.";
  speak(preview, "Voice preview finished.");
});

async function sendQuestion(question) {
  const requestTurn = ++turn;
  activeRequest?.abort();
  activeRequest = new AbortController();
  const controller = activeRequest;
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
    history.push({ role: "user", content: question }, { role: "assistant", content: payload.answer });
    history.splice(0, Math.max(0, history.length - 20));
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
      addMessage("assistant", error.message);
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
  const requestTurn = turn;
  quizButton.disabled = true;
  nextQuestionButton.hidden = true;
  statusLine.textContent = "Preparing a three-question Fundamental Rights quiz…";
  try {
    const response = await fetch("/api/quiz/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "fundamental rights", question_count: 3, language: speechLanguage.value }),
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
  }
}

function showQuizQuestion(speakPrompt = true) {
  if (!quizSession || quizSession.index >= quizSession.questions.length) return;
  const current = quizSession.questions[quizSession.index];
  quizSession.awaitingAnswer = true;
  nextQuestionButton.hidden = true;
  sendLabel.textContent = "Submit answer";
  input.maxLength = 1000;
  input.placeholder = "Speak or type your answer…";
  addMessage("assistant", `Question ${quizSession.index + 1} of ${quizSession.questions.length}: ${current.prompt}`, [current.source]);
  const readyText = "Your answer is ready when you are.";
  statusLine.textContent = readyText;
  if (speakPrompt) speak(current.prompt, readyText);
}

async function submitQuizAnswer(answer) {
  if (!quizSession || !quizSession.awaitingAnswer) return;
  const current = quizSession.questions[quizSession.index];
  current.idempotencyKey ||= window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  quizSession.awaitingAnswer = false;
  const requestTurn = ++turn;
  sendButton.disabled = true;
  micButton.disabled = true;
  statusLine.textContent = "Checking your answer against the rubric…";
  addMessage("user", answer);
  try {
    const response = await fetch("/api/quiz/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizSession.quizId, question_id: current.id, idempotency_key: current.idempotencyKey, answer, language: speechLanguage.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not score the answer.");
    if (requestTurn !== turn) return;
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
      addMessage("assistant", error.message);
      statusLine.textContent = "Scoring failed. You can try submitting the answer again.";
    }
  } finally {
    if (requestTurn === turn) {
      sendButton.disabled = false;
      micButton.disabled = !recognitionAvailable;
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || sendButton.disabled) return;
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
  stopTutor();
  sendButton.disabled = false;
  statusLine.textContent = "Audio stopped. You can continue the conversation.";
});

document.querySelector("#clear-button").addEventListener("click", () => {
  stopTutor();
  quizSession = null;
  history.length = 0;
  conversation.replaceChildren();
  addMessage("assistant", "Namaste! Fundamental Rights ke baare mein kya jaan-na hai?");
  nextQuestionButton.hidden = true;
  sendLabel.textContent = "Ask tutor";
  input.maxLength = 1200;
  input.placeholder = "Type a question… e.g. Right to Equality kya hai?";
  statusLine.textContent = "New session started.";
});

quizButton.addEventListener("click", startQuiz);
nextQuestionButton.addEventListener("click", showQuizQuestion);

async function loadProgress() {
  try {
    const response = await fetch("/api/progress");
    const progress = await response.json();
    if (!response.ok) throw new Error(progress.error || "Could not load saved results.");
    weakTopics.replaceChildren();
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
    progressSummary.textContent = "Saved progress could not load. Check that the local server is running.";
  }
}

document.querySelector("#refresh-progress").addEventListener("click", loadProgress);
document.querySelector("#clear-progress").addEventListener("click", async () => {
  if (!window.confirm("Delete saved quiz scores for this browser?")) return;
  try {
    const response = await fetch("/api/progress", { method: "DELETE" });
    if (!response.ok) throw new Error("Could not clear saved results.");
    await loadProgress();
    statusLine.textContent = "Saved quiz progress cleared.";
  } catch (error) {
    statusLine.textContent = error.message;
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
speechLanguage.addEventListener("change", refreshSpeechVoices);
speechLanguage.addEventListener("change", saveSpeechPreferences);
speechVoice.addEventListener("change", saveSpeechPreferences);
window.speechSynthesis?.addEventListener?.("voiceschanged", refreshSpeechVoices);
refreshSpeechVoices();

if (SpeechRecognition) {
  recognitionAvailable = true;
  recognition = new SpeechRecognition();
  recognition.lang = speechLanguage.value;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => { micButton.disabled = true; statusLine.textContent = "Listening… speak now."; };
  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) transcript += event.results[i][0].transcript;
    input.value = transcript.trim();
  };
  recognition.onerror = (event) => { statusLine.textContent = `Microphone issue: ${event.error}. You can type instead.`; };
  recognition.onend = () => { micButton.disabled = false; if (statusLine.textContent === "Listening… speak now.") statusLine.textContent = "Transcript ready. Review it, then ask."; };
  speechLanguage.addEventListener("change", () => { recognition.lang = speechLanguage.value; });
}

micButton.disabled = !recognitionAvailable;
if (!recognitionAvailable) micButton.title = "Speech recognition is not available in this browser. You can still type your question.";
micButton.addEventListener("click", () => {
  if (!recognition) return;
  stopTutor();
  window.speechSynthesis?.cancel();
  try { recognition.start(); } catch { statusLine.textContent = "Microphone is already starting. Please wait a moment."; }
});

fetch("/health").then((response) => response.json()).then((health) => {
  const mode = health.mode === "model" ? "Model answers enabled" : "Offline practice mode";
  modeLabel.textContent = `${mode} · history stays in this tab`;
  if (!recognitionAvailable) statusLine.textContent = "Ready to type. Speech recognition is not available in this browser.";
}).catch(() => {
  modeLabel.textContent = "Start the local server to connect";
});
loadProgress();
