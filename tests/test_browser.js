// Run against an explicitly started offline server with BOLPREP_TEST_BASE_URL.
// This uses a real local browser and the temporary database owned by that server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { chromium } = require("playwright-core");

const baseURL = process.env.BOLPREP_TEST_BASE_URL;
const executablePath = process.env.BOLPREP_BROWSER_PATH || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => fs.existsSync(candidate));

async function openOfflinePage(page, { configure = null, displayedMode = "Offline practice mode" } = {}) {
  const url = new URL(baseURL);
  assert.equal(url.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  const healthResponse = await page.request.get(new URL("/health", url).href);
  assert.equal(healthResponse.ok(), true);
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  assert.equal(health.mode, "offline");
  assert.equal(health.access_protected, false);
  if (configure) await configure(health);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((mode) => document.querySelector("#mode-label")?.textContent.includes(mode), displayedMode);
}

test("offline browser flow: tutor, saved conversation, quiz, and diagnostics", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openOfflinePage(page);

    await page.locator("#question-input").fill("Explain Article 14");
    await page.locator("#send-button").click();
    await page.locator("#send-button").waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector("#send-button").disabled);
    const conversation = await page.locator("#conversation").innerText();
    assert.match(conversation, /Explain Article 14/);
    assert.match(conversation, /barabari|equality/i);
    assert.match(await page.locator("#tutor-trace-summary").textContent(), /1 recorded: 1 completed/);

    await page.locator("#save-conversation").click();
    await page.waitForFunction(() => document.querySelector("#history-status")?.textContent.includes("Text saved. Audio was not stored."));
    await page.locator("#clear-button").click();
    assert.doesNotMatch(await page.locator("#conversation").innerText(), /Explain Article 14/);
    await page.locator("#saved-conversations button").first().click();
    await page.waitForFunction(() => document.querySelector("#history-status")?.textContent.includes("Saved text opened"));
    assert.match(await page.locator("#conversation").innerText(), /Explain Article 14/);

    await page.locator("#quiz-difficulty").selectOption("basic");
    await page.locator("#quiz-button").click();
    await page.waitForFunction(() => !document.querySelector("#end-quiz").hidden);
    await page.locator("#question-input").fill("Equality before law and equal protection of the laws.");
    await page.locator("#send-button").click();
    await page.waitForFunction(() => !document.querySelector("#next-question").hidden);
    assert.match(await page.locator("#conversation").innerText(), /Score: \d+%/);
    await page.locator("#refresh-progress").click();
    await page.waitForFunction(() => !document.querySelector("#progress-summary").textContent.includes("Loading"));
    assert.doesNotMatch(await page.locator("#progress-summary").innerText(), /No saved answers/);

    await page.locator("#speech-diagnostics-panel summary").click();
    await page.locator("#refresh-speech-diagnostics").click();
    assert.ok((await page.locator("#speech-dashboard-rows tr").count()) > 0);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test("restored conversation keeps the latest article context through a language switch", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    const turns = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/agent/turn") turns.push(request.postDataJSON());
    });
    await openOfflinePage(page);
    const ask = async (question) => {
      await page.locator("#question-input").fill(question);
      await page.locator("#send-button").click();
      await page.waitForFunction(() => !document.querySelector("#send-button").disabled);
      return page.locator("#conversation .tutor-message").last().innerText();
    };

    assert.match(await ask("Explain Article 14"), /Article 14/i);
    await page.locator("#save-conversation").click();
    await page.waitForFunction(() => document.querySelector("#history-status")?.textContent.includes("Text saved. Audio was not stored."));
    await page.locator("#clear-button").click();
    await page.locator("#saved-conversations button").first().click();
    await page.waitForFunction(() => document.querySelector("#history-status")?.textContent.includes("Saved text opened"));

    assert.match(await ask("Give an example"), /Article 14/i);
    assert.equal(turns.at(-1).language, "hi-IN");
    assert.ok(turns.at(-1).history.some((message) => message.role === "user" && message.content === "Explain Article 14"));
    await page.locator("#speech-language").selectOption("en-IN");
    assert.match(await ask("Explain Article 21"), /Article 21/i);
    assert.equal(turns.at(-1).language, "en-IN");
    const latestFollowUp = await ask("Give an example");
    assert.match(latestFollowUp, /Article 21/i);
    assert.doesNotMatch(latestFollowUp, /Article 14/i);
    assert.equal(turns.at(-1).language, "en-IN");
    assert.ok(turns.at(-1).history.some((message) => message.role === "user" && message.content === "Explain Article 21"));
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test("saved tutor diagnostics require opt-in and stay with their browser cookie", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    const owner = await browser.newContext();
    const page = await owner.newPage();
    const pageErrors = [];
    const turns = [];
    let traceGets = 0;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/api/agent/turn") turns.push(request.postDataJSON());
      if (path === "/api/traces") traceGets += 1;
    });
    await openOfflinePage(page);
    const ask = async (question) => {
      await page.locator("#question-input").fill(question);
      await page.locator("#send-button").click();
      await page.waitForFunction(() => !document.querySelector("#send-button").disabled);
    };
    assert.equal(await page.locator("#retain-request-traces").isChecked(), false);
    assert.equal(traceGets, 0);
    await ask("Explain Article 14");
    assert.equal(turns.at(-1).retain_trace, false);
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("No saved request diagnostics"));
    assert.equal(await page.locator("#saved-traces-rows tr").count(), 0);

    await page.locator("#retain-request-traces").check();
    await ask("Explain Article 21");
    assert.equal(turns.at(-1).retain_trace, true);
    assert.match(await page.locator("#saved-traces-status").textContent(), /diagnostics saved/i);
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelectorAll("#saved-traces-rows tr").length === 1);
    const row = await page.locator("#saved-traces-rows tr").innerText();
    assert.match(row, /completed \/ offline/);
    assert.doesNotMatch(row, /Explain Article|Offline study notes/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#mode-label")?.textContent.includes("Offline practice mode"));
    assert.equal(await page.locator("#retain-request-traces").isChecked(), false);
    assert.equal(await page.locator("#saved-traces-rows tr").count(), 0);
    assert.equal(traceGets, 2);
    await ask("Explain Article 19");
    assert.equal(turns.at(-1).retain_trace, false);
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelectorAll("#saved-traces-rows tr").length === 1);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await openOfflinePage(otherPage);
    await otherPage.locator("#refresh-request-traces").click();
    await otherPage.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("No saved request diagnostics"));
    assert.equal(await otherPage.locator("#saved-traces-rows tr").count(), 0);
    otherPage.once("dialog", (dialog) => dialog.accept());
    await otherPage.locator("#clear-request-traces").click();
    await otherPage.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("diagnostics deleted"));
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("1 saved request diagnostics"));

    const malformed = (route) => route.fulfill({ json: { traces: [{ request_id: "<script>alert(1)</script>" }] } });
    await page.route("**/api/traces", malformed);
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("response was invalid"));
    assert.equal(await page.locator("#saved-traces-rows tr").count(), 1);
    assert.equal(await page.locator("#saved-traces-rows script").count(), 0);
    await page.unroute("**/api/traces", malformed);

    const oversized = (route) => route.fulfill({ contentType: "application/json", body: `{"traces":[],"padding":"${"x".repeat(1024 * 1024)}"}` });
    await page.route("**/api/traces", oversized);
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("could not be read or changed"));
    assert.equal(await page.locator("#saved-traces-rows tr").count(), 1);
    await page.unroute("**/api/traces", oversized);

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#clear-request-traces").click();
    await page.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("diagnostics deleted"));
    assert.equal(await page.locator("#saved-traces-rows tr").count(), 0);
    await page.locator("#refresh-request-traces").click();
    await page.waitForFunction(() => document.querySelector("#saved-traces-status")?.textContent.includes("No saved request diagnostics"));
    assert.deepEqual(pageErrors, []);
    await other.close();
    await owner.close();
  } finally {
    await browser.close();
  }
});

