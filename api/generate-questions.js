import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { cv_id } = req.body;
  if (!cv_id) return res.status(400).json({ error: 'cv_id required' });

  try {
    // Fetch CV text
    const { data: cv, error: cvErr } = await supabase.from('cvs').select('raw_text, user_id').eq('id', cv_id).single();
    if (cvErr || !cv) throw new Error('CV not found');

    const prompt = `
أنت محاور توظيف خبير. بناءً على السيرة الذاتية التالية، اكتب 7 أسئلة مقابلة عمل ذكية ومتنوعة.
تشمل: سؤال تعريفي، سؤالين عن الخبرة التقنية، سؤال عن المهارات الشخصية، سؤال عن التحديات، سؤال عن الأهداف، وسؤال ختامي.

السيرة الذاتية:
${cv.raw_text || 'لا توجد بيانات كافية'}

أرجع JSON بهذا الشكل بالضبط:
{"questions": ["السؤال 1", "السؤال 2", "السؤال 3", "السؤال 4", "السؤال 5", "السؤال 6", "السؤال 7"]}
لا تضف أي نص خارج الـ JSON.
    `.trim();

    const CANDIDATE_MODELS = [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    let raw = '';
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        raw = result.response.text().trim();
        if (raw) break;
      } catch (_e) {}
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid LLM response');

    const { questions } = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions) || questions.length < 3) throw new Error('Too few questions');

    // Create interview record
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .insert({ user_id: cv.user_id, cv_id, status: 'pending' })
      .select('id')
      .single();

    if (intErr) throw intErr;

    // Insert questions
    const questionRows = questions.map((q, i) => ({
      interview_id: interview.id,
      question_text: q,
      order_index: i,
    }));

    await supabase.from('interview_questions').insert(questionRows);

    // Update interview status
    await supabase.from('interviews').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', interview.id);

    return res.status(200).json({
      interview_id: interview.id,
      questions: questionRows,
    });
  } catch (err) {
    console.error('[generate-questions]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
