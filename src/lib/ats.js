import { supabase } from './supabaseClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Sample Job Descriptions for quick 1-click testing
export const SAMPLE_JOB_DESCRIPTIONS = [
  {
    id: 'frontend-en',
    titleEn: 'Senior Frontend Engineer (React/TypeScript)',
    titleAr: 'مهندس واجهات أمامية متقدم (React / TypeScript)',
    category: 'Engineering',
    lang: 'en',
    text: `Job Title: Senior Frontend Engineer
Company: Global Tech Solutions
Location: Remote / Hybrid

About the Role:
We are looking for a Senior Frontend Engineer to design, build, and optimize high-scale web applications. You will collaborate closely with UI/UX designers and backend developers to create intuitive, responsive user experiences.

Responsibilities:
- Architect and develop modern responsive web applications using React 19, TypeScript, and modern state management (Zustand / Redux).
- Build reusable UI component libraries and ensure high visual fidelity using TailwindCSS or modular CSS.
- Optimize web applications for maximum speed, scalability, and seamless cross-browser compatibility.
- Integrate RESTful APIs and real-time streaming sockets.
- Lead code reviews, champion automated testing (Jest, Playwright), and mentor junior developers.
- Collaborate with DevOps engineers on Docker containerization and CI/CD deployment pipelines.

Requirements:
- 4+ years of professional experience in frontend web development.
- Strong proficiency in JavaScript (ES6+), TypeScript, and React.
- Solid understanding of web performance tuning, accessibility (WCAG), and responsive design.
- Experience with Git, CI/CD pipelines, and automated testing frameworks.
- Strong problem-solving skills and effective team leadership in Agile/Scrum environments.`,
  },
  {
    id: 'frontend-ar',
    titleEn: 'Senior Frontend Developer (Arabic)',
    titleAr: 'مهندس برمجيات واجهات أمامية (رياكت وويب حديث)',
    category: 'Engineering',
    lang: 'ar',
    text: `المسمى الوظيفي: مهندس واجهات أمامية أول (Senior Frontend Developer)
جهة العمل: شركة تقنية رائدة
نوع العمل: عن بُعد / دوام كامل

نظرة عامة على الوظيفة:
نبحث عن مطور واجهات أمامية متميز يمتلك خبرة عملية قوية في بناء تطبيقات الويب التفاعلية الحديثة، وتطوير تجربة مستخدم سريعة ومتجاوبة وفق أعلى معايير الجودة البرمجية.

المسؤوليات والمهام:
- بناء وتطوير منصات ويب تفاعلية متجاوبة باستخدام مكتبة React وتقنية TypeScript.
- إدارة الحالة البرمجية المتقدمة باستخدام Zustand أو Redux Toolkit وتحسين استهلاك الذاكرة.
- تصميم واجهات مستخدم متميزة بالتعاون مع فريق الـ UI/UX والالتزام بأفضل ممارسات التصميم المتجاوب.
- ربط واجهات برمجة التطبيقات RESTful APIs ومعالجة البيانات غير المتزامنة بكفاءة.
- تطبيق اختبارات الجودة الأوتوماتيكية وكتابة كود نظيف وسهل الصيانة وقابل للتوسع.
- المشاركة الفعالة في اجتماعات Agile/Scrum ومراجعة الأكواد البرمجية مع الفريق.

المؤهلات والشروط المطلوبة:
- خبرة عملية لا تقل عن 3 سنوات في تطوير واجهات الويب الحديثة.
- إتقان تام للغات JavaScript و TypeScript ومكتبة React.js.
- إلمام بتقنيات الـ CSS الحديثة مثل TailwindCSS وتطوير واجهات متجاوبة لكافة الأجهزة.
- خبرة في استخدام أدوات إدارة النسخ Git وحاويات Docker وخطوط النشر المستمر CI/CD.
- مهارات تواصل ممتازة، وقدرة مثبتة على حل المشكلات التقنية المعقدة، والعمل بروح الفريق.`,
  },
  {
    id: 'fullstack-en',
    titleEn: 'Full-Stack Developer (Node.js & React)',
    titleAr: 'مطور برمجيات شامل (Full-Stack)',
    category: 'Engineering',
    lang: 'en',
    text: `Job Title: Full-Stack Software Engineer
Location: Remote

Key Requirements:
- Build full-stack solutions using React on the frontend and Node.js / Express on the backend.
- Design relational database schemas with PostgreSQL or MySQL and write efficient SQL queries.
- Implement secure authentication mechanisms (JWT, OAuth) and role-based access control (RBAC).
- Experience with cloud platforms (AWS, GCP) and container orchestration with Docker.
- Demonstrated capability in microservices architecture and API rate limiting.`,
  },
  {
    id: 'product-ar',
    titleEn: 'Technical Product Manager',
    titleAr: 'مدير منتج تقني (Product Manager)',
    category: 'Management',
    lang: 'ar',
    text: `المسمى الوظيفي: مدير منتجات تقنية (Technical Product Manager)

المهام الأساسية:
- قيادة خارطة طريق المنتج التقني وتحويل أهداف الأعمال إلى متطلبات تقنية مفصلة (User Stories).
- التنسيق الوثيق بين فرق الهندسة البرمجية والتصميم والتسويق لضمان إطلاق المنتجات في الموعد.
- تطبيق منهجيات Agile و Scrum وإدارة تراكم المهام (Product Backlog).
- تحليل مؤشرات الأداء الرئيسية (KPIs) وسلوك المستخدمين لاتخاذ قرارات قائمة على البيانات.
- مهارات قيادية وتفاوضية عالية مع أصحاب المصلحة الداخليين والخارجيين.`,
  },
];

/**
 * Checks semantic ATS match for a candidate CV against a target Job Description.
 */
