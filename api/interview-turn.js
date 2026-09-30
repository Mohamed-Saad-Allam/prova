import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { interview_id, conversation_history, current_question_index } = req.body;
  if (!interview_id) return res.status(400).json({ error: 'interview_id required' });

  const history = conversation_history || [];

  const systemPrompt = `
أنت "Prova" — محاور توظيف ذكي وودود يجري مقابلة عمل تدريبية.
قواعدك:
1. اسأل سؤالاً واحداً فقط في كل رد
2. إذا أجاب المتقدم بشكل كافٍ، اشكره واسأل السؤال التالي
3. إذا كانت الإجابة قصيرة جداً أو غير واضحة، اطلب التوضيح بلطف
4. لا تعطِ إجابات أو تلميحات — فقط أسئلة ومتابعة
5. كن محترفاً ومشجعاً في نفس الوقت
6. رد بنفس لغة المتقدم (عربي أو إنجليزي)
7. في ردك، أضف في النهاية: {"advance": true} إذا كان يجب الانتقال للسؤال التالي، أو {"advance": false} إذا كنت تطلب مزيداً من التوضيح
  `.trim();

  try {
    // Build Gemini chat history
    const chatHistory = history.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastUserMsg = history[history.length - 1]?.content || '';

    const CANDIDATE_MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    let rawText = '';
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(lastUserMsg);
        rawText = result.response.text().trim();
        if (rawText) break;
      } catch (_e) {}
    }

    // Extract advance flag
    const advanceMatch = rawText.match(/\{"advance"\s*:\s*(true|false)\}/i);
    const advance = advanceMatch ? advanceMatch[1].toLowerCase() === 'true' : true;
    const reply = rawText.replace(/\{"advance"\s*:\s*(true|false)\}/gi, '').trim();

    return res.status(200).json({ reply: reply || 'شكراً على إجابتك، دعنا ننتقل للنقطة التالية.', advance });
  } catch (err) {
    console.error('[interview-turn]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
