// Provider-free regression checks for the browser live-transcription turn state.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function captureHarness(continuous = false) {
  const scheduled = new Map();
  let nextTimer = 0;
  const finals = [];
  const failures = [];
  const metrics = [];
  const statuses = [];
  const sent = [];
  const track = { enabled: true, readyState: "live", stops: 0,
    stop() { this.stops += 1; this.readyState = "ended"; },
    addEventListener() {}, removeEventListener() {} };
  const channelListeners = {};
  const channel = { readyState: "open", send(data) { sent.push(JSON.parse(data)); }, close() {},
    addEventListener(name, callback) { channelListeners[name] = callback; } };
  const window = { crypto: { randomUUID: () => "attempt-id" } };
  const context = vm.createContext({
    window, AbortController, performance, Date, JSON, Float32Array, TextDecoder,
    setTimeout(callback, delay) { const id = ++nextTimer; scheduled.set(id, { callback, delay }); return id; },
    clearTimeout(id) { scheduled.delete(id); },
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "web", "live-stt.js"), "utf8");
  vm.runInContext(source, context, { filename: "live-stt.js" });
  const capture = new window.BolPrepLiveTranscription({
    final: (text) => finals.push(text),
    error: (message) => failures.push(message),
    metrics: (sample) => metrics.push(sample),
    status: (text, state) => statuses.push({ text, state }), partial() {}, closed() {},
  }, { continuous });
  capture.stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  capture.channel = channel;
  capture.peer = { close() {} };
  capture.startedAt = performance.now();
  capture.startedAtUtc = new Date().toISOString();
  capture.language = "hi-IN";
  capture.state = "listening";
  // This suite exercises turn protocol; microphone energy analysis is device dependent.
  capture.autoFinish = false;
  const flushDelay = (delay) => {
    for (const [id, timer] of [...scheduled]) {
      if (timer.delay !== delay) continue;
      scheduled.delete(id);
      timer.callback();
    }
  };
  const event = (type, item_id, extra = {}) => capture.event(JSON.stringify({ type, item_id, ...extra }));
  return { context, window, capture, finals, failures, metrics, statuses,
    sent, track, channel, channelListeners, event, flushDelay };
}

async function pendingResumeHarness(model) {
  const requestedModel = arguments.length ? model : "gpt-live-transcribe";
  const h = captureHarness(true);
  let resolveResume;
  let rejectResume;
  let audioContext;
  class FakeAudioContext {
    state = "suspended";
    constructor() { audioContext = this; }
    resume() {
      return new Promise((resolve, reject) => {
        resolveResume = resolve;
        rejectResume = reject;
      });
    }
    createAnalyser() {
      return { fftSize: 2048, disconnect() {}, getFloatTimeDomainData() {} };
    }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  h.window.AudioContext = FakeAudioContext;
  h.window.BolPrepFetch = async () => new Response(JSON.stringify({
    client_secret: "mock-ephemeral-token", expires_at: Math.floor(Date.now() / 1000) + 60, model: requestedModel,
  }));
  h.context.navigator = { mediaDevices: { getUserMedia: async () => ({
    getTracks: () => [h.track], getAudioTracks: () => [h.track],
  }) } };
  h.context.RTCPeerConnection = class {
    addTrack() {}
    addEventListener() {}
    createDataChannel() { return h.channel; }
    createOffer() { return Promise.resolve({ sdp: "mock-offer" }); }
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    close() {}
  };
  h.context.fetch = async () => new Response("mock-answer");
  h.capture.autoFinish = true;
  h.capture.state = "connecting";
  await h.capture.start("hi-IN");
  assert.equal(h.capture.closed, false, JSON.stringify({ failures: h.failures, metrics: h.metrics }));
  return {
    h, audioContext,
    finishResume: () => { audioContext.state = "running"; resolveResume(); },
    rejectResume: () => rejectResume(new Error("Mock resume denied.")),
  };
}

test("continuous mode waits for a pending audio context resume before judging detection unavailable", async () => {
  const { h, finishResume } = await pendingResumeHarness();
  h.channelListeners.open();
  assert.equal(h.capture.closed, false);
  assert.equal(h.capture.state, "connecting");
  finishResume();
  await new Promise(setImmediate);
  assert.equal(h.capture.state, "listening");
  assert.deepEqual(h.failures, []);
  h.capture.cancel();
});

test("cancellation during pending resume cannot enable a released microphone", async () => {
  const { h, finishResume } = await pendingResumeHarness();
  h.channelListeners.open();
  h.capture.cancel();
  finishResume();
  await new Promise(setImmediate);
  assert.equal(h.capture.closed, true);
  assert.equal(h.track.enabled, false);
  assert.equal(h.track.stops, 1);
  assert.equal(h.statuses.some((status) => status.state === "listening"), false);
  assert.equal(h.metrics[0].outcome, "cancelled");
});

test("rejected or unresolved resume falls back within the bounded startup wait", async () => {
  for (const outcome of ["rejected", "unresolved"]) {
    const { h, rejectResume } = await pendingResumeHarness();
    h.channelListeners.open();
    if (outcome === "rejected") rejectResume();
    else h.flushDelay(3000);
    await new Promise(setImmediate);
    assert.equal(h.capture.closed, true, outcome);
    assert.match(h.failures[0], /needs working speech detection/, outcome);
    assert.equal(h.metrics[0].failure_reason, "analysis-unavailable", outcome);
    assert.equal(h.track.stops, 1, outcome);
  }
});

test("duplicate clear acknowledgements cannot start a turn twice while resume is pending", async () => {
  const { h, audioContext, finishResume } = await pendingResumeHarness();
  h.channelListeners.open();
  finishResume();
  await new Promise(setImmediate);
  h.capture.finish();
  h.flushDelay(250);
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "First turn" });
  assert.equal(h.capture.state, "clearing");
  audioContext.state = "suspended";
  let releaseNext;
  h.capture.detectionResumePromise = new Promise((resolve) => { releaseNext = resolve; });
  h.event("input_audio_buffer.cleared");
  h.event("input_audio_buffer.cleared");
  assert.equal(h.capture.state, "clearing");
  audioContext.state = "running";
  releaseNext();
  await new Promise(setImmediate);
  assert.equal(h.capture.state, "listening");
  assert.equal(h.statuses.filter((status) => status.text.startsWith("Live listening.")).length, 2);
  assert.deepEqual(h.failures, []);
  h.capture.cancel();
});

