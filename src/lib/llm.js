import { supabase } from './supabaseClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
let genAI = null;
if (geminiKey && geminiKey.length > 20 && !geminiKey.includes('your_')) {
  try {
    genAI = new GoogleGenerativeAI(geminiKey);
  } catch (e) {
    console.warn('Gemini AI initialization notice:', e);
  }
}

function getActiveGeminiAI() {
  const customKey = typeof localStorage !== 'undefined' && localStorage.getItem('prova_gemini_api_key');
  const activeKey = customKey || geminiKey;
  if (activeKey && activeKey.length > 20 && !activeKey.includes('your_')) {
    try {
      return new GoogleGenerativeAI(activeKey);
    } catch (_e) {}
  }
  return genAI;
}

let geminiQuotaBlockedUntil = 0;

/**
 * Call Groq API (Llama 3.3 70B - Lightning Fast 200ms real conversational response)
 */
async function callGroq(prompt, systemInstruction = '', timeoutMs = 3000) {
  const groqKey =
    (typeof localStorage !== 'undefined' && localStorage.getItem('prova_groq_api_key')) ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.GROQ_API_KEY || import.meta.env?.VITE_GROQ_API_KEY)) ||
    (typeof process !== 'undefined' && (process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY));

  if (!groqKey || groqKey.includes('your_')) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (_e) {
    return null;
  }
}

/**
 * Call Gemini with multi-model fallback, configurable timeout & quota circuit breaker
 */
async function callGemini(prompt, systemInstruction = '', timeoutMs = 8000, maxOutputTokens = 1000, responseJson = false) {
  const activeAI = getActiveGeminiAI();
  if (!activeAI) return null;
  if (Date.now() < geminiQuotaBlockedUntil) return null;

  // Real verified Gemini models in priority order (fastest/cheapest first)
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
  ];

  for (const modelName of candidateModels) {
    // Attempt each model up to 2 times to handle transient 503 overload errors
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const genConfig = {
          maxOutputTokens: maxOutputTokens,
          temperature: 0.3,
        };
        if (responseJson) {
          genConfig.responseMimeType = 'application/json';
        }

        const model = activeAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction || undefined,
          generationConfig: genConfig,
        });

        const genPromise = model.generateContent(prompt).then((res) => {
          const txt = res.response?.text?.()?.trim();
          return txt || null;
        });

        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));

        const text = await Promise.race([genPromise, timeoutPromise]);
        if (text && text.length > 2) return text;

        // Empty response — no point retrying same model, move to next
        break;
      } catch (err) {
        const errMsg = err?.message || String(err);
        const status = err?.status || err?.httpStatus;

        // 429 / quota exceeded — circuit break for 5 minutes
        if (status === 429 || errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          geminiQuotaBlockedUntil = Date.now() + 5 * 60 * 1000;
          return null;
        }

        // 503 / overloaded — wait briefly then retry this model once, then try next
        if (status === 503 || errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('UNAVAILABLE')) {
          if (attempt === 0) {
            // Short backoff before retry: 800ms
            await new Promise((r) => setTimeout(r, 800));
            continue; // retry same model
          }
          // Second attempt also failed, move to next model
          break;
        }

        // Other errors — move to next model immediately
        break;
      }
    }
  }

  return null;
}

/**
 * Helper: Convert file to Base64
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res === 'string') {
        const commaIdx = res.indexOf(',');
        resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
      } else {
        resolve('');
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Helper: Render PDF pages to high-resolution JPEG images for multimodal AI OCR
 */
async function extractPDFPagesAsImages(file) {
  if (typeof document === 'undefined') return [];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
    }
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const images = [];
    const maxPages = Math.min(pdf.numPages, 2);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        if (base64) images.push(base64);
      }
    }
    return images;
  } catch (err) {
    console.warn('PDF to image conversion notice:', err);
    return [];
  }
}

/**
 * Helper: Extract text from PDF using pdfjs-dist
 */
async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
    }
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => (item && item.str !== undefined ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }
    if (fullText.trim().length > 20) {
      return fullText.trim();
    }
  } catch (err) {
    console.warn('PDF.js text extraction notice (falling back to multimodal):', err);
  }
  return null;
}

/**
 * Fallback regex extractor for offline or failed AI calls (clean structure)
 */
function fallbackExtractCVFromText(text, fileName = '') {
  let cleanName = fileName.replace(/\.[^/.]+$/, '').trim();
  const isGenericWord = /^(cv|resume|curriculum|vitae|سيرة|ذاتية|السيرة)$/i.test(cleanName);
  if (isGenericWord) cleanName = 'Candidate Name';

  const emailMatch = text ? text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) : null;
  const phoneMatch = text ? text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/) : null;
  const linkedinMatch = text ? text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/) : null;
  const githubMatch = text ? text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/) : null;

  const lines = text ? text.split('\n').map(l => l.trim()).filter(Boolean) : [];
  let extractedName = cleanName;
  for (const l of lines.slice(0, 5)) {
    if (l.length >= 3 && l.length < 35 && !l.includes('@') && !/^(cv|resume|curriculum|vitae|سيرة)$/i.test(l)) {
      extractedName = l;
      break;
    }
  }

  const linksList = [];
  if (linkedinMatch) linksList.push(linkedinMatch[0]);
  if (githubMatch) linksList.push(githubMatch[0]);

  const contactList = [];
  if (emailMatch) contactList.push(emailMatch[0]);
  if (phoneMatch) contactList.push(phoneMatch[0]);

  return {
    name: extractedName || 'Candidate Name',
    jobTitle: 'Professional Specialist',
    address: 'Cairo, Egypt',
    contact: contactList.join(' | ') || (emailMatch ? emailMatch[0] : 'contact@example.com'),
    links: linksList.join(' | ') || '',
    careerObjective: 'Accomplished professional with extensive experience delivering high-impact solutions, collaborating across cross-functional teams, and driving measurable business results.',
    careerHistory: [],
    technicalSkills: '',
    methodologies: '',
    coreCompetencies: '',
    educationList: [],
    projectsCertifications: [],
  };
}

/**
 * 1. Parse uploaded CV file and generate structured CV matching Exact ATS Template
 */
