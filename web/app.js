const form = document.querySelector("#question-form");
const input = document.querySelector("#question-input");
const conversation = document.querySelector("#conversation");
const statusLine = document.querySelector("#status");
const sendButton = document.querySelector("#send-button");
const micButton = document.querySelector("#mic-button");
const stopButton = document.querySelector("#stop-button");
const modeLabel = document.querySelector("#mode-label");
const speechLanguage = document.querySelector("#speech-language");

const history = [];
let activeRequest = null;
let recognition = null;
let recognitionAvailable = false;
let turn = 0;
let speechTurn = 0;

function addMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "tutor-message"}`;
  const speaker = document.createElement("span");
  speaker.className = "speaker";
  speaker.textContent = role === "user" ? "YOU" : "BOLPREP";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(speaker, paragraph);
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

function speak(text) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  const requestSpeechTurn = ++speechTurn;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLanguage.value;
  utterance.rate = 0.96;
  utterance.onstart = () => {
    if (requestSpeechTurn === speechTurn) statusLine.textContent = "Tutor is speaking. Tap Stop audio or Speak to interrupt.";
  };
  utterance.onend = () => {
    if (requestSpeechTurn === speechTurn) statusLine.textContent = "Ready when you are.";
  };
  utterance.onerror = () => {
    if (requestSpeechTurn === speechTurn) statusLine.textContent = "Audio playback stopped.";
  };
  window.speechSynthesis.speak(utterance);
}

async function sendQuestion(question) {
  const requestTurn = ++turn;
  activeRequest?.abort();
  activeRequest = new AbortController();
  const controller = activeRequest;
  sendButton.disabled = true;
  statusLine.textContent = "Thinking…";
  addMessage("user", question);

  try {
    const response = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: history.slice(-20) }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Tutor request failed.");
    if (requestTurn !== turn) return;
    addMessage("assistant", payload.answer);
    history.push({ role: "user", content: question }, { role: "assistant", content: payload.answer });
    history.splice(0, Math.max(0, history.length - 20));
    statusLine.textContent = "Answer ready.";
    speak(payload.answer);
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || sendButton.disabled) return;
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
  history.length = 0;
  conversation.replaceChildren();
  addMessage("assistant", "Namaste! Fundamental Rights ke baare mein kya jaan-na hai?");
  statusLine.textContent = "New session started.";
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
