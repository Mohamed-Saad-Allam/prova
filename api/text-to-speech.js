// In-memory cache for fast repeated responses
const audioCache = new Map();

/**
 * Clean text for fluent speech delivery (removes markdown, JSON, asterisks, URLs)
 */
export function sanitizeTextForTTS(text) {
  if (!text) return '';
  return text
    .replace(/[*_#`~[\]()<>]/g, '')
    .replace(/\{.*?\}/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Package raw 16-bit 24kHz mono PCM Base64 from Gemini into a standard WAV Buffer
 */
function pcm16ToWavBuffer(base64, sampleRate = 24000) {
  const binaryString = Buffer.from(base64, 'base64');
  const len = binaryString.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + len, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(len, 40);

  binaryString.copy(header, 44);
  return Buffer.concat([header, binaryString]);
}

/**
 * Synthesize speech using Cartesia Sonic API (Sub-150ms ultra-low latency interview voice)
 */
async function synthesizeWithCartesia(cleanText, lang = 'ar-EG', voice, customApiKey) {
  const apiKey =
    customApiKey ||
    process.env.CARTESIA_API_KEY ||
    process.env.VITE_CARTESIA_API_KEY ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.CARTESIA_API_KEY || import.meta.env?.VITE_CARTESIA_API_KEY));

  if (!apiKey || apiKey.includes('your_')) return null;

  const isFemale = voice === 'Aoede' || voice === 'Kore' || voice?.toLowerCase().includes('sara') || voice?.toLowerCase().includes('salma');
  // Verified native Arabic interview voices:
  // Female (Sara): Jana - Knowledgeable Advisor
  // Male (Ahmed): Tariq - Wise Advisor
  const voiceId = isFemale
    ? 'd663e679-b321-43f5-8c98-3f41172a9480'
    : 'db873303-3a70-4d9d-867a-0d70a6377195';

  const cartesiaLang = lang.startsWith('ar') ? 'ar' : 'en';

  try {
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3.6',
        transcript: cleanText,
        voice: {
          mode: 'id',
          id: voiceId,
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 24000,
        },
        language: cartesiaLang,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Cartesia] API returned status ${response.status}:`, errText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.warn('[Cartesia] synthesis notice:', err.message);
    return null;
  }
}

async function synthesizeWithGemini(cleanText, voiceName, customGeminiKey) {
  const apiKey =
    customGeminiKey ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY);

  if (!apiKey) return null;

  const candidateModels = [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.0-flash',
  ];

  const geminiVoice =
    voiceName === 'Aoede' || voiceName === 'Kore' || voiceName?.toLowerCase().includes('salma') || voiceName?.toLowerCase().includes('sara')
      ? 'Aoede'
      : 'Puck';

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 429) {
        return null;
      }
      if (!res.ok) continue;
      const data = await res.json();
      const base64Pcm = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Pcm && base64Pcm.length > 500) {
        return pcm16ToWavBuffer(base64Pcm, 24000);
      }
    } catch (_err) {
      continue;
    }
  }

  return null;
}

/**
 * Master Synthesizer: Cartesia Sonic First, Google Gemini Native Voice Second
 */
export async function synthesizeSpeech({ text, lang = 'ar-EG', voice, engine, cartesiaApiKey, geminiApiKey }) {
  const clean = sanitizeTextForTTS(text);
  if (!clean) throw new Error('Empty text provided for synthesis');

  const cacheKey = `${voice || 'default'}:${clean}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  // 1. Try Cartesia Sonic First (Hyper-realistic sub-150ms real-time conversational voice)
  try {
    const cartesiaBuffer = await synthesizeWithCartesia(clean, lang, voice, cartesiaApiKey);
    if (cartesiaBuffer && cartesiaBuffer.length > 500) {
      if (audioCache.size > 200) audioCache.delete(audioCache.keys().next().value);
      audioCache.set(cacheKey, cartesiaBuffer);
      return cartesiaBuffer;
    }
  } catch (cartesiaErr) {
    console.warn('[TTS] Cartesia Sonic error, falling back to Gemini:', cartesiaErr.message);
  }

  // 2. Try Google Gemini Native Audio Output
  try {
    const geminiBuffer = await synthesizeWithGemini(clean, voice, geminiApiKey);
    if (geminiBuffer && geminiBuffer.length > 500) {
      if (audioCache.size > 200) audioCache.delete(audioCache.keys().next().value);
      audioCache.set(cacheKey, geminiBuffer);
      return geminiBuffer;
    }
  } catch (geminiErr) {
    console.warn('[TTS] Gemini Native Voice error:', geminiErr.message);
  }

  throw new Error('Both Cartesia Sonic and Google Gemini speech engines failed to produce audio.');
}

/**
 * Serverless HTTP Handler
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cartesia-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const text = body?.text || req.query?.text;
    const lang = body?.lang || req.query?.lang || 'ar-EG';
    const voice = body?.voice || req.query?.voice;
    const engine = body?.engine || req.query?.engine;
    const cartesiaApiKey = body?.cartesiaApiKey || req.headers?.['x-cartesia-key'] || req.query?.cartesiaApiKey;
    const geminiApiKey = body?.geminiApiKey || req.headers?.['x-gemini-key'] || req.query?.geminiApiKey;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    const audioBuffer = await synthesizeSpeech({ text, lang, voice, engine, cartesiaApiKey, geminiApiKey });
    const isWav = Buffer.isBuffer(audioBuffer) && audioBuffer.slice(0, 4).toString('ascii') === 'RIFF';

    res.setHeader('Content-Type', isWav ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('TTS API error:', err);
    return res.status(500).json({ error: 'Synthesis failed', details: err.message });
  }
}
