// The server mints a short-lived credential;
// media goes directly to the provider over WebRTC and is never saved by BolPrep.
class BolPrepLiveTranscription {
  constructor(callbacks, { autoFinish = false, continuous = false, quietPauseMs = 3000, captureLimitMs = 20000 } = {}) {
    this.callbacks = callbacks;
    this.continuous = continuous;
    this.autoFinish = autoFinish || continuous;
    this.quietPauseMs = [3000, 5000, 8000].includes(quietPauseMs) ? quietPauseMs : 3000;
    this.captureLimitMs = [20000, 60000].includes(captureLimitMs) ? captureLimitMs : 20000;
    this.completedItems = new Set();
    this.turnNumber = 1;
    this.attemptId = window.crypto?.randomUUID?.() ?? null;
    this.controller = new AbortController();
    this.timers = new Set();
    this.closed = false;
    this.state = "connecting";
    this.partial = "";
    this.itemId = null;
    this.committedItemId = null;
    this.trackEndListeners = [];
  }

  async readHandshakeText(response, maxBytes) {
    if (!response.body) throw new Error("Live setup returned no response body.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    let finished = false;
    try {
      while (true) {
        if (this.controller.signal.aborted) throw new DOMException("Live setup canceled.", "AbortError");
        const { value, done } = await reader.read();
        if (done) {
          finished = true;
          break;
        }
        bytes += value.byteLength;
        if (bytes > maxBytes) throw new Error("Live setup exceeded its response limit.");
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      if (this.controller.signal.aborted) throw new DOMException("Live setup canceled.", "AbortError");
      return text;
    } finally {
      if (!finished) void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  later(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.closed) callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  fail(message, reason = "provider-failed") {
    if (this.closed) return;
    this.cancel("failed", reason);
    this.callbacks.error(message);
  }

  cancel(outcome = "cancelled", reason = null) {
    if (this.closed) return;
    this.closed = true;
    this.trackEndListeners.forEach(([track, listener]) => track.removeEventListener("ended", listener));
    this.trackEndListeners.length = 0;
    this.controller.abort();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.stopSpeechDetection();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.channel?.close();
    this.peer?.close();
    this.reportMetrics(outcome, reason);
    this.callbacks.closed();
  }

  reportMetrics(outcome, reason = null) {
    if (this.metricsReported) return;
    this.metricsReported = true;
    const endedAt = performance.now();
    const duration = (start, end) => Number.isFinite(start) && Number.isFinite(end)
      ? Number(Math.max(0, end - start).toFixed(2)) : null;
    this.callbacks.metrics?.({
      attempt_id: this.attemptId,
      started_at_utc: this.startedAtUtc ?? null,
      language: this.language ?? null,
      model: "gpt-live-transcribe",
      auto_finish_requested: this.autoFinish,
      quiet_pause_ms: this.quietPauseMs,
      capture_limit_ms: this.captureLimitMs,
      continuous: this.continuous,
      turn_number: this.turnNumber,
      connection_reused: this.turnNumber > 1,
      pause_detection_used: this.pauseDetectionUsed === true,
      pause_detection_fallback_reason: this.pauseDetectionFallbackReason ?? null,
      finish_reason: this.finishReason ?? null,
      outcome,
      failure_reason: reason,
      connection_ms: duration(this.startedAt, this.listeningAt),
      listening_to_first_partial_ms: duration(this.listeningAt, this.firstPartialAt),
      listening_duration_ms: duration(this.listeningAt, this.finishedAt ?? endedAt),
      commit_to_final_ms: outcome === "completed" ? duration(this.committedAt, endedAt) : null,
      total_duration_ms: duration(this.startedAt, endedAt),
    });
  }

  resetTurn(reused = false) {
    if (reused) {
      this.turnNumber += 1;
      this.attemptId = window.crypto?.randomUUID?.() ?? null;
      this.startedAt = performance.now();
      this.startedAtUtc = new Date().toISOString();
    }
    this.metricsReported = false;
    this.partial = "";
    this.itemId = null;
    this.committedItemId = null;
    this.firstPartialAt = undefined;
    this.finishedAt = undefined;
    this.committedAt = undefined;
    this.finishReason = undefined;
    this.pauseDetectionUsed = false;
    this.pauseDetectionFallbackReason = undefined;
    this.listeningAt = undefined;
  }

  beginListening(reused = false) {
    if (this.closed) return;
    if (this.state !== "clearing") this.resetTurn(reused);
    this.state = "listening";
    this.listeningAt = performance.now();
    this.stream.getAudioTracks().forEach((track) => { track.enabled = true; });
    this.callbacks.status(`Live listening. Tap Done when you finish (${this.captureLimitMs / 1000}-second speech limit).`, this.state);
    this.captureTimer = this.continuous
      ? this.later(() => this.fail("No speech detected for 60 seconds. Start Live mic again when ready.", "no-speech"), 60000)
      : this.later(() => this.finish("capture-limit"), this.captureLimitMs);
    this.startSpeechDetection();
  }

  finish(reason = "manual") {
    if (this.closed || this.state !== "listening") return;
    this.state = "finalizing";
    this.finishReason = reason;
    this.finishedAt = performance.now();
    this.stopSpeechDetection(!this.continuous);
    clearTimeout(this.captureTimer);
    this.timers.delete(this.captureTimer);
    this.stream.getTracks().forEach((track) => { track.enabled = false; });
    this.callbacks.status("Finishing live transcript…", this.state);
    // Allow the last media packets to travel before committing the audio turn.
    this.later(() => {
      if (!this.continuous) this.stream.getTracks().forEach((track) => track.stop());
      if (this.channel.readyState !== "open") {
        this.fail("Live transcription disconnected. Partial words were discarded; try again or type.", "connection-closed");
        return;
      }
      try {
        this.channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      } catch {
        this.fail("Live transcription could not finish its audio turn. Try again or type.", "connection-failed");
        return;
      }
      this.committedAt = performance.now();
      this.finalTimer = this.later(() => this.fail("No final live transcript arrived. Try Record or type your question.", "final-transcript-timeout"), 30000);
    }, 250);
  }

  event(data) {
    if (this.closed) return;
    const invalid = () => this.fail(
      "The live transcription provider returned an invalid event. Start Live mic again, use Record, or type.",
      "provider-failed",
    );
    // Bound the serialized message before parsing; valid transcripts have a
    // separate, smaller review limit. Data-channel messages must be text JSON.
    if (typeof data !== "string" || data.length > 64 * 1024) {
      invalid();
      return;
    }
    let event;
    try { event = JSON.parse(data); } catch { invalid(); return; }
    if (!event || typeof event !== "object" || Array.isArray(event)
      || typeof event.type !== "string" || !event.type || event.type.length > 128) {
      invalid();
      return;
    }
    if (event.type === "error") {
      this.fail("The live transcription provider could not finish. Try Record or type your question.");
      return;
    }
    if (this.completedItems.has(event.item_id)) return;
    if (event.type === "input_audio_buffer.committed" && this.state === "finalizing") {
      if (typeof event.item_id !== "string" || !event.item_id || event.item_id.length > 128) {
        invalid();
        return;
      }
      if (this.itemId && this.itemId !== event.item_id) return;
      if (this.committedItemId && this.committedItemId !== event.item_id) return;
      this.committedItemId = event.item_id;
      return;
    }
    if (event.type === "input_audio_buffer.cleared" && this.state === "clearing") {
      clearTimeout(this.clearTimer);
      this.timers.delete(this.clearTimer);
      this.beginListening(true);
      return;
    }
    if (!["listening", "finalizing"].includes(this.state)) return;
    if (![
      "conversation.item.input_audio_transcription.delta",
      "conversation.item.input_audio_transcription.completed",
      "conversation.item.input_audio_transcription.failed",
    ].includes(event.type)) return;
    if (typeof event.item_id !== "string" || !event.item_id || event.item_id.length > 128) {
      invalid();
      return;
    }
    if (this.itemId && this.itemId !== event.item_id) return;
    if (this.committedItemId && this.committedItemId !== event.item_id) return;
    // Validate payloads before adopting an item or changing the draft.
    if ((event.type === "conversation.item.input_audio_transcription.delta" && typeof event.delta !== "string")
      || (event.type === "conversation.item.input_audio_transcription.completed" && typeof event.transcript !== "string")) {
      invalid();
      return;
    }
    this.itemId = event.item_id;
    if (event.type === "conversation.item.input_audio_transcription.failed") {
      this.fail("The live transcription provider could not finish. Try Record or type your question.");
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.delta" && typeof event.delta === "string") {
      if (this.partial.length + event.delta.length > 6000) {
        this.fail("Live transcript is too long. Please use a shorter question.", "transcript-too-long");
        return;
      }
      if (event.delta.length && this.firstPartialAt === undefined) this.firstPartialAt = performance.now();
      this.partial += event.delta;
      this.callbacks.partial(this.partial);
    } else if (event.type === "conversation.item.input_audio_transcription.completed" && this.state === "finalizing") {
      const text = typeof event.transcript === "string" ? event.transcript.trim() : "";
      if (!text) {
        this.fail("No speech was transcribed. Try again or type your question.", "empty-transcript");
        return;
      }
      if (text.length > 6000) {
        this.fail("Live transcript is too long. Please use a shorter question.", "transcript-too-long");
        return;
      }
      clearTimeout(this.finalTimer);
      this.timers.delete(this.finalTimer);
      if (this.continuous) {
        this.completedItems.add(event.item_id);
        this.reportMetrics("completed");
        this.state = "clearing";
        this.callbacks.final(text);
        if (this.closed) return;
        this.resetTurn(true);
        try {
          this.channel.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
          this.clearTimer = this.later(() => this.fail("Live input could not prepare the next turn. Start Live mic again.", "buffer-clear-timeout"), 5000);
        } catch {
          this.fail("Live input could not prepare the next turn. Start Live mic again.", "connection-failed");
        }
      } else {
        this.cancel("completed");
        this.callbacks.final(text);
      }
    }
  }

  stopSpeechDetection(closeContext = true) {
    clearTimeout(this.detectionTimer);
    this.timers.delete(this.detectionTimer);
    this.detectionSource?.disconnect();
    this.detectionSource = null;
    this.detector?.disconnect();
    this.detector = null;
    if (!closeContext) return;
    const context = this.detectionContext;
    this.detectionContext = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }

  startSpeechDetection() {
    if (!this.autoFinish) return;
    const manual = (reason) => {
      this.pauseDetectionFallbackReason = reason;
      if (this.continuous) {
        this.fail("Conversation mode needs working speech detection. Restart Live mic with conversation mode off to use Done.", reason);
        return;
      }
      this.stopSpeechDetection();
      this.callbacks.status(`Automatic pause detection is unavailable. Tap Done when finished (${this.captureLimitMs / 1000}-second limit).`, this.state);
    };
    const context = this.detectionContext;
    if (!context || context.state !== "running") {
      manual("analysis-unavailable");
      return;
    }
    try {
      this.detector = context.createAnalyser();
      this.detector.fftSize = 2048;
      this.detectionSource = context.createMediaStreamSource(this.stream);
      // No speaker connection: inspect microphone energy without playing it.
      this.detectionSource.connect(this.detector);
      this.pauseDetectionUsed = true;
      const samples = new Float32Array(this.detector.fftSize);
      let previousTime = performance.now();
      let speechMs = 0;
      let quietMs = 0;
      let heardSpeech = false;
      const poll = () => {
        if (this.closed || this.state !== "listening") return;
        if (context.state !== "running") {
          manual("analysis-suspended");
          return;
        }
        try {
          this.detector.getFloatTimeDomainData(samples);
          let energy = 0;
          for (const sample of samples) energy += sample * sample;
          const rms = Math.sqrt(energy / samples.length);
          const now = performance.now();
          const elapsed = now - previousTime;
          previousTime = now;
          // A delayed timer is not evidence that the intervening audio was quiet.
          if (elapsed > 250) {
            quietMs = 0;
            speechMs = 0;
          } else {
            const observedMs = Math.min(100, Math.max(0, elapsed));
            if (!heardSpeech) {
              speechMs = rms >= 0.015 ? speechMs + observedMs : 0;
              heardSpeech = speechMs >= 250;
              if (heardSpeech) {
                if (this.continuous) {
                  clearTimeout(this.captureTimer);
                  this.timers.delete(this.captureTimer);
                  this.captureTimer = this.later(() => this.finish("capture-limit"), this.captureLimitMs);
                }
                this.callbacks.speechStart?.();
              }
            }
            quietMs = heardSpeech && rms < 0.008 ? quietMs + observedMs : 0;
            if (quietMs >= this.quietPauseMs) {
              this.finish("quiet-pause");
              return;
            }
          }
          this.detectionTimer = this.later(poll, 50);
        } catch {
          manual("analysis-failed");
        }
      };
      this.callbacks.status(this.continuous
        ? `Conversation mic is listening. Speak to interrupt; pause for ${this.quietPauseMs / 1000} seconds to send. Stop ends the session.`
        : `Live listening. A ${this.quietPauseMs / 1000}-second quiet pause finishes your transcript; Done also works (${this.captureLimitMs / 1000}-second limit).`, this.state);
      this.detectionTimer = this.later(poll, 50);
    } catch {
      manual("analysis-failed");
    }
  }

  async start(language) {
    this.startedAt = performance.now();
    this.startedAtUtc = new Date().toISOString();
    this.language = language;
    this.later(() => this.fail("Live transcription connection timed out. Try Record or type.", "connection-timeout"), 45000);
    // Begin resume from the button gesture, before awaiting microphone access.
    if (this.autoFinish) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.detectionContext = new AudioContext();
          void this.detectionContext.resume().catch(() => {});
        }
      } catch {
        this.stopSpeechDetection();
      }
    }
    let stage = "capture";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length || audioTracks.some((track) => track.readyState === "ended")) {
        this.fail("The microphone is no longer available. Reconnect it and start Live mic again, or type.", "capture-ended");
        return;
      }
      for (const track of audioTracks) {
        const onEnded = () => this.fail(
          "Microphone capture ended unexpectedly. Reconnect or allow the microphone, then start Live mic again. Your previous draft is restored.",
          "capture-ended",
        );
        this.trackEndListeners.push([track, onEnded]);
        track.addEventListener("ended", onEnded, { once: true });
      }
      stage = "connection";
      const peer = new RTCPeerConnection();
      this.peer = peer;
      audioTracks.forEach((track) => {
        track.enabled = false;
        peer.addTrack(track, stream);
      });
      peer.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          this.fail("Live transcription disconnected. Try again or type your question.", "connection-closed");
        }
      });
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      channel.addEventListener("message", ({ data }) => this.event(data));
      channel.addEventListener("close", () => this.fail("Live transcription ended before a final transcript arrived.", "connection-closed"));
      channel.addEventListener("error", () => this.fail("Live transcription connection failed. Try Record or type.", "connection-failed"));
      channel.addEventListener("open", () => {
        if (this.closed) return;
        this.timers.forEach(clearTimeout);
        this.timers.clear();
        if (this.continuous) {
          this.later(() => this.fail("The five-minute conversation limit was reached. Start Live mic again when ready.", "session-limit"), 300000);
        }
        this.beginListening();
      });
      stage = "session";
      const tokenResponse = await window.BolPrepFetch("/api/transcription/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
        signal: this.controller.signal,
      });
      const token = JSON.parse(await this.readHandshakeText(tokenResponse, 64 * 1024));
      if (!token || typeof token !== "object" || Array.isArray(token)) {
        throw new Error("Live setup returned invalid session data.");
      }
      if (this.closed) return;
      if (tokenResponse.status === 429) {
        const wait = Number.isInteger(token.retry_after_seconds) && token.retry_after_seconds > 0
          && token.retry_after_seconds <= 60 ? token.retry_after_seconds : 60;
        const busy = token.code === "server-busy";
        this.fail(`${busy ? "The tutor is busy" : "Live session limit reached"}. Wait ${wait} seconds, then start Live mic again.`,
          busy ? "server-busy" : "rate-limited");
        return;
      }
      if (!tokenResponse.ok || typeof token.client_secret !== "string"
          || token.client_secret.length < 1 || token.client_secret.length > 4096
          || /[^\x21-\x7e]/.test(token.client_secret)
          || !Number.isSafeInteger(token.expires_at) || token.expires_at * 1000 <= Date.now()) {
        throw new Error("Live transcription could not obtain a session. Try Record or type.");
      }
      stage = "connection";
      const offer = await peer.createOffer();
      if (this.closed) return;
      await peer.setLocalDescription(offer);
      if (this.closed) return;
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.client_secret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
        signal: this.controller.signal,
      });
      token.client_secret = null;
      if (!response.ok) throw new Error("The live speech provider rejected the connection. Try Record or type.");
      const sdp = await this.readHandshakeText(response, 512 * 1024);
      if (!sdp.trim()) throw new Error("Live setup returned no connection description.");
      if (this.closed) return;
      await peer.setRemoteDescription({ type: "answer", sdp });
    } catch (error) {
      if (this.closed) return;
      const permission = stage === "capture" && ["NotAllowedError", "SecurityError"].includes(error?.name);
      this.fail(permission
        ? "Microphone permission was blocked. Allow microphone access or type your question."
        : "Live transcription could not connect. Check your microphone and connection, or use Record or typing.",
      permission ? "capture-permission" : `${stage}-failed`);
    }
  }
}

window.BolPrepLiveTranscription = BolPrepLiveTranscription;
