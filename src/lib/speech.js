/**
 * speech.js — Neural Voice Engine & Speech Recognition
 * 
 * Powered by Neural Edge TTS (/api/text-to-speech) and Web Audio API
 * Zero use of browser speechSynthesis.
 */

export const isSpeechRecognitionSupported = !!(
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)
);

// ── 1. Speech Recognition ──
let recognitionInstance = null;
let isExplicitlyStopped = false;

export function startListening({
  lang = 'ar-EG',
  continuous = true,
  onTranscriptUpdate,
  onError,
  onEnd,
}) {
  if (!isSpeechRecognitionSupported) {
    onError?.('not_supported');
    return;
  }

  isExplicitlyStopped = false;

  try {
    if (recognitionInstance) {
      try {
        recognitionInstance.abort();
      } catch (_e) {}
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionInstance = new SR();
    recognitionInstance.lang = lang;
    recognitionInstance.interimResults = true;
    recognitionInstance.maxAlternatives = 1;
    recognitionInstance.continuous = continuous;

    let accumulatedFinalText = '';

    recognitionInstance.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          accumulatedFinalText += (accumulatedFinalText ? ' ' : '') + item[0].transcript.trim();
        } else {
          interim += item[0].transcript;
        }
      }

      const fullCurrentText = (
        accumulatedFinalText + (interim ? (accumulatedFinalText ? ' ' : '') + interim : '')
      ).trim();

      if (fullCurrentText) {
        onTranscriptUpdate?.({
          text: fullCurrentText,
          hasFinal: !!accumulatedFinalText,
        });
      }
    };

    recognitionInstance.onerror = (event) => {
      if (event.error === 'no-speech') {
        return; // Normal pause in conversation
      }
      console.warn('[Speech] recognition error:', event.error);
      onError?.(event.error);
    };

    recognitionInstance.onend = () => {
      if (continuous && !isExplicitlyStopped && recognitionInstance) {
        try {
          recognitionInstance.start();
          return;
        } catch (_e) {}
      }
      onEnd?.();
    };

    recognitionInstance.start();
  } catch (e) {
    console.warn('[Speech] start exception:', e);
    onError?.(e.message || 'start_failed');
  }
}

export function stopListening() {
  isExplicitlyStopped = true;
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (_e) {}
    recognitionInstance = null;
  }
}

// ── User Mic RMS Audio Level Tracker ──
let userMicStream = null;
let userMicCtx = null;
let userMicAnalyser = null;
let userMicRafId = null;

export async function startUserMicLevel(onLevel) {
  stopUserMicLevel();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    userMicStream = stream;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return stream;

    userMicCtx = new AudioCtx();
    if (userMicCtx.state === 'suspended') {
      await userMicCtx.resume();
    }

    const source = userMicCtx.createMediaStreamSource(stream);
    userMicAnalyser = userMicCtx.createAnalyser();
    userMicAnalyser.fftSize = 256;
    userMicAnalyser.smoothingTimeConstant = 0.5;
    source.connect(userMicAnalyser);

    const data = new Uint8Array(userMicAnalyser.frequencyBinCount);
    const checkLevel = () => {
      if (!userMicAnalyser) return;
      userMicAnalyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 2; i < 35 && i < data.length; i++) {
        sum += data[i];
      }
      const avg = sum / 33;
      const level = Math.min(1, Math.max(0, (avg - 10) / 90));
      onLevel?.(level);
      userMicRafId = requestAnimationFrame(checkLevel);
    };
    userMicRafId = requestAnimationFrame(checkLevel);
    return stream;
  } catch (err) {
    console.warn('[Speech] mic level init failed:', err);
    return null;
  }
}

export function stopUserMicLevel() {
  if (userMicRafId) {
    cancelAnimationFrame(userMicRafId);
    userMicRafId = null;
  }
  if (userMicAnalyser) {
    try { userMicAnalyser.disconnect(); } catch (_) {}
    userMicAnalyser = null;
  }
  if (userMicCtx) {
    try { userMicCtx.close(); } catch (_) {}
    userMicCtx = null;
  }
  if (userMicStream) {
    try { userMicStream.getTracks().forEach(t => t.stop()); } catch (_) {}
    userMicStream = null;
  }
}

// ── 2. Neural Audio Playback & AudioContext Analyser ──
let activeAudioElement = null;
let activeAudioUrl = null;
let activeAudioContext = null;
let activeAnalyserNode = null;
let activeSourceNode = null;
let audioAnalysisAnimFrame = null;
let abortController = null;

// Global audio level listener for avatar lip-sync
let audioLevelListeners = new Set();

export function subscribeAudioLevel(callback) {
  audioLevelListeners.add(callback);
  return () => audioLevelListeners.delete(callback);
}

