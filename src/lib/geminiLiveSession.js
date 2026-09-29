/**
 * geminiLiveSession.js  v4 — Reliable Automatic Voice Conversation
 *
 * Architecture:
 *  1. Hardware mic → 16kHz PCM → Gemini realtimeInput.mediaChunks (continuous)
 *  2. Client-side RMS VAD:
 *       speech detected  → activityStart  (tells Gemini "user started talking")
 *       1.2s silence     → activityEnd    (tells Gemini "user finished, please respond")
 *  3. AI audio → 24kHz PCM → Web Audio API → speakers
 *  4. While AI speaks: mic stream is DROPPED (not blocked, just not sent) to prevent echo
 *  5. Safety unlock: if mic stays blocked >4s after AI started speaking, force-unlock
 *
 * NO manual submit button needed — fully automatic like Google Gemini Live.
 */

const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const DEFAULT_MODEL = 'models/gemini-2.0-flash-exp';

// ─── VAD thresholds ───────────────────────────────────────────────────────────
const SPEECH_RMS_THRESHOLD = 0.025;   // min RMS to consider as speech (raised to avoid noise/echo)
const NOISE_BURST_IGNORE = 12;         // require ~240ms of continuous speech before triggering
const MIN_SPEECH_DURATION_MS = 400;   // minimum speech duration before sending activityEnd
const SILENCE_BEFORE_COMMIT_MS = 1500; // silence duration before sending activityEnd
const MIC_UNBLOCK_DELAY_MS = 350;      // wait after AI audio ends before re-enabling mic
const MIC_SAFETY_UNLOCK_MS = 6000;     // force unlock if AI audio takes too long

// ─── Utilities ────────────────────────────────────────────────────────────────

function toBase64(int16Array) {
  const u8 = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let b = '';
  for (let i = 0; i < u8.length; i++) b += String.fromCharCode(u8[i]);
  return btoa(b);
}

function base64ToFloat32(base64, outputRate = 24000) {
  const b = atob(base64);
  const u8 = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
  const i16 = new Int16Array(u8.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
  return f32;
}

function resample(float32, fromRate, toRate = 16000) {
  if (Math.abs(fromRate - toRate) < 1) {
    // already at target rate, just convert
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
    }
    return out;
  }
  const ratio = fromRate / toRate;
  const len = Math.round(float32.length / ratio);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(float32.length - 1, lo + 1);
    const t = pos - lo;
    const s = Math.max(-1, Math.min(1, float32[lo] * (1 - t) + float32[hi] * t));
    out[i] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
  }
  return out;
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

// ─── GeminiLiveSession ────────────────────────────────────────────────────────

export class GeminiLiveSession {
  constructor({
    apiKey,
    candidateName = 'Candidate',
    cvContext = '',
    language = 'ar-EG',
    interviewerId = 'ahmed',
    voiceName = null,

    // ── Callbacks ─────────────────────────────────────────────────────────
    onTranscript,           // ({role, text, isFinal})
    onAudioLevel,           // (0-1) AI speaking level → avatar lip-sync
    onUserAudioLevel,       // (0-1) mic RMS → user waveform UI
    onSpeakingChange,       // (bool) AI playing audio
    onUserSpeakingChange,   // (bool) user VAD detected
    onTurnStateChange,      // ('listening'|'user_speaking'|'thinking'|'ai_speaking')
    onStatusChange,         // ('connecting'|'connected'|'ready'|'reconnecting'|'error')
    onLatencyChange,        // ({latencyMs, quality})
    onError,
    onInterrupted,
  }) {
    this.apiKey = apiKey;
    this.candidateName = candidateName;
    this.cvContext = cvContext;
    this.language = language;
    this.interviewerId = interviewerId;
    this.voiceName = voiceName || (interviewerId === 'sara' ? 'Aoede' : 'Puck');

    this.onTranscript = onTranscript;
    this.onAudioLevel = onAudioLevel;
    this.onUserAudioLevel = onUserAudioLevel;
    this.onSpeakingChange = onSpeakingChange;
    this.onUserSpeakingChange = onUserSpeakingChange;
    this.onTurnStateChange = onTurnStateChange;
    this.onStatusChange = onStatusChange;
    this.onLatencyChange = onLatencyChange;
    this.onError = onError;
    this.onInterrupted = onInterrupted;

    // ── WebSocket ──────────────────────────────────────────────────────────
    this.ws = null;
    this.isConnected = false;
    this.isReady = false;
    this._closing = false;
    this._retries = 0;
    this._retryTimer = null;

    // ── Turn state machine ─────────────────────────────────────────────────
    // 'listening' | 'user_speaking' | 'thinking' | 'ai_speaking'
    this._turnState = 'listening';
    this._isSpeaking = false;       // AI audio playing
    this._isMicMuted = false;       // user explicitly muted
    this._micBlocked = false;       // internal: blocked while AI speaks

    // ── VAD state ──────────────────────────────────────────────────────────
    this._vadSpeaking = false;       // currently detecting speech
    this._silenceTimer = null;       // fires activityEnd after silence
    this._speechFrameCount = 0;     // consecutive frames with speech
    this._activityStartSent = false;
    this._speechStartTime = null;   // for latency tracking

    // ── Safety timers ──────────────────────────────────────────────────────
    this._safetyUnlockTimer = null;
    this._thinkingWatchdog = null;

    // ── Output audio (AI, 24kHz) ───────────────────────────────────────────
    this._outCtx = null;
    this._analyser = null;
    this._sources = [];
    this._nextPlay = 0;
    this._rafId = null;
    this._aiLevel = 0;
    this._levelTs = 0;

    // ── Input audio (user mic, hardware rate → 16kHz) ──────────────────────
    this._inCtx = null;
    this._micStream = null;
    this._micSrc = null;
    this._processor = null;
    this._micActive = false;

    // ── Transcript buffer ──────────────────────────────────────────────────
    this._assistantBuf = '';
  }

