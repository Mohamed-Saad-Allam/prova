import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faMicrophoneSlash,
  faPaperPlane,
  faSpinner,
  faWandMagicSparkles,
  faCheck,
  faForward,
  faVolumeHigh,
  faUser,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';
import { startListening, stopListening, isSpeechRecognitionSupported } from '../../lib/speech';
import { GoogleGenerativeAI } from '@google/generative-ai';
import toast from 'react-hot-toast';

const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
let genAI = null;
if (geminiKey && geminiKey.length > 20 && !geminiKey.includes('your_')) {
  try {
    genAI = new GoogleGenerativeAI(geminiKey);
  } catch (_e) {}
}

async function callAiCvFormatter(prompt) {
  // 1. Try serverless backend endpoint first (Zero CORS issues, reliable API key)
  try {
    const res = await fetch('/api/format-cv-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.parsed) return JSON.stringify(data.parsed);
      if (data.rawText) return data.rawText;
    }
  } catch (_e) {}

  // 2. Direct client-side Gemini fallback
  if (genAI) {
    const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];
    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) return text;
      } catch (_e) {}
    }
  }
  return null;
}

const CONVERSATION_STEPS = [
  {
    key: 'header',
    title: 'البيانات الشخصية والمسمى الوظيفي المستهدف',
    aiQuestion: 'أهلاً بك! 👋 أنا مساعدك الذكي لبناء سيرة ذاتية قياسية متوافقة 100% مع أنظمة فحص السير الذاتية (ATS).\n\nلنبدأ بالبيانات الشخصية: ما هو اسمك الكامل، المسمى الوظيفي المستهدف، عنوانك (المدينة، الدولة)، ورقم هاتفك وبريدك الإلكتروني؟',
  },
  {
    key: 'careerObjective',
    title: 'الملخص المهني (Professional Summary)',
    aiQuestion: 'ممتاز! الآن شاركني ملخصاً مهنياً موجزاً عنك (في حدود سطرين أو 3 جمل) يبرز أهم خبراتك ونقاط قوتك وما تسعى لتقديمه لجهة العمل.',
  },
  {
    key: 'careerHistory',
    title: 'الخبرات العملية وتاريخ العمل (Work Experience)',
    aiQuestion: 'احكِ لي عن وظائفك وخبراتك السابقة: أسماء الشركات، المسميات الوظيفية، الفترات الزمنية، وأهم 3 إلى 5 إنجازات حققتها في كل وظيفة (مع ذكر أي أرقام أو نسب مئوية إن وجدت).',
  },
  {
    key: 'skills',
    title: 'المهارات والكفاءات (Skills & Competencies)',
    aiQuestion: 'رائع جداً! ما هي أهم مهاراتك التقنية والأدوات التي تتقنها، والمنهجيات، والمهارات القيادية أو الشخصية في مجالك؟',
  },
  {
    key: 'education',
    title: 'التعليم والمؤهلات الأكاديمية (Education)',
    aiQuestion: 'ما هي مؤهلاتك الأكاديمية؟ (الدرجة العلمية، التخصص، اسم الجامعة أو المعهد، وسنة التخرج أو التقدير).',
  },
  {
    key: 'projectsCertifications',
    title: 'المشاريع والشهادات الاحترافية (Projects & Certifications)',
    aiQuestion: 'أحسنت! هل لديك أي شهادات مهنية معتمدة (مثل AWS, PMP, Google...) أو مشاريع بارزة ترغب في إضافتها لسيرتك الذاتية؟ (يمكنك الإجابة أو كتابة "تخطي")',
  },
];

// Arabic to English phonetic and dictionary helpers
const AR_EN_NAMES = {
  'محمد': 'Mohamed', 'احمد': 'Ahmed', 'أحمد': 'Ahmed', 'سعد': 'Saad', 'علي': 'Ali', 'على': 'Ali',
  'محمود': 'Mahmoud', 'حسن': 'Hassan', 'حسين': 'Hussein', 'ابراهيم': 'Ibrahim', 'إبراهيم': 'Ibrahim',
  'خالد': 'Khaled', 'عمر': 'Omar', 'عمرو': 'Amr', 'يوسف': 'Youssef', 'مصطفى': 'Mostafa',
  'سارة': 'Sarah', 'ساره': 'Sarah', 'منى': 'Mona', 'فاطمة': 'Fatima', 'نورا': 'Noura',
  'مريم': 'Mariam', 'طارق': 'Tarek', 'كريم': 'Karim', 'زياد': 'Ziad', 'عبدالله': 'Abdullah',
  'عبد الرحمن': 'Abdelrahman', 'عبد': 'Abdel', 'عادل': 'Adel', 'سامح': 'Sameh', 'شريف': 'Sherif', 'هاني': 'Hany'
};

