// One microphone turn per connection. The server mints a short-lived credential;
// media goes directly to the provider over WebRTC and is never saved by BolPrep.
class BolPrepLiveTranscription {
  constructor(callbacks, { autoFinish = false } = {}) {
    this.callbacks = callbacks;
    this.autoFinish = autoFinish;
    this.controller = new AbortController();
    this.timers = new Set();
    this.closed = false;
    this.state = "connecting";
    this.partial = "";
    this.itemId = null;
    this.committedItemId = null;
  }

  later(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.closed) callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  fail(message) {
    if (this.closed) return;
    this.cancel();
    this.callbacks.error(message);
  }

  cancel() {
    if (this.closed) return;
    this.closed = true;
    this.controller.abort();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.stopSpeechDetection();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.channel?.close();
    this.peer?.close();
    this.callbacks.closed();
  }

  finish() {
    if (this.closed || this.state !== "listening") return;
    this.state = "finalizing";
    this.stopSpeechDetection();
    clearTimeout(this.captureTimer);
    this.timers.delete(this.captureTimer);
    this.stream.getTracks().forEach((track) => { track.enabled = false; });
    this.callbacks.status("Finishing live transcript…", this.state);
    // Allow the last media packets to travel before committing the audio turn.
    this.later(() => {
      this.stream.getTracks().forEach((track) => track.stop());
      if (this.channel.readyState !== "open") {
        this.fail("Live transcription disconnected. Partial words were discarded; try again or type.");
        return;
      }
      this.channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      this.later(() => this.fail("No final live transcript arrived. Try Record or type your question."), 30000);
    }, 250);
  }

  event(data) {
    if (this.closed) return;
    let event;
    try { event = JSON.parse(data); } catch { return; }
    if (!event || typeof event !== "object" || typeof event.type !== "string") return;
    if (event.type === "error" || event.type === "conversation.item.input_audio_transcription.failed") {
      this.fail("The live transcription provider could not finish. Try Record or type your question.");
      return;
    }
    if (event.type === "input_audio_buffer.committed" && this.state === "finalizing") {
      this.committedItemId = event.item_id;
      return;
    }
    if (!event.type?.startsWith("conversation.item.input_audio_transcription.")) return;
    if (typeof event.item_id !== "string" || !event.item_id) return;
    if (this.itemId && this.itemId !== event.item_id) return;
    if (this.committedItemId && this.committedItemId !== event.item_id) return;
    this.itemId = event.item_id;
    if (event.type === "conversation.item.input_audio_transcription.delta" && typeof event.delta === "string") {
      this.partial += event.delta;
      if (this.partial.length > 6000) {
        this.fail("Live transcript is too long. Please use a shorter question.");
        return;
      }
      this.callbacks.partial(this.partial);
    } else if (event.type === "conversation.item.input_audio_transcription.completed" && this.state === "finalizing") {
      const text = typeof event.transcript === "string" ? event.transcript.trim() : "";
      if (!text) {
        this.fail("No speech was transcribed. Try again or type your question.");
        return;
      }
      this.cancel();
      this.callbacks.final(text);
    }
  }

  stopSpeechDetection() {
    clearTimeout(this.detectionTimer);
    this.timers.delete(this.detectionTimer);
    this.detectionSource?.disconnect();
    this.detectionSource = null;
    this.detector?.disconnect();
    this.detector = null;
    const context = this.detectionContext;
    this.detectionContext = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }

  startSpeechDetection() {
    if (!this.autoFinish) return;
    const manual = () => {
      this.stopSpeechDetection();
      this.callbacks.status("Automatic pause detection is unavailable. Tap Done when finished (20-second limit).", this.state);
    };
    const context = this.detectionContext;
    if (!context || context.state !== "running") {
      manual();
      return;
    }
    try {
      this.detector = context.createAnalyser();
      this.detector.fftSize = 2048;
      this.detectionSource = context.createMediaStreamSource(this.stream);
      // No speaker connection: inspect microphone energy without playing it.
      this.detectionSource.connect(this.detector);
      const samples = new Float32Array(this.detector.fftSize);
      let previousTime = performance.now();
      let speechMs = 0;
      let quietMs = 0;
      let heardSpeech = false;
      const poll = () => {
        if (this.closed || this.state !== "listening") return;
        if (context.state !== "running") {
          manual();
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
            }
            quietMs = heardSpeech && rms < 0.008 ? quietMs + observedMs : 0;
            if (quietMs >= 3000) {
              this.finish();
              return;
            }
          }
          this.detectionTimer = this.later(poll, 50);
        } catch {
          manual();
        }
      };
      this.callbacks.status("Live listening. A 3-second quiet pause finishes your transcript; Done also works (20-second limit).", this.state);
      this.detectionTimer = this.later(poll, 50);
    } catch {
      manual();
    }
  }

  async start(language) {
    this.later(() => this.fail("Live transcription connection timed out. Try Record or type."), 45000);
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const peer = new RTCPeerConnection();
      this.peer = peer;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        peer.addTrack(track, stream);
      });
      peer.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          this.fail("Live transcription disconnected. Try again or type your question.");
        }
      });
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      channel.addEventListener("message", ({ data }) => this.event(data));
      channel.addEventListener("close", () => this.fail("Live transcription ended before a final transcript arrived."));
      channel.addEventListener("error", () => this.fail("Live transcription connection failed. Try Record or type."));
      channel.addEventListener("open", () => {
        if (this.closed) return;
        this.timers.forEach(clearTimeout);
        this.timers.clear();
        this.state = "listening";
        stream.getAudioTracks().forEach((track) => { track.enabled = true; });
        this.callbacks.status("Live listening. Tap Done when you finish (20-second limit).", this.state);
        this.captureTimer = this.later(() => this.finish(), 20000);
        this.startSpeechDetection();
      });
      const tokenResponse = await fetch("/api/transcription/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
        signal: this.controller.signal,
      });
      const token = await tokenResponse.json();
      if (this.closed) return;
      if (!tokenResponse.ok || typeof token.client_secret !== "string"
          || !Number.isFinite(token.expires_at) || token.expires_at * 1000 <= Date.now()) {
        throw new Error("Live transcription could not obtain a session. Try Record or type.");
      }
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
      const sdp = await response.text();
      if (this.closed) return;
      await peer.setRemoteDescription({ type: "answer", sdp });
    } catch (error) {
      if (this.closed) return;
      const permission = ["NotAllowedError", "SecurityError"].includes(error?.name);
      this.fail(permission
        ? "Microphone permission was blocked. Allow microphone access or type your question."
        : "Live transcription could not connect. Check your microphone and connection, or use Record or typing.");
    }
  }
}

window.BolPrepLiveTranscription = BolPrepLiveTranscription;