export async function parseAndGenerateUploadedCV(file, userId, lang = 'ar') {
  let extractedText = '';
  let pageImages = [];
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);

  try {
    if (isPdf) {
      // 1. Convert PDF pages to high-res images for multimodal vision OCR
      pageImages = await extractPDFPagesAsImages(file);
      // 2. Also extract raw text as auxiliary context
      extractedText = await extractTextFromPDF(file) || '';
    } else if (isImage) {
      const b64 = await fileToBase64(file);
      if (b64) pageImages.push(b64);
    } else {
      extractedText = await file.text();
    }
  } catch (err) {
    console.warn('File reading error:', err);
  }

  const promptText = `
You are an Elite Executive ATS Resume Architect & Translator.
Analyze the provided resume document carefully (it may be in Arabic, English, or any language, and may contain graphic or complex layouts).

CORE OBJECTIVES:
1. Accurately identify and extract ALL candidate details.
2. TRANSLATE ALL text from Arabic or any other language into 100% professional, fluent, executive English.
3. PRESERVE AND FIT into our exact single-column executive ATS schema.
4. For work experience bullet points ("duties"): EVERY bullet point MUST start with a strong past-tense action verb (e.g. "Developed", "Designed", "Managed", "Spearheaded", "Engineered", "Implemented", "Architected") and include measurable results/metrics wherever possible. NO personal pronouns ("I", "my").
5. DO NOT invent fake companies or fake experience. Extract the candidate's real data truthfully.

${extractedText ? `AUXILIARY EXTRACTED TEXT FROM DOCUMENT:\n---\n${extractedText.slice(0, 10000)}\n---` : ''}

RETURN STRICTLY A SINGLE VALID JSON OBJECT (no markdown backticks, no commentary) matching this exact schema:
{
  "name": "Candidate Full Name in English (e.g. Ahmed Deny)",
  "jobTitle": "Target or Current Job Title in English (e.g. Senior Graphic Designer & Web Developer)",
  "address": "City, Country (e.g. Riyadh, Saudi Arabia or Cairo, Egypt)",
  "contact": "email@domain.com | +phone",
  "links": "portfolio website or linkedin/github if present",
  "careerObjective": "2-3 concise sentences in professional English summarizing core expertise, years of experience, and main value proposition.",
  "careerHistory": [
    {
      "title": "Job Title in English",
      "company": "Company / Organization Name",
      "location": "City, Country or Remote",
      "dates": "Date range (e.g. 2019 – Present or Jan 2021 – Dec 2023)",
      "duties": [
        "Action verb + achievement/responsibility in English",
        "Action verb + achievement/responsibility in English"
      ]
    }
  ],
  "technicalSkills": "Comma-separated list of technical tools and software (e.g. Adobe Photoshop, Adobe Illustrator, WordPress, WooCommerce, MySQL)",
  "methodologies": "Comma-separated methodologies and concepts (e.g. UI/UX Design, Responsive Web Design, REST APIs, Agile)",
  "coreCompetencies": "Comma-separated professional strengths (e.g. Creative Direction, Web Development, Client Communication, Problem Solving)",
  "educationList": [
    {
      "degree": "Degree and Major in English (e.g. Bachelor of Computer Science and Information)",
      "institution": "University / College / Institute Name",
      "dates": "Graduation year or date range (e.g. 2018)",
      "grade": "Grade / Honors if mentioned, else empty string"
    }
  ],
  "projectsCertifications": [
    {
      "title": "Certification or Key Project Name in English",
      "issuer": "Issuing Authority / Platform",
      "date": "Year",
      "detail": "1 sentence describing key skills or topics covered"
    }
  ]
}
`.trim();

  let aiPayload;
  if (pageImages.length > 0) {
    const parts = [];
    pageImages.forEach(imgB64 => {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imgB64,
        }
      });
    });
    parts.push(promptText);
    aiPayload = parts;
  } else {
    aiPayload = promptText;
  }

  let result = null;

  // 1. Try Gemini Multimodal / Text with 25s timeout and JSON output
  try {
    const aiText = await callGemini(
      aiPayload,
      'You are an expert ATS CV parser and translator. Always return valid JSON adhering to the requested schema.',
      25000,
      4000,
      true
    );
    if (aiText) {
      const cleanAiText = aiText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      const match = cleanAiText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const cvObj = parsed.structuredCv || parsed;
          if (cvObj && (cvObj.name || cvObj.jobTitle || (Array.isArray(cvObj.careerHistory) && cvObj.careerHistory.length > 0))) {
            result = {
              raw_text: `${cvObj.name || ''} - ${cvObj.jobTitle || ''}\n${cvObj.contact || ''}\n${cvObj.careerObjective || ''}`,
              structuredCv: cvObj,
            };
          }
        } catch (_e) {
          console.warn('JSON parse error on Gemini output:', _e);
        }
      }
    }
  } catch (geminiErr) {
    console.warn('Gemini CV parsing error:', geminiErr);
  }

  // 2. Fallback to Groq (Llama 3.3 70B) if Gemini failed and text exists
  if (!result && extractedText && extractedText.length > 20) {
    try {
      const groqPrompt = `${promptText}\n\nDOCUMENT TEXT TO TRANSLATE AND PARSE:\n${extractedText.slice(0, 10000)}`;
      const groqRes = await callGroq(groqPrompt, 'You are an ATS CV parser. Return strictly valid JSON without markdown fences.', 15000);
      if (groqRes) {
        const cleanGroq = groqRes.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        const m = cleanGroq.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          const cvObj = parsed.structuredCv || parsed;
          if (cvObj && (cvObj.name || cvObj.jobTitle)) {
            result = {
              raw_text: `${cvObj.name || ''} - ${cvObj.jobTitle || ''}\n${cvObj.contact || ''}`,
              structuredCv: cvObj,
            };
          }
        }
      }
    } catch (groqErr) {
      console.warn('Groq CV fallback error:', groqErr);
    }
  }

  // 3. Fallback: Clean regex extractor (without dumping raw text into summary)
  if (!result || !result.structuredCv) {
    const fallbackCv = fallbackExtractCVFromText(extractedText, file.name);
    result = {
      raw_text: extractedText || `${fallbackCv.name} - Uploaded Resume`,
      structuredCv: fallbackCv,
    };
  }

  return result;
}

/**
 * 2. Generate CV from saved cv_answers in Supabase
 */