test("Stop keeps a delayed tutor answer from appearing", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    const page = await browser.newPage();
    await openOfflinePage(page);
    let responseReady;
    const intercepted = new Promise((resolve) => { responseReady = resolve; });
    let releaseResponse;
    const release = new Promise((resolve) => { releaseResponse = resolve; });
    await page.route("**/api/agent/turn", async (route) => {
      const response = await route.fetch();
      responseReady();
      await release;
      try { await route.fulfill({ response }); } catch { /* Stop may have aborted the route. */ }
    });
    await page.locator("#question-input").fill("Explain Article 19");
    await page.locator("#send-button").click();
    await intercepted;
    await page.locator("#stop-button").click();
    releaseResponse();
    await page.waitForTimeout(300);
    const conversation = await page.locator("#conversation").innerText();
    assert.match(conversation, /I stopped before finishing that answer/);
    assert.doesNotMatch(conversation, /Offline study notes/);
    assert.equal(await page.locator("#send-button").isDisabled(), false);
  } finally {
    await browser.close();
  }
});

test("mocked browser speech counts pending cancellation once and rejects stale callbacks", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const utterances = [];
      const synthesis = {
        pending: false, speaking: false, cancelCalls: 0,
        getVoices: () => [], addEventListener() {},
        speak(utterance) { utterances.push(utterance); this.pending = true; },
        cancel() { this.cancelCalls += 1; this.pending = false; this.speaking = false; },
      };
      Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synthesis });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      window.__speechProbe = {
        utterances, synthesis,
        start(index) {
          synthesis.pending = false;
          synthesis.speaking = true;
          utterances[index].onstart?.();
        },
        end(index) {
          synthesis.speaking = false;
          utterances[index].onend?.();
        },
      };
    });
    await openOfflinePage(page);
    const pendingCount = await page.evaluate(() => {
      speakWithBrowser("First pending answer.", "First done.");
      return window.__speechProbe.utterances.length;
    });
    assert.equal(pendingCount, 1);
    await page.locator("#stop-button").click();
    await page.locator("#stop-button").click();
    let diagnostic = await page.evaluate(() => buildSpeechDiagnostics());
    assert.equal(diagnostic.tts[0].cancellation_count, 1);
    assert.equal(diagnostic.tts[0].completed_count, 0);
    assert.equal(diagnostic.tts[0].cancellation_reasons["stop-button"], 1);
    assert.equal(diagnostic.speech_stops.length, 1);

    const stoppedStatus = await page.locator("#status").textContent();
    await page.evaluate(() => {
      window.__speechProbe.start(0);
      window.__speechProbe.end(0);
    });
    assert.equal(await page.locator("#status").textContent(), stoppedStatus);
    diagnostic = await page.evaluate(() => buildSpeechDiagnostics());
    assert.equal(diagnostic.tts[0].completed_count, 0);
    assert.equal(diagnostic.tts[0].cancellation_count, 1);

    await page.evaluate(() => speakWithBrowser("New answer.", "New answer done."));
    await page.evaluate(() => {
      window.__speechProbe.start(1);
      window.__speechProbe.end(1);
    });
    diagnostic = await page.evaluate(() => buildSpeechDiagnostics());
    assert.equal(diagnostic.tts[0].completed_count, 1);
    assert.equal(diagnostic.tts[0].cancellation_count, 1);
    assert.match(await page.locator("#status").textContent(), /New answer done/);

    await page.locator("#question-input").fill("Explain Article 21");
    await page.locator("#send-button").click();
    await page.waitForFunction(() => !document.querySelector("#send-button").disabled);
    assert.ok(await page.evaluate(() => window.__speechProbe.utterances.length > 2));
    await page.locator("#stop-button").click();
    const saved = await page.evaluate(() => savedConversationSnapshot());
    assert.match(saved.messages.at(-1).content, /Speech playback stopped before completion/);
    diagnostic = await page.evaluate(() => buildSpeechDiagnostics());
    assert.equal(diagnostic.tts[0].completed_count, 1);
    assert.equal(diagnostic.tts[0].cancellation_count, 2);
    assert.equal(diagnostic.speech_stops.length, 2);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test("mocked recorded input preserves drafts after permission and upload cancellation", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const requests = [];
      const tracks = [];
      const recorders = [];
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: () => new Promise((resolve) => requests.push(resolve)) },
      });
      class FakeMediaRecorder {
        static isTypeSupported() { return true; }
        constructor(stream, options) {
          this.stream = stream;
          this.mimeType = options?.mimeType || "audio/webm";
          this.state = "inactive";
          recorders.push(this);
        }
        start() { this.state = "recording"; }
        stop() {
          this.state = "inactive";
          queueMicrotask(() => {
            this.ondataavailable?.({ data: new Blob(["mock-audio"], { type: this.mimeType }) });
            this.onstop?.();
          });
        }
      }
      window.MediaRecorder = FakeMediaRecorder;
      window.__recordingProbe = {
        requests, tracks, recorders,
        resolveRequest(index) {
          const track = {
            readyState: "live", stops: 0,
            addEventListener() {}, removeEventListener() {},
            stop() { this.stops += 1; this.readyState = "ended"; },
          };
          tracks.push(track);
          requests[index]({ getTracks: () => [track], getAudioTracks: () => [track] });
        },
      };
    });
    let uploaded = 0;
    let releaseResponse;
    const release = new Promise((resolve) => { releaseResponse = resolve; });
    let uploadReady;
    const intercepted = new Promise((resolve) => { uploadReady = resolve; });
    await openOfflinePage(page, {
      displayedMode: "Model answers enabled",
      configure: async (health) => {
        await page.route("**/health", (route) => route.fulfill({ json: {
          ...health, mode: "model", model_name: "mock-browser", server_transcription: true,
        } }));
        await page.route("**/api/transcribe", async (route) => {
          uploaded += 1;
          uploadReady();
          await release;
          try {
            await route.fulfill({ json: {
              transcript: "late mocked transcript", configured_model: "mock-stt",
              server_transcription_call_ms: 1,
            } });
          } catch { /* Editing the draft may abort the routed request. */ }
        });
      },
    });
    const record = page.locator("#server-transcribe-button");
    await page.locator("#question-input").fill("Original draft");
    await record.click();
    await page.waitForFunction(() => window.__recordingProbe.requests.length === 1);
    assert.match(await record.innerText(), /Cancel/);
    await record.click();
    await page.evaluate(() => window.__recordingProbe.resolveRequest(0));
    await page.waitForFunction(() => window.__recordingProbe.tracks[0]?.stops === 1);
    assert.equal(await page.locator("#question-input").inputValue(), "Original draft");
    assert.equal(await page.evaluate(() => window.__recordingProbe.recorders.length), 0);

    await record.click();
    await page.waitForFunction(() => window.__recordingProbe.requests.length === 2);
    await page.evaluate(() => window.__recordingProbe.resolveRequest(1));
    await page.waitForFunction(() => window.__recordingProbe.recorders[0]?.state === "recording");
    await page.locator("#question-input").fill("Edited draft");
    await page.waitForFunction(() => window.__recordingProbe.tracks[1]?.stops >= 1);
    assert.equal(await page.locator("#question-input").inputValue(), "Edited draft");
    assert.equal(uploaded, 0);

    await page.waitForFunction(() => !document.querySelector("#server-transcribe-button").disabled);
    await record.click();
    await page.waitForFunction(() => window.__recordingProbe.requests.length === 3);
    await page.evaluate(() => window.__recordingProbe.resolveRequest(2));
    await page.waitForFunction(() => window.__recordingProbe.recorders[1]?.state === "recording");
    await record.click();
    await intercepted;
    await page.locator("#question-input").fill("Typed after upload");
    releaseResponse();
    await page.waitForTimeout(200);
    assert.equal(await page.locator("#question-input").inputValue(), "Typed after upload");
    assert.equal(uploaded, 1);
    assert.equal(await page.evaluate(() => window.__recordingProbe.tracks[2].stops), 1);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test("continuous quiz voice keeps an interrupted answer until replacement or retry", { skip: !baseURL }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--mute-audio"] });
  try {
    for (const scenario of ["failed capture", "cancelled capture", "next question", "replacement answer"]) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const scoreRoutes = [];
      let firstScoreReady;
      const firstScore = new Promise((resolve) => { firstScoreReady = resolve; });
      let liveSetupRequests = 0;
      try {
        await openOfflinePage(page, {
          displayedMode: "Model answers enabled",
          configure: async (health) => {
            await page.addInitScript(() => {
              Object.defineProperty(navigator, "mediaDevices", {
                configurable: true, value: { getUserMedia: () => { throw new Error("Real microphone access forbidden in this test."); } },
              });
              window.RTCPeerConnection = class {};
              window.__liveCaptures = [];
            });
            await page.route("**/health", (route) => route.fulfill({ json: {
              ...health, mode: "model", model_name: "mock-browser", live_transcription: true,
            } }));
            await page.route("**/live-stt.js", (route) => route.fulfill({
              contentType: "application/javascript",
              body: `window.BolPrepLiveTranscription = class {
                constructor(callbacks, options) {
                  this.callbacks = callbacks;
                  this.continuous = options.continuous;
                  this.state = "connecting";
                  window.__liveCaptures.push(this);
                }
                async start() { this.state = "listening"; this.callbacks.status("Mock listening", "listening"); }
                cancel() { this.state = "closed"; this.callbacks.closed(); }
              };`,
            }));
            await page.route("**/api/transcription/session", (route) => {
              liveSetupRequests += 1;
              return route.abort();
            });
            await page.route("**/api/quiz/score", async (route) => {
              await new Promise((release) => {
                scoreRoutes.push({ release });
                if (scoreRoutes.length === 1) firstScoreReady();
              });
              try { await route.abort(); } catch { /* The browser may have already canceled it. */ }
            });
          },
        });
        await page.locator("#quiz-difficulty").selectOption("basic");
        await page.locator("#quiz-button").click();
        await page.waitForFunction(() => !document.querySelector("#end-quiz").hidden);
        await page.locator("#live-conversation").check();
        await page.locator("#live-stt-button").click();
        await page.waitForFunction(() => window.__liveCaptures[0]?.state === "listening");
        const previousAnswer = "Equality before law and equal protection of the laws.";
        await page.evaluate((answer) => window.__liveCaptures[0].callbacks.final(answer), previousAnswer);
        await firstScore;
        await page.evaluate(() => window.__liveCaptures[0].callbacks.speechStart());
        assert.equal(await page.locator("#question-input").inputValue(), "");
        if (scenario === "failed capture") {
          await page.evaluate(() => {
            const capture = window.__liveCaptures[0];
            capture.callbacks.error("Mock transcription failed.");
            capture.cancel();
          });
          assert.equal(await page.locator("#question-input").inputValue(), previousAnswer);
        } else if (scenario === "cancelled capture") {
          await page.locator("#stop-button").click();
          assert.equal(await page.locator("#question-input").inputValue(), previousAnswer);
        } else if (scenario === "next question") {
          await page.evaluate(() => window.__liveCaptures[0].callbacks.final("next question"));
          assert.match(await page.locator("#status").textContent(), /does not skip an unanswered question/);
          assert.equal(await page.locator("#question-input").inputValue(), previousAnswer);
        } else {
          const replacement = "A revised spoken answer.";
          await page.evaluate((answer) => window.__liveCaptures[0].callbacks.final(answer), replacement);
          assert.equal(await page.evaluate(() => quizSession.pendingAnswer), replacement);
          assert.equal(await page.locator("#question-input").inputValue(), "");
        }
        assert.equal(liveSetupRequests, 0);
        assert.deepEqual(pageErrors, []);
      } finally {
        scoreRoutes.forEach(({ release }) => release());
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
