import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
let genAI = null;
if (apiKey && apiKey.length > 10) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (_e) {}
}

export async function formatCvStepWithGemini(prompt) {
  if (!genAI) throw new Error('Gemini AI not initialized');
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text) return text;
    } catch (_err) {
      // try next candidate
    }
  }
  throw new Error('All Gemini models failed');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const rawText = await formatCvStepWithGemini(prompt);
    let parsed = null;
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (_e) {}
    }

    if (!parsed) {
      return res.status(200).json({ rawText, parsed: null });
    }

    return res.status(200).json({ parsed });
  } catch (err) {
    console.error('[format-cv-step error]:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