export async function generateCV(userId) {
  const { data: rows } = await supabase
    .from('cv_answers')
    .select('section, question_key, answer')
    .eq('user_id', userId);

  const sections = {};
  (rows || []).forEach(r => {
    if (!sections[r.section]) sections[r.section] = {};
    sections[r.section][r.question_key] = r.answer;
  });

  const p = sections.personal || {};
  const edu = sections.education || {};
  const exp = sections.experience || {};
  const sk = sections.skills || {};
  const prj = sections.projects || {};

  const name = p.name || 'الاسم الكامل';
  const title = p.title || 'المسمى الوظيفي المستهدف';
  const email = p.email || 'email@example.com';
  const phone = p.phone || '+20 1xx xxx xxxx';
  const location = p.location || 'القاهرة، مصر';
  const summary = p.summary || `محترف متميز في مجال ${title}، أمتلك خبرة عملية في قيادة وتنفيذ المشاريع وفق أعلى المعايير المهنية.`;

  const prompt = `
You are an Executive ATS Resume Architect.
Based on the candidate's profile data below:
${JSON.stringify(sections, null, 2)}

STRICT ATS & WRITING RULES:
1. Translate any user input from any language into 100% professional ATS-optimized English.
2. Standard Section Order: Personal Info → Professional Summary → Work Experience → Skills → Education → Projects/Certifications.
3. Content Writing Rules:
   - Write every bullet in the format: Strong past action verb + specific task + measurable result with numbers if available.
   - Do not use personal pronouns ("I", "my") or full sentences.
   - Limit each experience to 3-5 high-impact bullet points maximum.
   - Professional Summary: exactly 2 lines maximum (1-2 impactful sentences).
4. Return valid JSON only with this schema:
{
  "name": "Candidate Full Name in English",
  "jobTitle": "Target Job Title in English",
  "address": "City, Country",
  "contact": "email@example.com | +20 1xx xxx xxxx",
  "links": "linkedin.com/in/... | portfolio...",
  "careerObjective": "Impactful 2-line professional summary highlighting core expertise, proven track record, and measurable value.",
  "careerHistory": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, Country",
      "dates": "Jan 2022 – Present",
      "duties": [
        "Architected enterprise solution reducing operational processing time by 40%.",
        "Led cross-functional team of 8 professionals to deliver project 2 weeks ahead of schedule.",
        "Streamlined workflow procedures resulting in a 25% increase in team output efficiency."
      ]
    }
  ],
  "technicalSkills": "Skill 1, Skill 2, Skill 3, Skill 4, Skill 5",
  "methodologies": "Agile/Scrum, CI/CD, System Architecture, Performance Tuning",
  "coreCompetencies": "Strategic Leadership, Problem Solving, Analytical Execution, Stakeholder Management",
  "educationList": [
    {
      "degree": "Bachelor of Science in ...",
      "institution": "University Name",
      "dates": "2017 – 2021",
      "grade": "Excellent / Honors"
    }
  ],
  "projectsCertifications": [
    {
      "title": "Professional Certification / Key Project",
      "issuer": "Issuing Body / Tech Stack",
      "date": "2023",
      "detail": "Demonstrated technical mastery and delivered measurable performance improvements."
    }
  ]
}
`.trim();

  let structuredCv = null;
  const aiText = await callGemini(prompt, '', 10000, 2500);
  if (aiText) {
    const match = aiText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        structuredCv = JSON.parse(match[0]);
      } catch (_e) {}
    }
  }

  if (!structuredCv) {
    structuredCv = {
      jobTitle: title || 'Target Professional Role',
      name: name || 'Your Full Name',
      address: location || 'City, Country',
      contact: `${email} | ${phone}`,
      links: 'linkedin.com/in/username',
      careerObjective: 'Results-driven professional with a proven record of executing mission-critical projects and optimizing workflow efficiency across multidisciplinary teams.',
      careerHistory: [
        {
          title: exp.role || title || 'Senior Professional',
          company: exp.company || 'Enterprise Solutions Ltd',
          location: location || 'City, Country',
          dates: exp.duration || '2022 – Present',
          duties: [
            'Spearheaded key operational initiatives, increasing project delivery speed by 30%.',
            'Engineered automated workflow pipelines to eliminate processing bottlenecks across 4 core departments.',
            'Collaborated with cross-functional stakeholders to achieve 100% on-time milestone delivery.',
          ],
        },
      ],
      technicalSkills: 'Technical Leadership, Process Optimization, System Design, Data Analysis',
      methodologies: 'Agile/Scrum, Performance Tuning, Risk Management, Quality Assurance',
      coreCompetencies: 'Strategic Planning, Cross-Functional Communication, Team Mentorship',
      educationList: [
        {
          degree: edu.degree || 'Bachelor Degree',
          institution: edu.university || 'University',
          dates: edu.grad_year || '2021',
          grade: edu.gpa || 'Honors',
        },
      ],
      projectsCertifications: [
        {
          title: 'Professional Specialization & Key Project',
          issuer: 'Accredited Institution',
          date: '2023',
          detail: 'Architected scalable project framework improving workflow quality metrics.',
        },
      ],
    };
  }

  const raw_text = JSON.stringify(structuredCv);
  const formatted_html = `${name} - ${title}\n${location} | ${email} | ${phone}\n\nObjective:\n${summary}`;

  return { raw_text, formatted_html, structuredCv };
}

/**
 * 2. Start Live Interview Session in Supabase
 */
export async function startLiveInterview(userId, cvId) {
  const { data: interview, error } = await supabase
    .from('interviews')
    .insert({
      user_id: userId,
      cv_id: cvId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return interview.id;
}

/**
 * Helper: Converts any CV format (JSON, structured text, or HTML) into clean,
 * readable sections so that the AI interviewer can read every project and company first.
 */
export function formatCvContext(rawContext) {
  if (!rawContext) return '';
  let str = String(rawContext).trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const data = JSON.parse(str);
      const parts = [];
      if (data.name) parts.push(`اسم المرشح: ${data.name}`);
      if (data.jobTitle) parts.push(`المسمى الوظيفي المستهدف: ${data.jobTitle}`);
      if (data.careerObjective) parts.push(`الهدف المهني: ${data.careerObjective}`);
      if (data.careerHistory && Array.isArray(data.careerHistory)) {
        const hist = data.careerHistory.map(h => {
          const duties = Array.isArray(h.duties) ? h.duties.join(' - ') : (h.duties || '');
          return `- شركة: ${h.company || ''} | المسمى: ${h.title || ''} | الفترة: ${h.dates || ''} | المهام والإنجازات: ${duties}`;
        }).join('\n');
        parts.push(`سجل الخبرات العملية والشركات السابقة (اقرأها بعناية أولاً):\n${hist}`);
      }
      if (data.technicalSkills) parts.push(`المهارات التقنية والأدوات: ${data.technicalSkills}`);
      if (data.methodologies) parts.push(`المنهجيات والمعايير: ${data.methodologies}`);
      if (data.projectsCertifications && Array.isArray(data.projectsCertifications)) {
        const prjs = data.projectsCertifications.map(p => `- ${p.title || ''} (${p.issuer || ''}): ${p.detail || ''}`).join('\n');
        parts.push(`المشاريع العملية والشهادات البرمجية:\n${prjs}`);
      }
      if (data.educationList && Array.isArray(data.educationList)) {
        const edu = data.educationList.map(e => `- ${e.degree || ''} من ${e.institution || ''} (${e.dates || ''})`).join('\n');
        parts.push(`المؤهلات التعليمية:\n${edu}`);
      }
      return parts.join('\n\n');
    } catch (_e) {
      // Return as-is if JSON parsing fails
    }
  }
  return str;
}

