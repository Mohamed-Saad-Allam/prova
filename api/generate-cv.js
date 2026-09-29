import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    // Fetch all answers from DB
    const { data: rows, error } = await supabase
      .from('cv_answers')
      .select('section, question_key, answer')
      .eq('user_id', user_id);

    if (error) throw error;

    // Build structured data
    const sections = {};
    for (const row of rows) {
      if (!sections[row.section]) sections[row.section] = {};
      sections[row.section][row.question_key] = row.answer;
    }

    const prompt = `
أنت خبير في كتابة السير الذاتية الاحترافية. بناءً على المعلومات التالية، اكتب سيرة ذاتية احترافية بصيغة HTML بسيطة (استخدم فقط: h2, ul, li, p, strong).

المعلومات:
${JSON.stringify(sections, null, 2)}

التعليمات:
- اكتب بالعربية أو الإنجليزية حسب لغة البيانات
- اجعل السيرة موجزة ومؤثرة
- ابدأ بملخص مهني قوي
- استخدم أرقاماً وإنجازات حيثما أمكن
- أرجع JSON بهذا الشكل بالضبط: {"raw_text": "...", "formatted_html": "<h2>...</h2><ul>...</ul>"}
- لا تضف أي نص خارج الـ JSON
    `.trim();

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let raw = '';
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        raw = result.response.text().trim();
        if (raw) break;
      } catch (_e) {
        // try next model
      }
    }
    if (!raw) throw new Error('All Gemini candidate models failed');

    // Extract JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid LLM response');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.formatted_html || parsed.formatted_html.split(' ').length < 20) {
      // Retry logic — if too short, throw to trigger retry
      throw new Error('CV too short, retry');
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[generate-cv]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