export async function checkAtsMatch({ cvText, jobDescription, cvId, lang = 'ar' }) {
  if (!jobDescription || !jobDescription.trim()) {
    throw new Error('يرجى إدخال الوصف الوظيفي للمطابقة / Job description is required');
  }

  const customKey = typeof localStorage !== 'undefined' && localStorage.getItem('prova_gemini_api_key');
  const headers = { 'Content-Type': 'application/json' };
  if (customKey) {
    headers['x-gemini-key'] = customKey;
  }

  // 1. Try serverless endpoint (/api/ats-score)
  try {
    const res = await fetch('/api/ats-score', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cv_text: cvText,
        job_description: jobDescription,
        cv_id: cvId,
        lang,
        customApiKey: customKey || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      saveReportToLocalCache(data, cvId, jobDescription);
      return data;
    }
  } catch (apiErr) {
    console.warn('Backend /api/ats-score call notice (trying client-side fallback):', apiErr.message);
  }

  // 2. Client-side fallback if serverless route is not reachable
  return await clientSideAtsCalculation({ cvText, jobDescription, cvId, lang });
}

/**
 * Client-side fallback calculation using direct GoogleGenerativeAI SDK.
 */
async function clientSideAtsCalculation({ cvText, jobDescription, cvId, lang }) {
  const apiKey =
    (typeof localStorage !== 'undefined' && localStorage.getItem('prova_gemini_api_key')) ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('مفتاح Gemini API غير متوفر / Gemini API key is missing');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Helper cosine sim
  function cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    return nA && nB ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
  }

  // Helper embedding
  async function embed(text) {
    for (const m of ['gemini-embedding-2', 'gemini-embedding-001', 'text-embedding-004']) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.embedContent(text.slice(0, 7000));
        return { values: res.embedding.values, model: m };
      } catch (_e) {}
    }
    throw new Error('Embeddings service unavailable');
  }

  const [cvEmb, jdEmb] = await Promise.all([
    embed(cvText),
    embed(jobDescription),
  ]);

  const macroSim = cosineSim(cvEmb.values, jdEmb.values);

  // Calibrate
  let score = 75;
  if (macroSim >= 0.84) score = Math.round(90 + ((macroSim - 0.84) / 0.16) * 9);
  else if (macroSim >= 0.76) score = Math.round(78 + ((macroSim - 0.76) / 0.08) * 11);
  else if (macroSim >= 0.68) score = Math.round(62 + ((macroSim - 0.68) / 0.08) * 15);
  else if (macroSim >= 0.58) score = Math.round(42 + ((macroSim - 0.58) / 0.10) * 19);
  else score = Math.max(10, Math.round((macroSim / 0.58) * 35));
  score = Math.max(0, Math.min(100, score));

  // Generative missing skills
  let gapData = null;
  try {
    const isAr = lang.startsWith('ar');
    const prompt = `
Compare this candidate CV against the Job Description.
Identify specific missing tools, skills, or qualifications required by the JD that are not in the CV.
Language: ${isAr ? 'Arabic' : 'English'}.
Return JSON only:
{
  "missing_skills": [{"skill": "Skill Name", "category": "Technical", "importance": "high", "reason": "Reason"}],
  "matching_strengths": ["Matched skill or experience"],
  "recommendations": ["Actionable tip"],
  "verdict": "2-sentence summary"
}

CV:
${cvText.slice(0, 4000)}

JD:
${jobDescription.slice(0, 4000)}
    `.trim();

    for (const m of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest']) {
      try {
        const genModel = genAI.getGenerativeModel({ model: m, generationConfig: { responseMimeType: 'application/json' } });
        const res = await genModel.generateContent(prompt);
        const match = res.response.text().match(/\{[\s\S]*\}/);
        if (match) {
          gapData = JSON.parse(match[0]);
          break;
        }
      } catch (_e) {}
    }
  } catch (_e) {}

  const result = {
    score,
    macro_similarity: Number(macroSim.toFixed(4)),
    granular_similarity: Number(macroSim.toFixed(4)),
    blended_similarity: Number(macroSim.toFixed(4)),
    embedding_model: cvEmb.model,
    missing_skills: gapData?.missing_skills || [],
    matching_strengths: gapData?.matching_strengths || [],
    recommendations: gapData?.recommendations || [],
    verdict: gapData?.verdict || '',
    requirements_breakdown: [],
  };

  saveReportToLocalCache(result, cvId, jobDescription);
  return result;
}

/**
 * Saves report to local cache for instant offline review and persistence.
 */
function saveReportToLocalCache(report, cvId, jobDescription) {
  try {
    const key = `prova_ats_history_${cvId || 'guest'}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const record = {
      id: report.id || `local_${Date.now()}`,
      cv_id: cvId,
      score: report.score,
      job_description: jobDescription.slice(0, 200) + '...',
      missing_skills: report.missing_skills,
      created_at: new Date().toISOString(),
      full_report: report,
    };
    const updated = [record, ...existing.filter(r => r.id !== record.id)].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (_e) {}
}

/**
 * Loads past ATS reports for a given CV from Supabase (or local cache).
 */
export async function loadAtsReports(cvId) {
  const localKey = `prova_ats_history_${cvId || 'guest'}`;
  const localList = JSON.parse(localStorage.getItem(localKey) || '[]');

  if (!cvId || !supabase) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from('ats_reports')
      .select('*')
      .eq('cv_id', cvId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(item => ({
        ...item,
        missing_skills: typeof item.missing_skills === 'string'
          ? safeParseJson(item.missing_skills)
          : item.missing_skills,
      }));
    }
  } catch (_e) {}

  return localList;
}

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch (_e) {
    return [];
  }
}