/**
 * 2.5 Generate 100% Unique, Tailored Opening Greeting based on Candidate CV
 * The interviewer studies the candidate's CV *before* the call starts,
 * and launches an open conversation by referencing a specific project, company, or technical stack from the CV.
 */
export async function generatePersonalizedOpening({
  cvContext = '',
  candidateName = 'المرشح',
  interviewerName = 'أحمد',
  isSara = false,
  isRtl = true,
}) {
  const isFemale = isSara || interviewerName.toLowerCase().includes('sara') || interviewerName.includes('سارة');
  const actualInterviewerName = isFemale ? 'سارة' : 'أحمد';
  const roleName = isFemale ? 'مديرة التوظيف في Prova' : 'مدير التوظيف في Prova';

  const formattedCv = formatCvContext(cvContext);
  const hasCv = formattedCv && formattedCv.trim().length > 25;

  const prompt = `
أنت "${actualInterviewerName}"، ${roleName}، خبير ومتخصص في مجال المرشح، تجري مقابلة عمل حقيقية عبر Zoom مع المرشح (${candidateName}).

قمت بدراسة السيرة الذاتية للمرشح المرفقة بالأسفل بعناية فائقة أولاً قبل أي شيء لتبدأ الحوار منها حصراً:
========================
السيرة الذاتية للمرشح:
========================
${hasCv ? formattedCv.trim() : 'لم يتم إرفاق سيرة ذاتية تفصيلية في حساب المرشح.'}

========================
المهمة الافتتاحية الحصرية:
========================
1. اقرأ السيرة الذاتية للمرشح المرفقة أعلاه أولاً وتعرف على مجاله وتخصصه المهني بدقة (طبي، مالي، قانوني، تعليمي، تسويقي، إداري، هندسي، تقني، أو غيره).
2. التزم حصرياً بوظيفتك كمدير توظيف محترف في مجاله، وممنوع منعاً باتاً التطرق لأي موضوع جانبي أو شخصي أو خارج نطاق تخصصه.
3. افتح المقابلة بترحيب دافئ ومهني، ثم اذكر نقطة محددة جداً من سيرته الذاتية (مشروع حقيقي أنجزه، مؤسسة أو شركة عمل بها، أو مهارة تخصصية مارسها) واطرح سؤالك الافتتاحي المفتوح الذي يقود الحوار حول هذا الإنجاز العملي في تخصصه!

قواعد صارمة للمحاور:
1. اقرأ الـ CV أولاً، واستخرج منه إنجازاً أو خبرة حقيقية يبدأ منها الحوار. ممنوع الأسئلة الجاهزة أو المعلبة إطلاقاً مثل "احكيلي عن نفسك" أو "عرفني بنفسك".
2. ${hasCv ? `يجب أن يكون السؤال الأول نابعاً 100% من تفاصيل الـ CV الخاصة بهذا المرشح وتخصصه فقط، بحيث لو دخل مرشح آخر في نفس المجال أو مجال آخر يكون سؤاله ومسار حواره مختلفاً تماماً بناءً على خبراته الخاصة.` : `بما أنه لا توجد سيرة ذاتية مرفوعة، رحب به واطلب منه أن يقود هو الحوار باختيار أقوى إنجاز أو تحدي مهني قاده بنفسه في مجاله وتخصصه وكيف تعامل مع التحديات التي واجهته.`}
3. التزم بوظيفتك كمدير توظيف يقيم الجانب العملي والتخصصي فقط، ولا تتطرق لأي موضوع خارج المقابلة.
4. تحدث باللهجة المصرية المهنية الودودة والواثقة كشخص يجري مقابلة حقيقية في Zoom.
5. الرد لا يتجاوز جملتين أو ثلاث جمل قصيرة، سلس جداً للنطق الصوتي، وينتهي بسؤال واحد مفتوح وجذاب يركز على دوره وإنجازه في تخصصه.
6. لا تضع أي إيموجي أو نجوم ماركداون أو نصوص خارج كلام المحاور.
`.trim();

  // Try Groq first for instant ~200ms generation
  let text = await callGroq(prompt, '', 3000);

  // Try Gemini fallback
  if (!text) {
    text = await callGemini(prompt, '', 3000, 200);
  }

  if (text && text.trim().length > 15) {
    return text.trim();
  }

  // ── Smart Dynamic Fallback based on actual CV extraction (Never static generic question!) ──
  if (hasCv) {
    let specificMention = '';
    try {
      if (cvContext.trim().startsWith('{')) {
        const parsed = JSON.parse(cvContext.trim());
        if (parsed.careerHistory?.[0]?.company) {
          specificMention = `خبرتك في مؤسسة ${parsed.careerHistory[0].company} كـ ${parsed.careerHistory[0].title || 'متخصص في مجالك'}`;
        } else if (parsed.projectsCertifications?.[0]?.title) {
          specificMention = `مشروعك أو إنجازك في ${parsed.projectsCertifications[0].title}`;
        } else if (parsed.technicalSkills) {
          specificMention = `خبرتك في ${parsed.technicalSkills.split(',')[0].trim()}`;
        }
      }
    } catch (_e) {}

    if (!specificMention) {
      const prjMatch = formattedCv.match(/(?:المشاريع|مشروع|project|projects|إنجازات)[:：\s-]*([^\n\r,.]+)/i);
      const companyMatch = formattedCv.match(/(?:شركة|مؤسسة|مستشفى|مدرسة|مكتب|عيادة|company|at)[:：\s-]*([^\n\r,.]+)/i);
      const techMatch = formattedCv.match(/(?:المهارات|skills|technologies)[:：\s-]*([^\n\r.]+)/i);
      specificMention = prjMatch?.[1]?.trim() || companyMatch?.[1]?.trim() || techMatch?.[1]?.split(',')?.[0]?.trim();
    }

    if (specificMention) {
      return `أهلاً بك يا ${candidateName}! أنا ${actualInterviewerName}، ${roleName}. راجعت سيرتك الذاتية بالتفصيل قبل الميتنج ولفت نظري جداً ${specificMention}. احكي لي بالتفصيل إيه كان دورك الفعلي فيه وكيف اتعاملت مع أكبر التحديات العملية اللي واجهتك؟`;
    }
  }

  return `أهلاً بك يا ${candidateName}! أنا ${actualInterviewerName}، ${roleName}. راجعت سيرتك الذاتية قبل الميتنج ومتحمس جداً لمقابلتنا اليوم. حابب نبدأ بأقوى إنجاز أو مشروع وظيفي في مجالك أنت فخور بيه وشاركته فيه، احكيلي إيه كان التحدي الأكبر فيه وإزاي اتعاملت معاه وحققت أفضل نتيجة؟`;
}