  // ─── Public: connect ─────────────────────────────────────────────────────

  async connect() {
    this._emitStatus('connecting');

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this._outCtx || this._outCtx.state === 'closed') {
      this._outCtx = new AC({ sampleRate: 24000 });
    }
    if (this._outCtx.state === 'suspended') await this._outCtx.resume().catch(() => {});

    this._analyser = this._outCtx.createAnalyser();
    this._analyser.fftSize = 256;
    this._analyser.smoothingTimeConstant = 0.6;
    this._analyser.connect(this._outCtx.destination);

    this._startLevelRaf();
    return this._connect();
  }

  // ─── WebSocket lifecycle ──────────────────────────────────────────────────

  _connect() {
    this._closing = false;
    this.ws = new WebSocket(`${LIVE_WS_URL}?key=${this.apiKey}`);

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (ok, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);
        ok ? resolve(val) : reject(val);
      };

      const connectTimeout = setTimeout(() => {
        try { this.ws?.close(); } catch (_) {}
        settle(false, new Error('WebSocket connect timeout'));
      }, 5000);

      this.ws.onopen = () => {
        this.isConnected = true;
        this._retries = 0;
        this._emitStatus('connected');
        this._sendSetup();
      };

      this.ws.onmessage = async (ev) => {
        try {
          const text = ev.data instanceof Blob ? await ev.data.text() : ev.data;
          const msg = JSON.parse(text);
          this._onMessage(msg);
          if (msg.setupComplete && !this.isReady) {
            this.isReady = true;
            this._emitStatus('ready');
            settle(true);
          }
        } catch (e) {
          console.error('[GLS] parse error', e);
        }
      };

      this.ws.onerror = (e) => {
        this.onError?.(e);
        settle(false, e);
      };

      this.ws.onclose = (ev) => {
        this.isConnected = false;
        this.isReady = false;
        this._setSpeaking(false);
        this._emitStatus('reconnecting');
        settle(false, new Error(`WS closed ${ev.code}`));

        if (!this._closing && this._retries < 3) {
          this._retries++;
          const delay = 800 * Math.pow(2, this._retries - 1);
          this._retryTimer = setTimeout(() => {
            if (!this._closing) this._connect().catch(e => { this.onError?.(e); this._emitStatus('error'); });
          }, delay);
        } else if (!this._closing) {
          this._emitStatus('error');
        }
      };
    });
  }

  // ─── Setup frame ─────────────────────────────────────────────────────────

  _sendSetup() {
    const isAr = this.language.startsWith('ar');
    const isF = this.interviewerId === 'sara';
    const model = localStorage.getItem('prova_admin_model') || DEFAULT_MODEL;
    const adminPrompt = localStorage.getItem('prova_admin_sys_prompt') || '';

    const sys = `You are "${isF ? 'سارة' : 'أحمد'}" (${isF ? 'Sara' : 'Ahmed'}), an executive interviewer at Prova.
You are a ${isF ? 'female' : 'male'} interviewer. ${isAr ? `Use natural ${isF ? 'feminine' : 'masculine'} Egyptian Arabic (لهجة مصرية بيضاء مهنية).` : 'Speak fluent professional English.'}
You are conducting a live job interview with: ${this.candidateName}

CANDIDATE PROFILE:
"""
${this.cvContext || `Name: ${this.candidateName}. No CV provided. Ask about their background and target role.`}
"""

RULES:
1. STRICT ROLE ADHERENCE: You are exclusively a technical hiring manager evaluating the candidate for the target role. NEVER engage in off-topic discussions, personal questions, or general AI assistance. If the candidate strays or asks irrelevant questions, immediately and politely steer them back to the technical job interview.
2. STUDY CV FIRST: Read and ground all questions strictly in the candidate's CV profile above (specific projects, tools, architectures, companies). Forbidden to ask generic canned questions like "Tell me about yourself".
3. Greet by name only on the very first turn. Never repeat greetings once the interview is underway.
4. Ask dynamic, tailored questions based on what the candidate ACTUALLY SAYS, probing into real code, technical decisions, and architecture.
5. Keep each turn SHORT (1-2 sentences). Give candidate maximum speaking time.
6. After each question: STOP SPEAKING. Wait silently. Let them answer naturally.
7. NEVER fill silence — just wait patiently.
${adminPrompt ? `\nOverride:\n${adminPrompt}` : ''}`;

    this._send({
      setup: {
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
          },
        },
        systemInstruction: { parts: [{ text: sys }] },
      },
    });
  }

  // ─── Incoming messages ────────────────────────────────────────────────────

  _onMessage(msg) {
    if (!msg.serverContent) return;
    const { modelTurn, outputTranscription, inputTranscription, interrupted, turnComplete } = msg.serverContent;

    // Latency measurement
    if ((outputTranscription || modelTurn) && this._speechStartTime) {
      const ms = Date.now() - this._speechStartTime;
      this._speechStartTime = null;
      const quality = ms < 1500 ? 'excellent' : ms < 3500 ? 'good' : 'fair';
      this.onLatencyChange?.({ latencyMs: ms, quality });
    }

    // AI interrupted user
    if (interrupted) {
      this._flushOutput();
      this._setSpeaking(false);
      this._setTurn('listening');
      this.onInterrupted?.();
      return;
    }

    // AI text (streaming)
    if (outputTranscription?.text) {
      const t = outputTranscription.text;
      if (!this._isMeta(t)) {
        this._assistantBuf += t;
        this.onTranscript?.({ role: 'assistant', text: this._assistantBuf, isFinal: false });
      }
    }

    // What Gemini heard from user mic
    if (inputTranscription?.text) {
      const t = inputTranscription.text;
      if (!this._isMeta(t)) {
        this.onTranscript?.({ role: 'user', text: t, isFinal: false });
      }
    }

    // AI audio chunks
    if (modelTurn?.parts) {
      this._setTurn('ai_speaking');
      for (const part of modelTurn.parts) {
        if (part.inlineData?.data) this._playChunk(part.inlineData.data);
      }
    }

    // Turn complete
    if (turnComplete) {
      const txt = this._assistantBuf.trim();
      if (txt && !this._isMeta(txt)) {
        this.onTranscript?.({ role: 'assistant', text: txt, isFinal: true });
      }
      this._assistantBuf = '';
    }
  }

  _isMeta(t) {
    const l = t.toLowerCase();
    return l.includes('waiting for the candidate') || l.includes("candidate's response");
  }

  // ─── Turn state ───────────────────────────────────────────────────────────

  _setTurn(state) {
    if (this._thinkingWatchdog) { clearTimeout(this._thinkingWatchdog); this._thinkingWatchdog = null; }
    if (this._turnState !== state) {
      this._turnState = state;
      this.onTurnStateChange?.(state);
    }
    if (state === 'thinking') {
      this._thinkingWatchdog = setTimeout(() => {
        if (this._turnState === 'thinking') {
          console.warn('[GLS] thinking watchdog fired → listening');
          this._setTurn('listening');
        }
      }, 8000);
    }
  }

  // ─── Output audio ─────────────────────────────────────────────────────────

  _playChunk(b64) {
    if (!this._outCtx || this._outCtx.state === 'closed') return;

    const f32 = base64ToFloat32(b64);
    const buf = this._outCtx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);

    const src = this._outCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this._analyser);

    const now = this._outCtx.currentTime;
    const start = Math.max(now + 0.01, this._nextPlay);
    this._nextPlay = start + buf.duration;

    src.start(start);
    this._sources.push(src);
    this._setSpeaking(true);
    this._blockMic();

    src.onended = () => {
      this._sources = this._sources.filter(s => s !== src);
      if (this._sources.length === 0) {
        this._setSpeaking(false);
        this._setTurn('listening');
        this._unblockMicDelayed();
      }
    };
  }

  _flushOutput() {
    this._sources.forEach(s => { try { s.stop(0); s.disconnect(); } catch (_) {} });
    this._sources = [];
    if (this._outCtx) this._nextPlay = this._outCtx.currentTime;
    this._setSpeaking(false);
    this._unblockMicDelayed();
  }

  _setSpeaking(v) {
    if (this._isSpeaking !== v) {
      this._isSpeaking = v;
      this.onSpeakingChange?.(v);
      if (!v) { this._aiLevel = 0; this.onAudioLevel?.(0); }
    }
  }

  // ─── Mic blocking (prevent echo during AI speech) ─────────────────────────

  _blockMic() {
    this._micBlocked = true;
    // Cancel any pending VAD timers
    if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }

    // ⚠️ CRITICAL FIX: Only send activityEnd if user actually started speaking.
    // Sending activityEnd when nobody spoke causes Gemini to process empty audio
    // and respond with a turnComplete, creating the listen→think infinite loop.
    if (this._activityStartSent && this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try { this._send({ realtimeInput: { activityEnd: {} } }); } catch (_) {}
    }

    this._vadSpeaking = false;
    this._speechFrameCount = 0;
    this._activityStartSent = false;
    this._speechStartTime = null;

    // Safety unlock: if AI audio never ends, force unlock
    if (this._safetyUnlockTimer) clearTimeout(this._safetyUnlockTimer);
    this._safetyUnlockTimer = setTimeout(() => {
      if (this._micBlocked) {
        console.warn('[GLS] Safety unlock fired');
        this._micBlocked = false;
        this._setSpeaking(false);
        this._setTurn('listening');
        if (this._micActive) this._restartSubtitles();
      }
    }, MIC_SAFETY_UNLOCK_MS);
  }

  _unblockMicDelayed() {
    if (this._safetyUnlockTimer) { clearTimeout(this._safetyUnlockTimer); this._safetyUnlockTimer = null; }
    setTimeout(() => {
      this._micBlocked = false;
      if (this._micActive && !this._isMicMuted) this._restartSubtitles();
    }, MIC_UNBLOCK_DELAY_MS);
  }

  // ─── Level tracker (avatar lip-sync) ─────────────────────────────────────

  _startLevelRaf() {
    const data = new Uint8Array(this._analyser.frequencyBinCount);
    const tick = (ts) => {
      if (this._isSpeaking && this._analyser) {
        this._analyser.getByteFrequencyData(data);
        let sum = 0, n = 0;
        for (let i = 2; i < 35 && i < data.length; i++) { sum += data[i]; n++; }
        const level = Math.min(1, Math.max(0, (sum / (n || 1) - 15) / 105));
        this._aiLevel = level;
        if (ts - this._levelTs > 40) { this._levelTs = ts; this.onAudioLevel?.(level); }
      } else if (this._aiLevel !== 0) {
        this._aiLevel = 0;
        this.onAudioLevel?.(0);
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  getAudioLevel() { return this._aiLevel; }

  // ─── Microphone ───────────────────────────────────────────────────────────

  async startMicrophone() {
    this._micActive = true;
    this._isMicMuted = false;
    this._micBlocked = false;
    await this._openMicStream();
    this._startSubtitles();
  }

  async _openMicStream() {
    if (this._micStream?.active) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: { ideal: 16000 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this._micStream = stream;

    // Use native AudioContext (will be whatever rate the OS gives us)
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this._inCtx || this._inCtx.state === 'closed') {
      this._inCtx = new AC();
    }
    if (this._inCtx.state === 'suspended') await this._inCtx.resume().catch(() => {});

    const src = this._inCtx.createMediaStreamSource(stream);
    // Buffer 4096 for reliable timing, 1 input channel, 1 output channel
    const proc = this._inCtx.createScriptProcessor(4096, 1, 1);

    // Mute loopback (required for processor to fire in Chrome)
    const mute = this._inCtx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(this._inCtx.destination);

    this._micSrc = src;
    this._processor = proc;
    const nativeRate = this._inCtx.sampleRate;

    proc.onaudioprocess = (e) => {
      if (!this._micActive) return;

      const input = e.inputBuffer.getChannelData(0);
      const energy = rms(input);
      const userLevel = Math.min(1, energy * 10);
      this.onUserAudioLevel?.(userLevel);

      // ── VAD ─────────────────────────────────────────────────────────────
      if (!this._micBlocked && !this._isMicMuted) {
        this._runVAD(energy, input, nativeRate);
      }
    };
  }

  // ─── Client-side VAD ─────────────────────────────────────────────────────

  _runVAD(energy, input, nativeRate) {
    const isSpeech = energy > SPEECH_RMS_THRESHOLD;

    if (isSpeech) {
      this._speechFrameCount++;

      // Require N consecutive speech frames to confirm real speech (not noise burst)
      if (this._speechFrameCount >= NOISE_BURST_IGNORE) {
        // User still speaking — cancel silence timer
        if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }

        if (!this._vadSpeaking) {
          // Confirmed: real speech started
          this._vadSpeaking = true;
          this._speechStartTime = Date.now();
          this.onUserSpeakingChange?.(true);
          this._setTurn('user_speaking');

          // Signal Gemini: user started speaking
          if (!this._activityStartSent && this.ws?.readyState === WebSocket.OPEN) {
            this._send({ realtimeInput: { activityStart: {} } });
            this._activityStartSent = true;
            console.log('[GLS] VAD → activityStart sent');
          }
        }

        // Stream PCM to Gemini
        const pcm = resample(input, nativeRate, 16000);
        if (this.ws?.readyState === WebSocket.OPEN && this.isConnected) {
          this._send({
            realtimeInput: {
              mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: toBase64(pcm) }],
            },
          });
        }
      }
    } else {
      // Silence frame
      if (this._speechFrameCount > 0) this._speechFrameCount = Math.max(0, this._speechFrameCount - 2); // decay

      // Only start silence timer if:
      // 1. We confirmed user was speaking (VAD active)
      // 2. We actually sent activityStart to Gemini
      // 3. User spoke long enough (MIN_SPEECH_DURATION_MS) to be a real utterance
      if (this._vadSpeaking && this._activityStartSent && !this._silenceTimer) {
        const speechDuration = this._speechStartTime ? Date.now() - this._speechStartTime : 0;
        if (speechDuration >= MIN_SPEECH_DURATION_MS) {
          // Start countdown to activityEnd
          this._silenceTimer = setTimeout(() => {
            this._silenceTimer = null;
            if (this._vadSpeaking && this._activityStartSent && !this._micBlocked && !this._isMicMuted) {
              this._vadSpeaking = false;
              this._activityStartSent = false;
              this.onUserSpeakingChange?.(false);
              this._setTurn('thinking');
              // Tell Gemini: user finished — respond now
              if (this.ws?.readyState === WebSocket.OPEN) {
                this._send({ realtimeInput: { activityEnd: {} } });
                console.log('[GLS] VAD → activityEnd sent (after', Math.round(speechDuration), 'ms speech)');
              }
            }
          }, SILENCE_BEFORE_COMMIT_MS);
        } else {
          // Speech was too short — likely noise, cancel and reset
          console.log('[GLS] VAD: speech too short (', Math.round(speechDuration), 'ms) — ignored');
          this._vadSpeaking = false;
          this._activityStartSent = false;
          this._speechFrameCount = 0;
          this.onUserSpeakingChange?.(false);
          // Tell Gemini to ignore what it received
          if (this.ws?.readyState === WebSocket.OPEN) {
            this._send({ realtimeInput: { activityEnd: {} } });
          }
          this._setTurn('listening');
        }
      }
    }
  }

  // ─── SpeechRecognition (subtitles only) ──────────────────────────────────

  _recognition = null;

  _startSubtitles() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || this._isMicMuted) return;

    this._stopSubtitles();
    try {
      const rec = new SR();
      rec.lang = this.language;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (ev) => {
        if (this._isSpeaking || this._micBlocked) return;
        let text = '';
        for (let i = 0; i < ev.results.length; i++) {
          if (ev.results[i]?.[0]?.transcript) text += (text ? ' ' : '') + ev.results[i][0].transcript.trim();
        }
        if (text) this.onTranscript?.({ role: 'user', text, isFinal: false });
      };

      rec.onerror = (e) => {
        if (e.error === 'no-speech') return;
        if (this._micActive && !this._isMicMuted && !this._micBlocked) {
          setTimeout(() => this._startSubtitles(), 300);
        }
      };

      rec.onend = () => {
        if (this._micActive && !this._isMicMuted && !this._micBlocked) {
          setTimeout(() => { try { rec.start(); } catch (_) { this._startSubtitles(); } }, 100);
        }
      };

      rec.start();
      this._recognition = rec;
    } catch (_) {}
  }

  _stopSubtitles() {
    if (this._recognition) {
      try { this._recognition.onend = null; this._recognition.abort(); } catch (_) {}
      this._recognition = null;
    }
  }

  _restartSubtitles() {
    this._stopSubtitles();
    if (this._micActive && !this._isMicMuted) this._startSubtitles();
  }

  // ─── Mute / Unmute ────────────────────────────────────────────────────────

  muteUser() {
    this._isMicMuted = true;
    this._vadSpeaking = false;
    this._speechFrameCount = 0;
    if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
    this._stopSubtitles();
  }

  unmuteUser() {
    this._isMicMuted = false;
    if (this._micActive && !this._micBlocked) this._startSubtitles();
  }

  // ─── Interrupt AI ─────────────────────────────────────────────────────────

  interruptAI() {
    this._flushOutput();
    this._setSpeaking(false);
    this._micBlocked = false;
    this._setTurn('listening');
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send({ realtimeInput: { activityStart: {} } });
    }
    this.onInterrupted?.();
    this._restartSubtitles();
  }

  // ─── Text message ─────────────────────────────────────────────────────────

  sendTextMessage(text) {
    if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) return;
    this._flushOutput();
    this._blockMic();
    this._setTurn('thinking');
    this._speechStartTime = Date.now();
    this._send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    });
  }

  // ─── Kickoff ──────────────────────────────────────────────────────────────

  sendKickoffPrompt(text) {
    if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN) return;
    this._setTurn('ai_speaking');
    this._send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    });
  }

  // ─── Resume audio context ─────────────────────────────────────────────────

  async resumeAudio() {
    if (this._outCtx?.state === 'suspended') await this._outCtx.resume().catch(() => {});
    if (this._inCtx?.state === 'suspended') await this._inCtx.resume().catch(() => {});
  }

  // ─── Stop mic ─────────────────────────────────────────────────────────────

  stopMicrophone() {
    this._micActive = false;
    this._isMicMuted = true;
    this._micBlocked = true;
    if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
    this._stopSubtitles();
    if (this._processor) { try { this._processor.disconnect(); } catch (_) {} this._processor = null; }
    if (this._micSrc) { try { this._micSrc.disconnect(); } catch (_) {} this._micSrc = null; }
    if (this._micStream) { try { this._micStream.getTracks().forEach(t => t.stop()); } catch (_) {} this._micStream = null; }
    if (this._inCtx?.state !== 'closed') { try { this._inCtx.close(); } catch (_) {} this._inCtx = null; }
  }

  // ─── Full disconnect ──────────────────────────────────────────────────────

  disconnect() {
    this._closing = true;
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
    if (this._safetyUnlockTimer) { clearTimeout(this._safetyUnlockTimer); this._safetyUnlockTimer = null; }
    if (this._thinkingWatchdog) { clearTimeout(this._thinkingWatchdog); this._thinkingWatchdog = null; }
    if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
    this.stopMicrophone();
    this._flushOutput();
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._analyser) { try { this._analyser.disconnect(); } catch (_) {} this._analyser = null; }
    if (this._outCtx?.state !== 'closed') { try { this._outCtx.close(); } catch (_) {} this._outCtx = null; }
    if (this.ws) {
      try { this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null; this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isReady = false;
    this._setSpeaking(false);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _emitStatus(s) { this.onStatusChange?.(s); }
}