function broadcastAudioLevel(level) {
  for (const cb of audioLevelListeners) {
    try { cb(level); } catch (_e) {}
  }
}

/**
 * Clean and format text specifically for fluent, natural human conversational speech
 */
export function sanitizeSpeechText(text) {
  if (!text) return '';
  let clean = text
    .replace(/[*_#`~[\]()<>]/g, '') // remove markdown artifacts
    .replace(/\{.*?\}/g, '') // remove JSON brackets
    .replace(/https?:\/\/\S+/g, '') // remove URLs
    .replace(/[•–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Tech terms phonetic pronunciation in Arabic conversation
  clean = clean
    .replace(/\bReact\b/gi, 'ريأكت')
    .replace(/\bJavaScript\b/gi, 'جافاسكريبت')
    .replace(/\bTypeScript\b/gi, 'تايب سكريبت')
    .replace(/\bTailwind\b/gi, 'تيلويند')
    .replace(/\bNode\.?js\b/gi, 'نود جي إس')
    .replace(/\bAPI\b/gi, 'إي بي آي')
    .replace(/\bUI\b/gi, 'يو آي')
    .replace(/\bUX\b/gi, 'يو إكس')
    .replace(/\bCSS\b/gi, 'سي إس إس')
    .replace(/\bHTML\b/gi, 'إتش تي إم إل')
    .replace(/\bBug\b/gi, 'بج')
    .replace(/\bFrontend\b/gi, 'فرونت إند')
    .replace(/\bBackend\b/gi, 'باك إند');

  return clean;
}

/**
 * Stop any current audio playback and cleanup resources
 */
export function stopSpeaking() {
  if (abortController) {
    try { abortController.abort(); } catch (_e) {}
    abortController = null;
  }

  if (audioAnalysisAnimFrame) {
    cancelAnimationFrame(audioAnalysisAnimFrame);
    audioAnalysisAnimFrame = null;
  }

  broadcastAudioLevel(0);
  window.__prova_speaker_analyser = null;

  if (activeSourceNode) {
    try { activeSourceNode.disconnect(); } catch (_e) {}
    activeSourceNode = null;
  }

  if (activeAnalyserNode) {
    try { activeAnalyserNode.disconnect(); } catch (_e) {}
    activeAnalyserNode = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement.removeAttribute('src');
    } catch (_e) {}
    activeAudioElement = null;
  }

  if (activeAudioUrl) {
    try { URL.revokeObjectURL(activeAudioUrl); } catch (_e) {}
    activeAudioUrl = null;
  }
}

/**
 * Speak full response text using Server Neural TTS
 * @param {Object} params
 * @param {string} params.text - The complete sentence or paragraph to speak in one shot
 * @param {string} [params.lang='ar-EG'] - Language/dialect code
 * @param {string} [params.voice] - Optional specific voice name
 * @param {Function} [params.onStart] - Called when real audio starts playing
 * @param {Function} [params.onEnd] - Called when audio finishes playing
 * @param {Function} [params.onError] - Called if synthesis or playback fails
 */
// ── Gemini Native Audio Conversion & Fetch ──
function pcm16ToWavBlob(base64, sampleRate = 24000) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + len, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // 16 for PCM
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, len, true);

  const u8 = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    u8[i] = binaryString.charCodeAt(i);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

let geminiTtsBlockedUntil = (() => {
  try {
    const val = localStorage.getItem('prova_gemini_tts_blocked_until');
    return val ? parseInt(val, 10) : (Date.now() + 30 * 60 * 1000); // Default to Edge TTS for instant real-time speed
  } catch (_e) {
    return Date.now() + 30 * 60 * 1000;
  }
})();

async function fetchGeminiNativeTtsBlob(cleanText, voice) {
  if (Date.now() < geminiTtsBlockedUntil) {
    return null;
  }

  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && (process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY));

  if (!apiKey) return null;

  const geminiVoice =
    voice === 'Aoede' || voice === 'Kore' || voice?.toLowerCase().includes('sara') || voice?.toLowerCase().includes('salma')
      ? 'Aoede'
      : 'Puck';

  const models = ['gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview'];

  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: geminiVoice },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(900),
      });

      if (res.status === 429) {
        geminiTtsBlockedUntil = Date.now() + 30 * 60 * 1000;
        try { localStorage.setItem('prova_gemini_tts_blocked_until', geminiTtsBlockedUntil.toString()); } catch (_) {}
        return null;
      }

      if (!res.ok) continue;
      const data = await res.json();
      const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64 && b64.length > 500) {
        return pcm16ToWavBlob(b64, 24000);
      }
    } catch (_err) {
      continue;
    }
  }

  return null;
}