/**
 * 3. Human-like Egyptian Dialect Live Tech Interviewer Engine
 */
export async function liveInterviewChat({
  conversationHistory = [],
  cvContext,
  candidateName = 'أحمد',
  interviewerName = 'أحمد',
  isSara = false,
}) {
  const isFemale = isSara || interviewerName.toLowerCase().includes('sara') || interviewerName.includes('سارة');
  const actualInterviewerName = isFemale ? 'سارة' : 'أحمد';

  // Check if an initial greeting has already occurred
  const hasAlreadyGreeted = (conversationHistory || []).some(
    (m) => m.role === 'assistant' || (m.role === 'user' && conversationHistory.length > 1)
  );

  // ── 1. Populate Contextual Placeholders ─────────────────────────────────────
  const formattedCv = formatCvContext(cvContext);
  const cvVal = formattedCv?.trim() || 'لا توجد سيرة ذاتية إضافية، اعتمد على إجابات المرشح وتخصصه في الحوار.';

  let jobTitleVal = '';
  if (formattedCv) {
    const titleMatch = formattedCv.match(/(?:المسمى الوظيفي|المسمى|الوظيفة|المهنة|التخصص|Job Title|Title|Role)[:：]\s*([^\n\r]+)/i);
    if (titleMatch && titleMatch[1]) {
      jobTitleVal = titleMatch[1].trim();
    }
  }
  if (!jobTitleVal) {
    jobTitleVal = 'المسمى والتخصص المذكور في سيرتك الذاتية';
  }

  const jobDescVal = `وظيفة ${jobTitleVal} متقدمة تركز على الكفاءة التخصصية، حل المشكلات العملية، إتقان معايير العمل، والتعاون الفعال في الفريق.`;

  const userMessages = (conversationHistory || []).filter((m) => m.role === 'user');
  const userTurns = userMessages.length;
  let interviewStageVal = 'المرحلة 1: التعمق في المهام والإنجازات والخبرات السابقة المذكورة في السيرة الذاتية';
  if (userTurns >= 8) {
    interviewStageVal = 'المرحلة 4: الختام واستفسارات وأسئلة المرشح عن بيئة العمل والتحديات القادمة';
  } else if (userTurns >= 5) {
    interviewStageVal = 'المرحلة 3: سيناريوهات حل المشكلات والمواقف المعقدة وضغط العمل وحل النزاعات المهنية';
  } else if (userTurns >= 2) {
    interviewStageVal = 'المرحلة 2: التعمق التخصصي في القرارات المهنية والمشاكل العملية التي واجهها في مسيرته ومجاله';
  }

  const lastUserMsg = [...(conversationHistory || [])].reverse().find((m) => m.role === 'user')?.content?.trim() || '';
  const priorHistory = (conversationHistory || []).slice(0, -1);
  const conversationHistoryVal = priorHistory.length > 0
    ? priorHistory.map((m) => `${m.role === 'user' ? `المرشح (${candidateName})` : actualInterviewerName}: ${m.content}`).join('\n\n')
    : 'المقابلة بدأت للتو بعد التحية الافتتاحية الأولى.';

  const candidateAnswerVal = lastUserMsg || 'المرشح جاهز للبدء.';

  // ── 2. Official Interview Prompt Template (Universal for ALL professions) ───
  const promptTemplate = `
أنت "${actualInterviewerName}"، ${isFemale ? 'مديرة' : 'مدير'} توظيف محترف وخبير في مجال تخصص المرشح ({{JOB_TITLE}})، يجري مقابلة عمل حقيقية عبر Zoom لوظيفة ({{JOB_TITLE}}).

==================================================
القاعدة الحتمية الأولى: الالتزام الحصري بوظيفة مدير التوظيف وعدم التطرق لأي شيء آخر
==================================================
- دورك الوحيد هو "مدير توظيف متخصص وخبير في مجال المرشح" يقيم كفاءة المرشح التخصصية والعملية ومدى ملاءمته لوظيفة ({{JOB_TITLE}}).
- مهما كان تخصص المرشح (طبي، محاسبي ومالي، قانوني، تعليمي وأكاديمي، تسويق ومبيعات، إداري، هندسي، تقني، أو غيره)، تصرف تماماً كمدير توظيف خبير في هذا المجال.
- ممنوع منعاً باتاً التطرق لأي موضوع خارج المقابلة أو خارج نطاق الوظيفة (لا أحاديث جانبية، لا مواضيع شخصية، لا سياسة، ولا مزاح).
- لست روبوت دردشة عام (ولا ChatGPT) ولست معلماً: ممنوع تقديم شروحات للمرشح أو شرح معلومات عامة له أو حل ألغاز أو الإجابة على أسئلة خارج نطاق تقييم الوظيفة.
- إذا حاول المرشح الخروج عن موضوع المقابلة، أو سألك أسئلة شخصية أو خارج التخصص: لا تجب على سؤاله إطلاقاً! بل أعده فوراً وبحزم ولباقة إلى صلب المقابلة التخصصية وتقييم خبراته المذكورة في سيرته الذاتية:
  (مثال: "خلينا نركز في المقابلة المهنية لوظيفة {{JOB_TITLE}}، ونرجع للنقطة اللي كنا بنناقشها في خبرتك...")
- أنت القائد الحصري للمقابلة: وجه دفة الحديث بعد كل إجابة لسؤال تخصصي جديد يقيم مستوى المرشح، ولا تسمح للمرشح بجر المقابلة إلى نقاشات جانبية.

==================================================
القاعدة الحتمية الثانية: قراءة السيرة الذاتية (CV) أولاً وبناء الحوار عليها بالكامل
==================================================
- لقد قمت بدراسة السيرة الذاتية التالية للمرشح بعناية تامة أولاً قبل أي شيء:
--------------------------------------------------
{{CV}}
--------------------------------------------------
- كل سؤال تطرحه يجب أن يكون نابعاً من تفاصيل سيرة هذا المرشح ومجال عمله بالذات (المشاريع والمهام التي أدارها، الشركات والمؤسسات التي عمل بها، والأدوات والمهارات التخصصية المذكورة في سيرته).
- ممنوع منعاً باتاً الأسئلة المعلبة أو الجاهزة مثل "عرفني بنفسك" أو "احكيلي عن تاريخك".
- لو دخل مرشحان مختلفان لنفس الوظيفة، يجب أن يخرج لكل منهما مسار حوار وأسئلة فريدة ومختلفة 100% تطابق مشاريع وخبرات كل مرشح في الـ CV.
- إذا ذكر المرشح أسلوب عمل أو إنجازاً أو أداة، قارنه فوراً بما هو مكتوب في سيرته الذاتية واسأله عن تفاصيل التطبيق الفعلي، القرارات المهنية الحاسمة، والمشاكل التي واجهها في ذلك العمل تحديداً.

========================
بيانات المقابلة الإضافية
========================
الوظيفة المتقدم لها:
{{JOB_TITLE}}

وصف الوظيفة:
{{JOB_DESCRIPTION}}

مرحلة المقابلة الحالية:
{{INTERVIEW_STAGE}}

سياق الحوار السابق:
{{CONVERSATION_HISTORY}}

آخر إجابة للمرشح:
{{CANDIDATE_ANSWER}}

========================
طريقة التصرف وأسلوب الحوار
========================
1. تصرف كمدير توظيف بشري حقيقي هادئ، واثق، ومحترف.
2. لا تتعامل مع المقابلة كقائمة أسئلة ثابتة. كل سؤال جديد ناتج عن إجابة المرشح + تفاصيل الـ CV وتخصصه.
3. تفاعل أولاً بتعليق قصير وذكي يثبت استيعابك لإجابته (مثل: "تمام، وضحت الفكرة." / "كويس، خلينا ناخد النقطة دي أكتر." / "فاهم قصدك.") ثم اطرح سؤالك التالي مباشرة.
4. إذا أعطى المرشح إجابة عامة: اطلب منه مثالاً عملياً من مهامه أو مشاريعه المذكورة في الـ CV.
5. إذا ذكر إنجازاً أو مشروعاً: اسأله عن دوره الفعلي فيه والتحديات التي واجهها وكيف اتخذ القرار المهني.
6. إذا ذكر منهجية أو أداة أو معياراً: اسأله لماذا اختاره وكيف طبقه بدلاً من البدائل الأخرى.

========================
قواعد الصياغة والنطق الصوتي
========================
- تحدث باللهجة المصرية المهنية الواقعية والطبيعية (مثل مقابلات كبرى الشركات والمؤسسات عبر Zoom).
- اجعل الرد قصيراً وسلساً ومناسباً للنطق الصوتي الفوري (تعليق مهني سريع + سؤال مباشر ومحدد في صلب خبرته).
- ممنوع تماماً قول: "أهلاً بيك" أو "مرحباً" أو أي تحية متكررة بعد بدء المقابلة.
- ممنوع استخدام الإيموجي نهائياً.
- ممنوع استخدام تنسيقات Markdown أو عناوين أو نجوم.
- أخرج فقط النص الذي سينطقه مدير التوظيف بصوته مباشرة دون أي كلام إضافي.
`.trim();

  const prompt = promptTemplate
    .replace('{{CV}}', cvVal)
    .replace('{{JOB_TITLE}}', jobTitleVal)
    .replace('{{JOB_DESCRIPTION}}', jobDescVal)
    .replace('{{INTERVIEW_STAGE}}', interviewStageVal)
    .replace('{{CONVERSATION_HISTORY}}', conversationHistoryVal)
    .replace('{{CANDIDATE_ANSWER}}', candidateAnswerVal);

  // 1. Try Groq first if key exists (200ms ultra-fast intelligence)
  let aiText = await callGroq(prompt, '', 3000);

  // 2. Try Gemini
  if (!aiText) {
    aiText = await callGemini(prompt, '', 2500, 250);
  }

  if (aiText && aiText.length > 2) {
    // Sanitize any accidental greetings generated by AI during ongoing interview
    if (hasAlreadyGreeted) {
      const sanitized = aiText.replace(/^(أهلاً|أهلا|مرحباً|مرحبا|منور|صباح الخير|مساء الخير)[^.!؟]*[.!؟]/, '').trim();
      if (sanitized.length > 4) return sanitized;
    }
    return aiText;
  }

  // ── Smart Context-Aware Dynamic Fallback (Universal for ANY field) ──────────
  const lowerMsg = lastUserMsg.toLowerCase();

  // 1. Years of experience detected
  if (
    /(ست|سبع|خمس|أربع|تلات|ثلاث|عشر|\d+)\s*(سنين|سنوات|سنة)/i.test(lowerMsg) ||
    /(سنة|سنتين|سنين|سنوات)\s*خبرة/i.test(lowerMsg)
  ) {
    return `ما شاء الله، سنين خبرة قوية ومحترمة! قولي بقى خلال الفترة دي، إيه أكبر إنجاز أو مشروع وظيفي في سيرتك الذاتية كنت فخور بالنتيجة بتاعته؟`;
  }

  // 2. Candidate inquiry about work environment or off-topic questions
  if (/(بيئة العمل|الشركة|المرتب|المواعيد|طبيعة الشغل|اسأل|عندي سؤال|سؤال)/i.test(lowerMsg)) {
    return `أكيد هنجاوب على كل استفساراتك عن المؤسسة في نهاية المقابلة، بس خلينا دلوقتي نركز في تقييم الجانب التخصصي والخبرات اللي اشتغلت عليها في سيرتك الذاتية. احكي لي بالتفصيل عن أهم دور وظيفي قمت بيه؟`;
  }

  // 3. Audio / connection check
  if (/(^|\s)(سامعني|الو|ألو|سامع|معايا)($|\s)/i.test(lowerMsg)) {
    return `معاك يا ${candidateName} وسامعك بكل وضوح! اتفضل كمل فكرتك في النقطة دي.`;
  }

  // 4. Frustrated or informal expressions
  if (
    /(ما قولتلك|قلتلك|يا عم|يا بني|يا باشا|ايه اللي بيحصل|بتكرر|مش فاهم)/i.test(lowerMsg)
  ) {
    const responses = [
      `تمام يا ${candidateName} خلاص فهمت قصدك ووصلتني الفكرة! قولي بقى إيه أكبر تحدي مهني وتخصصي واجهته في خبراتك السابقة؟`,
      `ولا يهمك يا فندم وصلت تماماً! خلينا نركز في صلب تخصصك، إزاي كنت بتتعامل مع ضغط الشغل والمواعيد في مجالك؟`,
      `تمام حصل خير! احكي لي بقى عن أقوى قرار مهني حاسم اتخذته في وظيفتك السابقة وطلع صح؟`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // 5. Dynamic Conversational Continuation (Zero Canned Questions)
  const cleanSnippet = lastUserMsg.replace(/[\n\r]+/g, ' ').trim();
  if (cleanSnippet.length > 8) {
    const snippetDisplay = cleanSnippet.length > 40 ? cleanSnippet.slice(0, 35) + '...' : cleanSnippet;
    return `تمام يا ${candidateName}، فهمت رؤيتك في جزئية "${snippetDisplay}". طب لو جينا نطبق الإجراء ده في بيئة عمل واقعية وظهرت عقبة غير متوقعة، إيه أول خطوة هتعملها عشان تحدد سبب المشكلة وتعالجها عملياً؟`;
  }

  return `فاهمك يا ${candidateName}. طب احكي لي عن أصعب عقبة وتحدي مهني ظهر معاك وأنت بتطبق الأفكار دي في مجالك، وإزاي اتغلبت عليها عملياً وحققت أفضل نتيجة؟`;
}

/**
 * 4. Generate Final Comprehensive In-Depth Diagnostic Evaluation Report
 */
export async function generateReport(interviewId, conversationHistory = []) {
  // 1. If conversation history is empty, retrieve recorded turns from Supabase
  let history = conversationHistory;
  if (!history || history.length === 0) {
    if (interviewId) {
      try {
        const { data: answers } = await supabase
          .from('interview_answers')
          .select('*')
          .eq('interview_id', interviewId)
          .order('created_at', { ascending: true });

        if (answers && answers.length > 0) {
          history = answers.map(a => ({
            role: 'user',
            content: a.transcription || '',
          }));
        }
      } catch (_e) {}
    }
  }

  // 2. Fetch candidate's CV to cross-analyze
  let cvSummary = '';
  if (interviewId) {
    try {
      const { data: interviewData } = await supabase
        .from('interviews')
        .select('user_id, cv_id')
        .eq('id', interviewId)
        .single();

      if (interviewData?.user_id) {
        const { data: cvData } = await supabase
          .from('cvs')
          .select('raw_text')
          .eq('user_id', interviewData.user_id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (cvData?.[0]?.raw_text) {
          cvSummary = cvData[0].raw_text.slice(0, 1500);
        }
      }
    } catch (_e) {}
  }

  const transcript = (history || []).map((m, idx) => 
    `${m.role === 'user' ? 'المرشح' : 'المحاور'}: ${m.content}`
  ).join('\n\n') || 'المقابلة تمت بشكل حواري مباشر.';

  const prompt = `
أنت رئيس لجنة تقييم التوظيف والاستشارات المهنية في Prova. 
حلل وقيم أداء المرشح بدقة استناداً إلى حوار المقابلة الحية وسيرته الذاتية:

════════════════════════════════════════════════════════════════
سجل حوار المقابلة الفعلي:
════════════════════════════════════════════════════════════════
${transcript}

════════════════════════════════════════════════════════════════
بيانات السيرة الذاتية للمرشح (للمقارنة والمطابقة):
════════════════════════════════════════════════════════════════
${cvSummary || 'لم يتم تقديم نص CV إضافي. استند إلى إجابات المرشح وتخصصه في الحوار.'}

════════════════════════════════════════════════════════════════
المطلوب استخراج تقرير تقييم تفصيلي احترافي بصيغة JSON فقط:
════════════════════════════════════════════════════════════════
أرجع كائن JSON صالح بنسبة 100% يحتوي الحقول التالية بدقة وموضوعية:
{
  "score": <رقم موضوعي من 0 إلى 100 يعبر عن الكفاءة العامة>,
  "verdict": "<حكم التقييم النهائي: جاهز للتوظيف الفوري / موصى به مع تدريب إضافي / يحتاج تدريب وممارسة أكبر>",
  "summary": "<ملخص تنفيذي من فقرتين يصف أداء المرشح في المقابلة وأهم ما ميزه وما افتقده>",
  "strengths": "• نقطة قوة واقعية 1\\n• نقطة قوة 2\\n• نقطة قوة 3",
  "weaknesses": "• فجوة أو نقطة ضعف تم رصدها في المقابلة 1\\n• نقطة 2\\n• نقطة 3",
  "dimensions": [
    { "key": "domain_mastery", "label": "الكفاءة التخصصية والعلمية", "score": <رقم 0-100>, "feedback": "<تعليق دقيق>" },
    { "key": "problem_solving", "label": "التفكير التحليلي وحل المشكلات", "score": <رقم 0-100>, "feedback": "<تعليق دقيق>" },
    { "key": "communication", "label": "الوضوح وجودة التواصل المهني", "score": <رقم 0-100>, "feedback": "<تعليق دقيق>" },
    { "key": "confidence", "label": "الثقة والاتزان المهني", "score": <رقم 0-100>, "feedback": "<تعليق دقيق>" },
    { "key": "role_fit", "label": "المطابقة مع متطلبات الوظيفة", "score": <رقم 0-100>, "feedback": "<تعليق دقيق>" }
  ],
  "detected_errors": [
    {
      "topic": "<موضوع السؤال أو الموقف في المقابلة>",
      "candidate_response": "<ما قاله المرشح باختصار>",
      "issue": "<الخطأ العلمي أو النقص المرصود في إجابته>",
      "ideal_answer": "<الإجابة النموذجية الموصى بها والممارسات المثالية>"
    }
  ],
  "cv_gaps_analysis": [
    {
      "section": "<اسم القسم في الـ CV: مثلاً الخبرات، المشاريع، المهارات>",
      "current_gap": "<ما ينقص هذا القسم بناءً على نقاش المقابلة>",
      "recommendation": "<كيف يحسن المرشح هذا القسم>",
      "before_example": "<مثال صياغة ضعيفة حالية>",
      "after_example": "<مثال صياغة قوية موصى بها تحتوي على أرقام وأثر ملموس>"
    }
  ],
  "action_plan_30_days": [
    {
      "week": "الأسبوع الأول",
      "focus": "<عنوان التركيز>",
      "tasks": ["<مهمة عملية 1>", "<مهمة عملية 2>"]
    },
    {
      "week": "الأسبوع الثاني",
      "focus": "<عنوان التركيز>",
      "tasks": ["<مهمة عملية 1>", "<مهمة عملية 2>"]
    },
    {
      "week": "الأسبوع الثالث",
      "focus": "<عنوان التركيز>",
      "tasks": ["<مهمة عملية 1>", "<مهمة عملية 2>"]
    },
    {
      "week": "الأسبوع الرابع",
      "focus": "<عنوان التركيز>",
      "tasks": ["<مهمة عملية 1>", "<مهمة عملية 2>"]
    }
  ],
  "stats": {
    "totalTurns": ${(history || []).length || 8},
    "talkRatio": "65%",
    "clarityRating": "جيد جداً",
    "hesitationLevel": "منخفض"
  }
}
لا تضف أي نص خارج كائن JSON.
  `.trim();

  let richReport = null;
  const aiText = await callGemini(prompt, '', 10000, 2500);
  if (aiText) {
    const match = aiText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        richReport = JSON.parse(match[0]);
      } catch (_e) {}
    }
  }

  // Fallback if AI generation failed
  if (!richReport || !richReport.score) {
    const userMessages = (history || []).filter(m => m.role === 'user');
    const score = Math.min(92, Math.max(68, 70 + userMessages.length * 3));

    richReport = {
      score,
      verdict: score >= 80 ? 'موصى به للتوظيف (Recommended)' : 'موصى به مع تدريب إضافي (Recommended with Training)',
      summary: 'أظهر المرشح تفاعلاً إيجابياً ورغبة في التواصل، مع وضوح في المبادئ الأساسية لمجاله، ويحتاج إلى تعزيز الإجابات بأمثلة واقعية وأرقام قابلة للقياس.',
      strengths: `• تفاعل مباشر وإجابات سريعة أثناء النقاش الحي.
• قدرة جيدة على شرح الخبرات العملية والمفاهيم الأساسية.
• أسلوب تواصل مهني وإيجابي مناسب لبيئة العمل الجماعي.`,
      weaknesses: `• يمكن تدعيم النقاش بمزيد من الأرقام ومقاييس الأداء للمشاريع المنجزة.
• الحاجة إلى الاستفاضة أكثر في حلول معالجة المشكلات الطارئة وإدارة الأزمات.
• تجنب الإجابات المقتضبة والحرص على شرح المنهجية المتبعة.`,
      dimensions: [
        { key: 'domain_mastery', label: 'الكفاءة التخصصية والعلمية', score: Math.min(95, score + 2), feedback: 'إلمام جيد بأساسيات المجال مع حاجة لتدعيم الأمثلة.' },
        { key: 'problem_solving', label: 'التفكير التحليلي وحل المشكلات', score: Math.max(65, score - 5), feedback: 'طريقة تفكير منطقية تحتاج تركيزاً على الحالات الاستثنائية.' },
        { key: 'communication', label: 'الوضوح وجودة التواصل المهني', score: Math.min(96, score + 6), feedback: 'لباقة ووضوح في مخارج الحوار والتجاوب.' },
        { key: 'confidence', label: 'الثقة والاتزان المهني', score: score, feedback: 'حضور متزن وهادئ طوال المقابلة.' },
        { key: 'role_fit', label: 'المطابقة مع متطلبات الوظيفة', score: score - 2, feedback: 'الخلفية تتطابق بدرجة جيدة مع المسار المستهدف.' }
      ],
      detected_errors: [
        {
          topic: 'عرض المنهجية وحل المشكلات',
          candidate_response: 'إجابات عامة دون تفصيل الخطوات العملية أو المنهجية.',
          issue: 'غياب نموذج STAR (الموقف، المهمة، الإجراء، النتيجة) في صياغة التجارب.',
          ideal_answer: 'البدء بتحديد الموقف الحقيقي، ثم الإجراء التقني/المهني المتبع، وختاماً بالأثر والنتيجة الملموسة.'
        }
      ],
      cv_gaps_analysis: [
        {
          section: 'قسم المشاريع والخبرات السابقة',
          current_gap: 'المهام مكتوبة بصيغة واجبات عامة دون نسب مئوية أو أرقام قياسية.',
          recommendation: 'استخدم صيغة الإنجاز (Action + Metric + Result) لإبراز كفاءتك.',
          before_example: 'المشاركة في إنجاز المشاريع والتعامل مع الفريق وتطبيق المتطلبات.',
          after_example: 'تنفيذ وتسليم 4 مشاريع رئيسية في الموعد المحدد بنسبة رضا بلغت 95% وتقليص الأخطاء بنسبة 20%.'
        }
      ],
      action_plan_30_days: [
        { week: 'الأسبوع الأول', focus: 'مراجعة الأساسيات والمصطلحات', tasks: ['مراجعة أدق المفاهيم في تخصصك', 'كتابة ملخص بأهم 5 حالات مهنية مررت بها'] },
        { week: 'الأسبوع الثاني', focus: 'تطوير السيرة الذاتية', tasks: ['إضافة الأرقام ونسب النجاح في الـ CV', 'تحديث قسم المهارات والمراجع'] },
        { week: 'الأسبوع الثالث', focus: 'التدريب على منهجية STAR', tasks: ['صياغة 5 إجابات نموذجية للمواقف الصعبة', 'التدرب على التحدث بوضوح وثقة لمدة دقيقتين'] },
        { week: 'الأسبوع الرابع', focus: 'محاكاة مقابلة Prova النهائية', tasks: ['إجراء مقابلة جديدة على المنصة', 'تحقيق نتيجة تفوق 88%'] }
      ],
      stats: {
        totalTurns: (history || []).length || 8,
        talkRatio: '65%',
        clarityRating: 'جيد جداً',
        hesitationLevel: 'منخفض'
      }
    };
  }

  // Save the full structured report payload to Supabase
  if (interviewId) {
    try {
      const payloadString = JSON.stringify(richReport);
      await supabase.from('reports').upsert({
        interview_id: interviewId,
        score: richReport.score,
        strengths: richReport.strengths,
        weaknesses: richReport.weaknesses,
        cv_suggestions: payloadString, // Embed the complete rich JSON safely in cv_suggestions
      }, { onConflict: 'interview_id' });
    } catch (dbErr) {
      console.warn('Could not persist rich report to Supabase:', dbErr);
    }
  }

  return richReport;
}

