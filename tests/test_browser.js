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

async function openOfflinePage(page) {
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
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#mode-label")?.textContent.includes("Offline practice mode"));
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
  } finally {
    await browser.close();
  }
});