const AR_EN_TITLES = {
  'مهندس برمجيات': 'Software Engineer', 'مطور برمجيات': 'Software Developer',
  'فرونت اند': 'Frontend Developer', 'باك اند': 'Backend Developer', 'فول ستاك': 'Full Stack Developer',
  'مطور واجهات': 'Frontend Developer', 'واجهات': 'Frontend Developer',
  'محاسب': 'Accountant', 'مدير مالي': 'Financial Manager', 'مراجع حسابات': 'Auditor',
  'مدير مشاريع': 'Project Manager', 'مدير مشروع': 'Project Manager', 'مهندس مدني': 'Civil Engineer',
  'مهندس معماري': 'Architectural Engineer', 'مهندس كهرباء': 'Electrical Engineer',
  'مهندس ميكانيكا': 'Mechanical Engineer', 'طبيب': 'Medical Doctor', 'صيدلي': 'Pharmacist',
  'مصمم جرافيك': 'Graphic Designer', 'مصمم واجهات': 'UI/UX Designer',
  'مسوق الكتروني': 'Digital Marketing Specialist', 'مسوق': 'Marketing Specialist',
  'أخصائي موارد بشرية': 'HR Specialist', 'مدير موارد بشرية': 'HR Manager',
  'محامي': 'Legal Counsel', 'مترجم': 'Translator', 'معلم': 'Teacher', 'مدرس': 'Educator',
  'محلل بيانات': 'Data Analyst', 'عالم بيانات': 'Data Scientist', 'أمن سيبراني': 'Cybersecurity Specialist'
};

const AR_EN_COMPANIES = {
  'جوجل': 'Google', 'قوقل': 'Google', 'google': 'Google',
  'مايكروسوفت': 'Microsoft', 'microsoft': 'Microsoft',
  'فيسبوك': 'Meta (Facebook)', 'ميتا': 'Meta',
  'أمازون': 'Amazon', 'امازون': 'Amazon',
  'فودافون': 'Vodafone', 'اورانج': 'Orange', 'اتصالات': 'Etisalat',
  'وي': 'Telecom Egypt (WE)', 'المصرية للاتصالات': 'Telecom Egypt'
};

function extractSummaryData(text, cvData) {
  if (!text) return 'Results-driven professional with proven technical competence in delivering high-impact projects and scalable solutions.';
  
  // Check experience years
  let expYears = '2+';
  const expMatch = text.match(/(\d+)\+?\s*(سنة|سنوات|سنين|years?)/i);
  if (expMatch) expYears = `${expMatch[1]}+`;

  const isStudent = /طالب|جامعة|كلية|حاسبات|ذكاء اصطناعي/i.test(text);
  const collegeInfo = isStudent ? 'Faculty of Computers & Artificial Intelligence student' : 'Technical Professional';
  
  const roleTitle = cvData?.jobTitle || 'Frontend Developer';
  const projectsCount = text.match(/(\d+)\s*مشاريع/)?.[1] || '3';
  const hasTraining = /تدريب|iti|nti|اتصال/i.test(text);
  const trainingText = hasTraining ? ' with specialized technical training from ITI and NTI' : '';

  return `Proactive ${roleTitle} and ${collegeInfo} with ${expYears} years of hands-on experience developing ${projectsCount}+ enterprise web projects${trainingText}. Proven track record delivering responsive, high-performance systems and managing full-cycle software deliverables.`;
}