/**
 * Speak full response text using Google Gemini Native Voice
 */
export async function speak({ text, lang = 'ar-EG', voice, onStart, onEnd, onError }) {
  stopSpeaking();

  const cleanText = sanitizeSpeechText(text);
  if (!cleanText) {
    onEnd?.();
    return;
  }

  abortController = new AbortController();

  try {
    const cartesiaKey =
      (typeof localStorage !== 'undefined' && localStorage.getItem('prova_cartesia_api_key')) ||
      (typeof import.meta !== 'undefined' && (import.meta.env?.CARTESIA_API_KEY || import.meta.env?.VITE_CARTESIA_API_KEY)) ||
      '';

    let audioBlob = null;

    // 1. If Cartesia Sonic key is configured (Priority 1: sub-150ms instant interview voice)
    if (cartesiaKey && cartesiaKey.length > 10) {
      try {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cartesia-Key': cartesiaKey,
          },
          body: JSON.stringify({
            text: cleanText,
            lang,
            voice,
            engine: 'cartesia',
            cartesiaApiKey: cartesiaKey,
          }),
          signal: abortController.signal,
        });
        if (response.ok) {
          audioBlob = await response.blob();
        }
      } catch (_e) {}
    }

    // 2. Fallback to Gemini Native Audio
    if (!audioBlob) {
      try {
        audioBlob = await fetchGeminiNativeTtsBlob(cleanText, voice);
      } catch (_e) {}
    }

    // 3. Fallback to Server Neural Voice (Edge)
    if (!audioBlob) {
      try {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            lang,
            voice,
            engine: 'edge',
          }),
          signal: abortController.signal,
        });
        if (response.ok) {
          audioBlob = await response.blob();
        }
      } catch (_e) {}
    }

    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Received empty audio payload from TTS engine');
    }

    activeAudioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio();
    activeAudioElement = audio;
    audio.src = activeAudioUrl;
    audio.preload = 'auto';

    // 2. Setup Web Audio API Analyser for real-time waveform lip-sync
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!activeAudioContext || activeAudioContext.state === 'closed') {
          activeAudioContext = new AudioCtx();
        }
        if (activeAudioContext.state === 'suspended') {
          await activeAudioContext.resume();
        }

        activeAnalyserNode = activeAudioContext.createAnalyser();
        activeAnalyserNode.fftSize = 256;
        activeAnalyserNode.smoothingTimeConstant = 0.6;

        activeSourceNode = activeAudioContext.createMediaElementSource(audio);
        activeSourceNode.connect(activeAnalyserNode);
        activeAnalyserNode.connect(activeAudioContext.destination);
        window.__prova_speaker_analyser = activeAnalyserNode;

        const dataArray = new Uint8Array(activeAnalyserNode.frequencyBinCount);

        const trackAudioLevel = () => {
          if (!activeAudioElement || activeAudioElement.paused || activeAudioElement.ended) {
            broadcastAudioLevel(0);
            return;
          }

          activeAnalyserNode.getByteFrequencyData(dataArray);
          // Calculate average energy in voice frequency range (index 2 to 32)
          let sum = 0;
          let count = 0;
          for (let i = 2; i < 35 && i < dataArray.length; i++) {
            sum += dataArray[i];
            count++;
          }
          const avg = count > 0 ? sum / count : 0;
          const normalizedLevel = Math.min(1, Math.max(0, (avg - 8) / 72));
          
          broadcastAudioLevel(normalizedLevel);
          audioAnalysisAnimFrame = requestAnimationFrame(trackAudioLevel);
        };

        audio.addEventListener('play', () => {
          trackAudioLevel();
        });
      }
    } catch (webAudioErr) {
      console.warn('Web Audio API analyser fallback (will use standard playback):', webAudioErr);
    }

    // 3. Audio Event Handlers
    audio.onplay = () => {
      onStart?.();
    };

    audio.onended = () => {
      stopSpeaking();
      onEnd?.();
    };

    audio.onerror = (e) => {
      console.warn('Audio playback error:', e);
      stopSpeaking();
      onError?.(e);
    };

    try {
      await audio.play();
    } catch (playErr) {
      if (playErr.name === 'NotAllowedError') {
        console.warn('[Speech] Autoplay blocked, waiting for user click to unlock');
        const unlock = () => {
          window.removeEventListener('click', unlock);
          window.removeEventListener('keydown', unlock);
          audio.play().catch(() => {});
        };
        window.addEventListener('click', unlock, { once: true, passive: true });
        window.addEventListener('keydown', unlock, { once: true, passive: true });
      } else {
        throw playErr;
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return; // cancelled intentionally
    }
    console.error('Speech synthesis error:', err);
    stopSpeaking();
    onError?.(err);
  }
}
