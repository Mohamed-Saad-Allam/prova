import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { interview_id } = req.body;
  if (!interview_id) return res.status(400).json({ error: 'interview_id required' });

  try {
    // Fetch questions + answers
    const { data: questions } = await supabase
      .from('interview_questions')
      .select('id, question_text, order_index, interview_answers(answer_text)')
      .eq('interview_id', interview_id)
      .order('order_index');

    if (!questions?.length) throw new Error('No questions found');

    // Build transcript
    const transcript = questions.map((q, i) => {
      const answer = q.interview_answers?.[0]?.answer_text || 'لم يُجب / No answer';
      return `السؤال ${i + 1}: ${q.question_text}\nالإجابة: ${answer}`;
    }).join('\n\n');

    const prompt = `
أنت خبير تقييم مقابلات توظيف. بناءً على المقابلة التالية، أعطِ تقييماً شاملاً.

المقابلة:
${transcript}

أرجع JSON بهذا الشكل بالضبط:
{
  "score": <رقم من 0 إلى 100>,
  "strengths": "<نقاط القوة في الإجابات — قائمة نصية>",
  "weaknesses": "<نقاط الضعف وما يحتاج تطوير>",
  "cv_suggestions": "<اقتراحات محددة لتحسين السيرة الذاتية بناءً على أداء المقابلة>"
}
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

    const report = JSON.parse(jsonMatch[0]);

    // Save to DB with upsert
    await supabase.from('reports').upsert({
      interview_id,
      score:          report.score || 75,
      strengths:      report.strengths || '',
      weaknesses:     report.weaknesses || '',
      cv_suggestions: typeof report.cv_suggestions === 'object' ? JSON.stringify(report.cv_suggestions) : (report.cv_suggestions || ''),
    }, { onConflict: 'interview_id' });

    return res.status(200).json(report);
  } catch (err) {
    console.error('[generate-report]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