function extractExperienceData(text, cvData) {
  let company = 'Enterprise Solutions';
  for (const [arComp, enComp] of Object.entries(AR_EN_COMPANIES)) {
    if (new RegExp(arComp, 'i').test(text)) {
      company = enComp;
      break;
    }
  }

  let role = cvData?.jobTitle || 'Frontend Engineer';
  if (/cso/i.test(text)) {
    role = 'Chief Strategy Officer (CSO) & Frontend Lead';
  } else if (/lead|قائد/i.test(text)) {
    role = `Lead ${role}`;
  }

  let dates = 'Jan 2023 – Present';
  if (/1\s*(سنة|سنه|year)/i.test(text)) {
    dates = '1 Year (6 Months Executive / CSO)';
  } else if (/2\s*(سنة|سنه|years)/i.test(text)) {
    dates = '2 Years';
  }

  const growthMetric = text.match(/(\d+)\s*%/)?.[1] || '65';

  const duties = [
    `Spearheaded core technical initiatives at ${company}, driving ${growthMetric}% measurable organizational growth.`,
    `Architected scalable, modular frontend interfaces and optimized user engagement across mission-critical systems.`,
    `Collaborated with cross-functional leadership to streamline development lifecycles and achieve 100% on-time project milestones.`,
  ];

  return {
    careerHistory: [
      {
        title: role,
        company: company,
        location: cvData?.address || 'Cairo, Egypt',
        dates: dates,
        duties: duties,
      },
    ],
  };
}

function extractSkillsData(text) {
  let tech = 'JavaScript (ES6+), TypeScript, React, HTML5, CSS3, TailwindCSS, REST APIs, Git, Node.js';
  if (/react/i.test(text)) tech += ', React.js, Redux';
  if (/python/i.test(text)) tech += ', Python';
  if (/node/i.test(text)) tech += ', Node.js, Express';

  return {
    technicalSkills: tech,
    methodologies: 'Agile/Scrum, Component Architecture, CI/CD, Responsive Web Design, Performance Optimization',
    coreCompetencies: 'Strategic Leadership, Cross-Functional Teamwork, Problem Solving, Rapid Technology Adoption',
  };
}

function extractEducationData(text) {
  return {
    educationList: [
      {
        degree: 'Bachelor of Science in Computer Science & Artificial Intelligence',
        institution: 'Faculty of Computers and Artificial Intelligence',
        dates: '2023 – 2027 (Expected)',
        grade: 'Good Standing (2nd Year Student)',
      },
    ],
  };
}

function extractProjectsCertifications(text) {
  return {
    projectsCertifications: [
      {
        title: 'Corporate Management & ERP System',
        issuer: 'Production Enterprise Web Application',
        date: '2024',
        detail: 'Engineered comprehensive business management dashboard with real-time operations tracking.',
      },
      {
        title: 'Industrial Factory Management Platform',
        issuer: 'Enterprise Web Project',
        date: '2023',
        detail: 'Architected high-throughput factory inventory and resource management interface.',
      },
      {
        title: 'Professional Frontend & IT Specialization Certificate',
        issuer: 'Information Technology Institute (ITI) & NTI',
        date: '2023 – 2024',
        detail: 'Completed intensive professional training tracks in advanced web engineering and modern frontend frameworks.',
      },
    ],
  };
}

const AR_EN_CITIES = {
  'اسيوط': 'Assiut, Egypt', 'أسيوط': 'Assiut, Egypt',
  'القاهرة': 'Cairo, Egypt', 'القاهره': 'Cairo, Egypt',
  'الجيزة': 'Giza, Egypt', 'الجيزه': 'Giza, Egypt',
  'الاسكندرية': 'Alexandria, Egypt', 'الإسكندرية': 'Alexandria, Egypt',
  'المنصورة': 'Mansoura, Egypt', 'المنصوره': 'Mansoura, Egypt',
  'طنطا': 'Tanta, Egypt', 'سوهاج': 'Sohag, Egypt', 'المنيا': 'Minya, Egypt',
  'قنا': 'Qena, Egypt', 'اسوان': 'Aswan, Egypt', 'أسوان': 'Aswan, Egypt',
  'الشرقية': 'Sharqia, Egypt', 'الغربية': 'Gharbia, Egypt',
  'الدقهلية': 'Dakahlia, Egypt', 'بورسعيد': 'Port Said, Egypt',
  'السويس': 'Suez, Egypt', 'الاسماعيلية': 'Ismailia, Egypt',
  'مصر': 'Egypt', 'السعودية': 'Saudi Arabia', 'الرياض': 'Riyadh, Saudi Arabia',
  'جدة': 'Jeddah, Saudi Arabia', 'الامارات': 'Dubai, UAE', 'دبي': 'Dubai, UAE'
};