test("manual finish commits once and ignores a late or duplicate final", () => {
  const h = captureHarness();
  h.capture.finish();
  h.flushDelay(250);
  assert.deepEqual(h.sent, [{ type: "input_audio_buffer.commit" }]);
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "Article 21" });
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "stale" });
  assert.deepEqual(h.finals, ["Article 21"]);
  assert.equal(h.capture.closed, true);
  assert.ok(h.track.stops >= 1);
  assert.equal(h.metrics.length, 1);
  assert.equal(h.metrics[0].outcome, "completed");
});

test("continuous mode clears between turns and ignores the previous item", () => {
  const h = captureHarness(true);
  h.capture.finish();
  h.flushDelay(250);
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "Pehla sawaal" });
  assert.deepEqual(h.finals, ["Pehla sawaal"]);
  assert.equal(h.capture.state, "clearing");
  assert.deepEqual(h.sent.at(-1), { type: "input_audio_buffer.clear" });
  h.event("input_audio_buffer.cleared");
  assert.equal(h.capture.state, "listening");
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "old" });
  h.capture.finish();
  h.flushDelay(250);
  assert.equal(h.capture.state, "finalizing");
  assert.equal(h.capture.itemId, null);
  h.event("conversation.item.input_audio_transcription.completed", "item-2", { transcript: "Doosra sawaal" });
  assert.deepEqual(h.finals, ["Pehla sawaal", "Doosra sawaal"]);
  assert.equal(h.metrics.length, 2);
  assert.equal(h.metrics[1].turn_number, 2);
  h.capture.cancel();
  assert.ok(h.track.stops >= 1);
});

test("invalid active transcript closes capture without delivering a final", () => {
  const h = captureHarness();
  h.event("conversation.item.input_audio_transcription.delta", "item-1", { delta: 42 });
  assert.equal(h.capture.closed, true);
  assert.equal(h.failures.length, 1);
  assert.deepEqual(h.finals, []);
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "late" });
  assert.deepEqual(h.finals, []);
  assert.equal(h.metrics[0].outcome, "failed");
});

test("cancel before commit prevents a late turn from being sent", () => {
  const h = captureHarness();
  h.capture.finish();
  h.capture.cancel();
  h.flushDelay(250);
  h.event("conversation.item.input_audio_transcription.completed", "item-1", { transcript: "late" });
  assert.deepEqual(h.sent, []);
  assert.deepEqual(h.finals, []);
  assert.equal(h.metrics.length, 1);
  assert.equal(h.metrics[0].outcome, "cancelled");
});


test("live diagnostics leave pre-session failures unknown", () => {
  const h = captureHarness();
  h.capture.fail("Mock microphone failure.", "capture-permission");
  assert.equal(h.metrics[0].model, null);
});

test("live diagnostics retain validated session model and ignore missing or invalid labels", async () => {
  for (const model of ["gpt-live-transcribe", "mock-model-v2", undefined, null, "", "bad model", "x".repeat(129)]) {
    const { h } = await pendingResumeHarness(model);
    h.capture.cancel();
    const valid = typeof model === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model);
    assert.equal(h.metrics[0].model, valid ? model : null);
  }
});