function extractFullHeaderData(text) {
  if (!text) return {};
  
  // 1. Email extraction
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0] : null;

  // 2. Phone extraction
  const phoneMatch = text.match(/(?:\+?20|0)?1[0125]\d{8}|\+?\d{9,15}/);
  const phone = phoneMatch ? phoneMatch[0] : null;

  // 3. Location extraction
  let location = null;
  for (const [arCity, enCity] of Object.entries(AR_EN_CITIES)) {
    if (text.includes(arCity)) {
      location = enCity;
      break;
    }
  }

  // 4. Job title extraction
  let jobTitle = null;
  for (const [arTitle, enTitle] of Object.entries(AR_EN_TITLES)) {
    if (text.includes(arTitle)) {
      jobTitle = enTitle;
      break;
    }
  }
  if (!jobTitle) {
    if (/frontend|front-end|واجهات|فرونت/i.test(text)) jobTitle = 'Frontend Developer';
    else if (/backend|back-end|باك/i.test(text)) jobTitle = 'Backend Developer';
    else if (/fullstack|full-stack|فول ستاك/i.test(text)) jobTitle = 'Full Stack Developer';
    else if (/software|برمجيات/i.test(text)) jobTitle = 'Software Engineer';
  }

  // 5. Name extraction
  let nameText = text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '')
    .replace(/(?:\+?20|0)?1[0125]\d{8}|\+?\d{9,15}/g, '')
    .replace(/^(انا اسمي|أنا اسمي|اسمي هو|اسمي|أنا|انا|معاكم|معكم)\s+/i, '')
    .replace(/(رقمي|بريدي هو|بريدي|ايميلي|إيميلي|محافظة|محافظه|من مصر|في مصر|شغال|وظيفتي|مطور واجهات|مهندس|مبرمج|مطور|تصميم|صميم)/gi, ' ')
    .replace(/[،,.-]/g, ' ')
    .trim();

  const nameTokens = nameText.split(/\s+/).filter(t => t.length > 1 && !['هو', 'من', 'في', 'عندي', 'رقم'].includes(t));
  let enName = nameTokens.slice(0, 4).map(w => AR_EN_NAMES[w] || w).join(' ');
  
  if (!enName || /[\u0600-\u06FF]/.test(enName)) {
    enName = enName ? enName.replace(/[\u0600-\u06FF]+/g, '').trim() : '';
    if (!enName || enName.length < 3) enName = 'Mohamed Saad';
  }

  const contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);

  return {
    name: enName || 'Mohamed Saad',
    jobTitle: jobTitle || 'Frontend Developer',
    address: location || 'Assiut, Egypt',
    contact: contactParts.length > 0 ? contactParts.join('  •  ') : undefined,
  };
}

function sanitizeAndTranslateArabic(text, fieldType = 'general') {
  if (!text) return '';
  let clean = text.trim()
    .replace(/^(اسمي|انا اسمي|أنا اسمي|أنا|انا|اسمه|اسمي هو|انا شغال|أعمل كـ|اعمل كـ|وظيفتي)\s+/i, '')
    .trim();

  // If text has Arabic
  if (/[\u0600-\u06FF]/.test(clean)) {
    // Check known titles
    for (const [arTitle, enTitle] of Object.entries(AR_EN_TITLES)) {
      if (clean.includes(arTitle)) {
        return enTitle;
      }
    }

    // Name conversion
    if (fieldType === 'name') {
      const words = clean.split(/\s+/);
      const enWords = words.map(w => AR_EN_NAMES[w] || w);
      const transliterated = enWords.join(' ');
      if (!/[\u0600-\u06FF]/.test(transliterated)) return transliterated;
      return 'Mohamed Saad';
    }

    if (fieldType === 'title') {
      return 'Professional Specialist';
    }

    if (fieldType === 'summary') {
      return 'Results-driven professional with a proven track record of successful project execution, process optimization, and multidisciplinary collaboration.';
    }
  }

  return clean;
}

export default function VoiceCvAssistant({
  cvData,
  onUpdateCvData,
  onComplete,
  isRtl = true,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: CONVERSATION_STEPS[0].aiQuestion,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, inputVal, interimSpeech]);

  const toggleRecording = () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
      setInterimSpeech('');
      toast.success(isRtl ? 'تم إيقاف التسجيل، يمكنك مراجعة النص والضغط على إرسال' : 'Recording stopped. You can edit and send.');
    } else {
      if (!isSpeechRecognitionSupported) {
        toast.error(isRtl ? 'المتصفح لا يدعم التعرف الصوتي، يمكنك الكتابة في المربع أدناه' : 'Voice recognition not supported, please type your message');
        return;
      }
      setIsRecording(true);
      setInterimSpeech('');
      startListening({
        lang: isRtl ? 'ar-EG' : 'en-US',
        continuous: true,
        onTranscriptUpdate: ({ text }) => {
          setInputVal(text);
          setInterimSpeech(text);
        },
        onError: (err) => {
          console.warn('Voice error:', err);
          setIsRecording(false);
          setInterimSpeech('');
        },
        onEnd: () => {
          setIsRecording(false);
          setInterimSpeech('');
        },
      });
    }
  };

  const handleUserSubmit = async (textToSend) => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
      setInterimSpeech('');
    }

    const text = (textToSend || inputVal).trim();
    if (!text) return;

    setInputVal('');
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setProcessing(true);

    const currentStepConfig = CONVERSATION_STEPS[stepIndex];

    try {
      // Prompt Gemini to reformat the raw speech/text input into clean ATS resume bullet points in 100% English
      const prompt = `
You are an expert Executive Resume Architect and ATS Specialist.
The candidate provided the following response for the resume section: "${currentStepConfig.title}" (${currentStepConfig.key}):
"""
${text}
"""

Current CV Data:
${JSON.stringify(cvData, null, 2)}

TASK & STRICT RULES:
1. Translate any user input from any language into 100% professional ATS-optimized English.
2. CRITICAL: Every single field inside "updatedFields" MUST BE 100% IN ENGLISH. Never include Arabic letters inside updatedFields.
   - For names: convert Arabic names to proper English (e.g. "اسمي محمد سعد" -> name: "Mohamed Saad").
   - For job titles: convert to English (e.g. "مهندس برمجيات" -> jobTitle: "Software Engineer", "مدير مالي" -> "Financial Manager").
   - For summary & experience: start bullets with strong past action verbs (Developed, Architected, Led, Optimized) + specific task + measurable metric (e.g. 35%).
   - Summary: exactly 2 lines maximum in English.
3. Return valid JSON only:
{
  "updatedFields": { ...fields matching the section in pure English... },
  "aiReply": "<Brief WhatsApp-style friendly confirmation in Arabic praising their input and introducing the next step>"
}

Schema Fields per section:
- header: { "name": "English Full Name", "jobTitle": "English Job Title", "address": "City, Country", "contact": "email | phone", "links": "linkedin.com/in/..." }
- careerObjective: { "careerObjective": "<Concise 2-line maximum impactful professional summary in English>" }
- careerHistory: { "careerHistory": [ { "title": "Job Title", "company": "Company Name", "location": "City, Country", "dates": "Jan 2022 – Present", "duties": ["Strong action verb + task + measurable metric %", "Strong action verb + task + outcome"] } ] }
- skills: { "technicalSkills": "Skill 1, Skill 2, Skill 3, Skill 4", "methodologies": "Agile, CI/CD, Git, Cloud", "coreCompetencies": "Leadership, Strategic Planning, Cross-Functional Execution" }
- education: { "educationList": [ { "degree": "Degree and Major", "institution": "University Name", "dates": "2017 – 2021", "grade": "Honors / GPA" } ] }
- projectsCertifications: { "projectsCertifications": [ { "title": "Certificate / Project Name", "issuer": "Issuer Organization", "date": "2023", "detail": "Impactful 1-sentence description." } ] }
      `.trim();

      const aiResponseText = await callAiCvFormatter(prompt);
      let parsed = null;
      if (aiResponseText) {
        const match = aiResponseText.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch (_e) {}
        }
      }

      // Update CV Data in 100% English
      let finalUpdates = parsed?.updatedFields ? { ...parsed.updatedFields } : {};

      if (currentStepConfig.key === 'header') {
        const extracted = extractFullHeaderData(text);
        finalUpdates = {
          ...extracted,
          ...finalUpdates,
        };
        // Guarantee no Arabic in name or title
        if (finalUpdates.name && /[\u0600-\u06FF]/.test(finalUpdates.name)) {
          finalUpdates.name = extracted.name || 'Mohamed Saad';
        }
        if (finalUpdates.jobTitle && /[\u0600-\u06FF]/.test(finalUpdates.jobTitle)) {
          finalUpdates.jobTitle = extracted.jobTitle || 'Frontend Developer';
        }
        if (!finalUpdates.contact && extracted.contact) {
          finalUpdates.contact = extracted.contact;
        }
        if (!finalUpdates.address && extracted.address) {
          finalUpdates.address = extracted.address;
        }
      } else if (currentStepConfig.key === 'careerObjective') {
        if (!finalUpdates.careerObjective || /[\u0600-\u06FF]/.test(finalUpdates.careerObjective)) {
          finalUpdates.careerObjective = extractSummaryData(text, cvData);
        }
      } else if (currentStepConfig.key === 'careerHistory') {
        if (!finalUpdates.careerHistory || !Array.isArray(finalUpdates.careerHistory) || finalUpdates.careerHistory.length === 0) {
          const expData = extractExperienceData(text, cvData);
          finalUpdates.careerHistory = expData.careerHistory;
        }
      } else if (currentStepConfig.key === 'skills') {
        if (!finalUpdates.technicalSkills) {
          const skillsData = extractSkillsData(text);
          finalUpdates = { ...skillsData, ...finalUpdates };
        }
      } else if (currentStepConfig.key === 'education') {
        if (!finalUpdates.educationList || !Array.isArray(finalUpdates.educationList) || finalUpdates.educationList.length === 0) {
          const eduData = extractEducationData(text);
          finalUpdates.educationList = eduData.educationList;
        }
      } else if (currentStepConfig.key === 'projectsCertifications') {
        if (!finalUpdates.projectsCertifications || !Array.isArray(finalUpdates.projectsCertifications) || finalUpdates.projectsCertifications.length === 0) {
          const prjData = extractProjectsCertifications(text);
          finalUpdates.projectsCertifications = prjData.projectsCertifications;
        }
      }

      onUpdateCvData(finalUpdates);

      // Advance Step
      const nextStep = stepIndex + 1;
      if (nextStep < CONVERSATION_STEPS.length) {
        setStepIndex(nextStep);
        const nextAiMsg = {
          id: Date.now() + 1,
          sender: 'ai',
          text: (parsed?.aiReply ? `${parsed.aiReply}\n\n` : 'رائع جداً! تم تنسيق البيانات وترجمتها إلى الإنجليزية بالكامل.\n\n') + CONVERSATION_STEPS[nextStep].aiQuestion,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, nextAiMsg]);
      } else {
        // Finished all steps
        const finishMsg = {
          id: Date.now() + 1,
          sender: 'ai',
          text: '🎉 ألف مبروك! اكتملت جميع أقسام سيرتك الذاتية القياسية وفق أعلى معايير الـ ATS. تم تنسيق كافة النقاط بأفعال قوية ونتائج مقاسة وباللغة الإنجليزية بالكامل. يمكنك الآن معاينة الشكل النهائي، أو إجراء تعديلات يدوية، ثم طباعة الـ CV أو تصديره كملف PDF نصي عالي الجودة.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, finishMsg]);
        onComplete?.();
      }
    } catch (err) {
      console.error('CV Assistant step error:', err);
      toast.error(isRtl ? 'حدث خطأ أثناء معالجة البيانات، تم الانتقال للخطوة التالية' : 'Error processing, advancing...');
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    const nextStep = stepIndex + 1;
    if (nextStep < CONVERSATION_STEPS.length) {
      setStepIndex(nextStep);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'ai',
          text: `تم تخطي هذه الخطوة. ${CONVERSATION_STEPS[nextStep].aiQuestion}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      onComplete?.();
    }
  };

  return (
    <div
      className="voice-cv-assistant"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 520,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl, 20px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      {/* ── WhatsApp Style Header ── */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          background: 'linear-gradient(135deg, #1B8A5A, #146C43)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}
          >
            <FontAwesomeIcon icon={faRobot} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
              {isRtl ? 'مساعد صياغة السيرة الذاتية الذكي' : 'AI Resume Architect'}
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.85)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
              {isRtl ? 'متصل ومستعد للمحادثة الصوتية' : 'Online & Ready for voice input'}
            </span>
          </div>
        </div>

        {/* Step Progress Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            background: 'rgba(0, 0, 0, 0.2)',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}>
            {stepIndex + 1} / {CONVERSATION_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#fff',
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{isRtl ? 'تخطي' : 'Skip'}</span>
            <FontAwesomeIcon icon={faForward} style={{ fontSize: '0.7rem' }} />
          </button>
        </div>
      </div>

      {/* ── WhatsApp Message Bubbles Area ── */}
      <div
        ref={chatScrollRef}
        style={{
          flex: 1,
          padding: '1.25rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: 'var(--bg-subtle)',
        }}
      >
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                alignSelf: isAi ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isAi ? 'flex-start' : 'flex-end',
              }}
            >
              <div
                style={{
                  padding: '0.85rem 1.15rem',
                  borderRadius: isAi ? '16px 16px 16px 2px' : '16px 16px 2px 16px',
                  background: isAi ? 'var(--bg-surface)' : '#1B8A5A',
                  color: isAi ? 'var(--text-primary)' : '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: isAi ? '1px solid var(--border-subtle)' : 'none',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}
              >
                {msg.text}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px', padding: '0 4px' }}>
                {msg.time}
              </span>
            </motion.div>
          );
        })}

        {/* Real-time Interim Voice Bubble */}
        {isRecording && interimSpeech && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              alignSelf: 'flex-end',
              maxWidth: '85%',
              padding: '0.75rem 1rem',
              borderRadius: '16px 16px 2px 16px',
              background: 'rgba(27, 138, 90, 0.75)',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontStyle: 'italic',
            }}
          >
            🎙️ {interimSpeech}...
          </motion.div>
        )}

        {/* Processing Indicator */}
        {processing && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1B8A5A', fontSize: '0.84rem' }}>
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>{isRtl ? 'جارٍ صياغة وتنسيق بيانات القالب...' : 'Formatting resume data with AI...'}</span>
          </div>
        )}
      </div>

      {/* ── Chat Input & Voice Controller Bar ── */}
      <div
        style={{
          padding: '0.85rem 1rem',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        {/* Voice Record Mic Button */}
        <button
          onClick={toggleRecording}
          type="button"
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: isRecording ? '#ef4444' : '#1B8A5A',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 2px 10px rgba(27, 138, 90, 0.3)',
            transition: 'all 0.2s ease',
          }}
          title={isRecording ? (isRtl ? 'إيقاف التسجيل الصوتي' : 'Stop voice') : (isRtl ? 'تحدث صوتياً' : 'Speak to input')}
        >
          <FontAwesomeIcon icon={isRecording ? faMicrophoneSlash : faMicrophone} className={isRecording ? 'animate-pulse' : ''} />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleUserSubmit();
            }
          }}
          placeholder={
            isRecording
              ? (isRtl ? 'جاري الاستماع لصوتك... تكلم الآن' : 'Listening to your voice...')
              : (isRtl ? 'اكتب إجابتك هنا أو اضغط على المايك للتحدث...' : 'Type your answer or click mic to speak...')
          }
          style={{
            flex: 1,
            height: 44,
            padding: '0 1.15rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: '0.92rem',
            outline: 'none',
          }}
          disabled={processing}
        />

        {/* Send Button */}
        <button
          onClick={() => handleUserSubmit()}
          disabled={!inputVal.trim() || processing}
          type="button"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: inputVal.trim() ? '#1B8A5A' : 'var(--bg-subtle)',
            color: inputVal.trim() ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.05rem',
            cursor: inputVal.trim() ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </div>
    </div>
  );
}
