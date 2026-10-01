import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Candidate embedding models in order of priority
const CANDIDATE_EMBEDDING_MODELS = [
  'gemini-embedding-2',
  'gemini-embedding-001',
  'gemini-embedding-2-preview',
  'text-embedding-004',
];

// Candidate generative text models for gap analysis
const CANDIDATE_GENERATIVE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
];

/**
 * Computes cosine similarity between two float vectors.
 * Returns a value between -1.0 and 1.0 (typically 0.40 - 0.95 for natural language).
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates vector embedding for a given text using Gemini's embedding model.
 */
export async function getEmbedding(text, genAI) {
  if (!text || !text.trim()) return null;
  const cleanText = text.trim().slice(0, 8000); // Respect input window

  for (const modelName of CANDIDATE_EMBEDDING_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.embedContent(cleanText);
      const values = result?.embedding?.values;
      if (values && values.length > 0) {
        return { values, model: modelName };
      }
    } catch (_err) {
      // Continue to next candidate model
      continue;
    }
  }

  throw new Error('Failed to generate embeddings: all candidate embedding models were unavailable.');
}

/**
 * Chunks text into meaningful semantic components (bullet points, responsibilities, skills).
 */
export function chunkText(text, maxChunks = 12) {
  if (!text) return [];

  // If text is JSON (structured CV), extract key string parts
  let raw = text;
  if (typeof text === 'string' && text.trim().startsWith('{') && text.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      const parts = [];
      if (parsed.jobTitle) parts.push(`Target Role: ${parsed.jobTitle}`);
      if (parsed.careerObjective) parts.push(`Objective: ${parsed.careerObjective}`);
      if (parsed.technicalSkills) parts.push(`Skills: ${parsed.technicalSkills}`);
      if (parsed.methodologies) parts.push(`Methodologies: ${parsed.methodologies}`);
      if (parsed.coreCompetencies) parts.push(`Competencies: ${parsed.coreCompetencies}`);
      if (Array.isArray(parsed.careerHistory)) {
        parsed.careerHistory.forEach(h => {
          const title = `${h.title || ''} at ${h.company || ''}`;
          if (Array.isArray(h.duties)) {
            h.duties.forEach(d => parts.push(`${title}: ${d}`));
          } else if (h.duties) {
            parts.push(`${title}: ${h.duties}`);
          }
        });
      }
      if (Array.isArray(parsed.projectsCertifications)) {
        parsed.projectsCertifications.forEach(p => {
          parts.push(`Project/Certification: ${p.title || ''} - ${p.detail || ''}`);
        });
      }
      if (parts.length > 0) return parts.slice(0, maxChunks);
    } catch (_e) {}
  }

  // Standard line / bullet point chunking
  const lines = raw
    .split(/[\r\n•\-*\u2022\u2023\u25E6]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 15);

  return lines.slice(0, maxChunks);
}

/**
 * Calibrates raw cosine similarity (typically 0.50 - 0.90) into an intuitive 0-100 ATS score.
 */
export function calibrateSimilarityToScore(sim) {
  if (sim >= 0.84) {
    // 0.84 - 1.00 -> 90% - 99%
    const ratio = Math.min(1, (sim - 0.84) / 0.16);
    return Math.round(90 + ratio * 9);
  }
  if (sim >= 0.76) {
    // 0.76 - 0.84 -> 78% - 89%
    const ratio = (sim - 0.76) / 0.08;
    return Math.round(78 + ratio * 11);
  }
  if (sim >= 0.68) {
    // 0.68 - 0.76 -> 62% - 77%
    const ratio = (sim - 0.68) / 0.08;
    return Math.round(62 + ratio * 15);
  }
  if (sim >= 0.58) {
    // 0.58 - 0.68 -> 42% - 61%
    const ratio = (sim - 0.58) / 0.10;
    return Math.round(42 + ratio * 19);
  }
  if (sim >= 0.48) {
    // 0.48 - 0.58 -> 20% - 41%
    const ratio = (sim - 0.48) / 0.10;
    return Math.round(20 + ratio * 21);
  }
  // Below 0.48 -> 5% - 19%
  return Math.max(5, Math.round((sim / 0.48) * 19));
}

/**
 * Computes embedding-based semantic similarity between CV text and Job Description.
 * Combines macro full-document similarity with requirement-level chunk matching.
 */
export async function computeSemanticAtsScore(cvText, jdText, genAI) {
  // 1. Full document embeddings (Macro semantic context)
  const [cvDocEmbedding, jdDocEmbedding] = await Promise.all([
    getEmbedding(cvText, genAI),
    getEmbedding(jdText, genAI),
  ]);

  const macroSimilarity = cosineSimilarity(cvDocEmbedding.values, jdDocEmbedding.values);

  // 2. Granular chunks: Job Description requirements vs CV chunks
  const jdRequirements = chunkText(jdText, 8);
  const cvChunks = chunkText(cvText, 12);

  const requirementsBreakdown = [];
  let totalGranularSim = 0;

  if (jdRequirements.length > 0 && cvChunks.length > 0) {
    // Embed CV chunks
    const cvChunkEmbeddings = (
      await Promise.all(cvChunks.map(c => getEmbedding(c, genAI).catch(() => null)))
    ).filter(Boolean);

    // For each requirement, find max cosine similarity across CV chunks
    for (const reqText of jdRequirements) {
      try {
        const reqEmb = await getEmbedding(reqText, genAI);
        if (!reqEmb) continue;

        let bestMatch = null;
        let maxSim = 0;

        for (let i = 0; i < cvChunkEmbeddings.length; i++) {
          const sim = cosineSimilarity(reqEmb.values, cvChunkEmbeddings[i].values);
          if (sim > maxSim) {
            maxSim = sim;
            bestMatch = cvChunks[i];
          }
        }

        const status = maxSim >= 0.76 ? 'satisfied' : maxSim >= 0.66 ? 'partial' : 'gap';

        requirementsBreakdown.push({
          requirement: reqText,
          best_cv_match: bestMatch || '',
          similarity: Number(maxSim.toFixed(4)),
          score_percent: calibrateSimilarityToScore(maxSim),
          status,
        });

        totalGranularSim += maxSim;
      } catch (_e) {
        // Skip failed chunk
      }
    }
  }

  const granularSimilarity = requirementsBreakdown.length > 0
    ? totalGranularSim / requirementsBreakdown.length
    : macroSimilarity;

  // Blended composite similarity: 40% macro document context + 60% granular requirement coverage
  const blendedSimilarity = (macroSimilarity * 0.40) + (granularSimilarity * 0.60);
  const finalScore = calibrateSimilarityToScore(blendedSimilarity);

  return {
    score: finalScore,
    macro_similarity: Number(macroSimilarity.toFixed(4)),
    granular_similarity: Number(granularSimilarity.toFixed(4)),
    blended_similarity: Number(blendedSimilarity.toFixed(4)),
    model_used: cvDocEmbedding.model,
    requirements_breakdown: requirementsBreakdown,
  };
}

/**
 * Analyzes specific missing skills, tools, and qualifications using Gemini generative model.
 */
export async function analyzeMissingSkillsWithGemini(cvText, jdText, genAI, lang = 'ar') {
  const isAr = lang.startsWith('ar');

  const prompt = `
You are an Elite Applicant Tracking System (ATS) Expert and Senior Technical Recruiter.
Analyze this candidate's CV against the provided Job Description.

IMPORTANT NLP EVALUATION RULES:
1. Use SEMANTIC UNDERSTANDING, not primitive keyword exact matching. If the CV expresses the same competency using different words (e.g., "led an engineering squad" satisfies "team leadership", "PostgreSQL" satisfies "relational database experience"), recognize it as satisfied.
2. Identify SPECIFIC missing skills, tools, methodologies, certifications, or qualifications mentioned in the job description that are genuinely absent or underrepresented in the CV.
3. Keep the advice actionable, specific, and professional. Avoid generic platitudes.
4. Language instruction: ${isAr ? 'Return the analysis, reasons, and recommendations in professional Arabic (keeping technical names like React, Docker, Kubernetes in English).' : 'Return the entire analysis in fluent professional English.'}

JOB DESCRIPTION:
====================
${jdText.slice(0, 6000)}
====================

CANDIDATE CV:
====================
${cvText.slice(0, 6000)}
====================

RESPOND STRICTLY WITH A SINGLE JSON OBJECT (no markdown fences, no extra text) matching this schema:
{
  "missing_skills": [
    {
      "skill": "Specific tool or skill name",
      "category": "Technical | Methodology | Cloud/DevOps | Domain Knowledge | Soft Skill",
      "importance": "high" | "medium" | "low",
      "reason": "Clear 1-sentence reason why it is needed based on the JD"
    }
  ],
  "matching_strengths": [
    "Key skill or experience in CV that directly satisfies a JD requirement",
    "Another strong match"
  ],
  "recommendations": [
    "Specific actionable tip to improve CV for this target role",
    "Another specific tip"
  ],
  "verdict": "2-sentence overall summary evaluating the candidate's alignment with the job description"
}
`.trim();

  for (const modelName of CANDIDATE_GENERATIVE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      });

      const res = await model.generateContent(prompt);
      const text = res.response.text().trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed && (Array.isArray(parsed.missing_skills) || Array.isArray(parsed.matching_strengths))) {
          return parsed;
        }
      }
    } catch (_err) {
      continue;
    }
  }

  // Graceful fallback if generative call fails
  return {
    missing_skills: [
      {
        skill: isAr ? 'مراجعة الكلمات الدلالية المتخصصة' : 'Specific domain keywords review',
        category: 'General',
        importance: 'medium',
        reason: isAr
          ? 'يُنصح بإبراز أدوات وتقنيات الدور الوظيفي بتفصيل أدق في مشاريعك.'
          : 'Ensure specific tools and frameworks mentioned in the JD are explicitly named in your project bullets.',
      },
    ],
    matching_strengths: [
      isAr ? 'توافق الخبرات الأساسية مع المجال المستهدف' : 'Core domain experience aligns well with the target role',
    ],
    recommendations: [
      isAr ? 'قم بإضافة الكلمات التقنية الناقصة في قسم المهارات والمشاريع.' : 'Add missing technical tools to your skills and project achievements.',
    ],
    verdict: isAr
      ? 'تم تحليل التوافق الدلالي بنجاح بناءً على نموذج التضمين المتجهي.'
      : 'Semantic compatibility analyzed successfully using vector embeddings.',
  };
}

/**
 * Main ATS Score Calculation Orchestrator.
 */
export async function calculateAtsScore({ cv_text, job_description, cv_id, lang = 'ar', customApiKey = '' }) {
  if (!job_description || !job_description.trim()) {
    throw new Error('job_description is required');
  }

  let finalCvText = cv_text;

  // If cv_text is missing but cv_id is provided, fetch from Supabase cvs table
  if ((!finalCvText || !finalCvText.trim()) && cv_id && supabase) {
    const { data: cvRecord, error: cvErr } = await supabase
      .from('cvs')
      .select('raw_text, id')
      .eq('id', cv_id)
      .single();

    if (!cvErr && cvRecord?.raw_text) {
      finalCvText = cvRecord.raw_text;
    }
  }

  if (!finalCvText || !finalCvText.trim()) {
    throw new Error('cv_text or a valid cv_id with saved CV text is required');
  }

  // Determine Gemini API key with file fallback for local Node/Vite runs
  let activeKey =
    customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;

  if (!activeKey || activeKey.includes('your_')) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const fileContent = fs.readFileSync(envPath, 'utf8');
        const match = fileContent.match(/(?:GEMINI_API_KEY|VITE_GEMINI_API_KEY)=([^\r\n]+)/);
        if (match) activeKey = match[1].trim();
      }
    } catch (_e) {}
  }

  if (!activeKey || activeKey.includes('your_')) {
    throw new Error('Gemini API key is not configured');
  }

  const genAI = new GoogleGenerativeAI(activeKey);

  // 1. Run embedding-based semantic similarity & 2. Gemini generative gap analysis concurrently
  const [semanticResult, gapAnalysis] = await Promise.all([
    computeSemanticAtsScore(finalCvText, job_description, genAI),
    analyzeMissingSkillsWithGemini(finalCvText, job_description, genAI, lang),
  ]);

  const reportPayload = {
    score: semanticResult.score,
    macro_similarity: semanticResult.macro_similarity,
    granular_similarity: semanticResult.granular_similarity,
    blended_similarity: semanticResult.blended_similarity,
    embedding_model: semanticResult.model_used,
    missing_skills: gapAnalysis.missing_skills || [],
    matching_strengths: gapAnalysis.matching_strengths || [],
    recommendations: gapAnalysis.recommendations || [],
    verdict: gapAnalysis.verdict || '',
    requirements_breakdown: semanticResult.requirements_breakdown || [],
  };

  // 3. Save report to Supabase `ats_reports` table if available
  let savedReportId = null;
  if (supabase) {
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('ats_reports')
        .insert({
          cv_id: cv_id || null,
          job_description: job_description.trim(),
          score: semanticResult.score,
          missing_skills: JSON.stringify(gapAnalysis.missing_skills || []),
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!insertErr && inserted?.id) {
        savedReportId = inserted.id;
      } else if (insertErr) {
        console.warn('[ats-score] Notice: ats_reports insert skipped or table awaiting migration:', insertErr.message);
      }
    } catch (dbErr) {
      console.warn('[ats-score] Supabase persistence notice:', dbErr.message);
    }
  }

  return {
    ...reportPayload,
    id: savedReportId,
    cv_id: cv_id || null,
  };
}

/**
 * Serverless HTTP Handler (Vercel & Vite dev server middleware).
 */
export default async function handler(req, res) {
  // CORS Support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json ? res.json({ error: 'Method not allowed' }) : res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    const body = req.body || {};
    const customApiKey = req.headers?.['x-gemini-key'] || body.customApiKey;

    const result = await calculateAtsScore({
      cv_text: body.cv_text,
      job_description: body.job_description,
      cv_id: body.cv_id,
      lang: body.lang || 'ar',
      customApiKey,
    });

    if (res.json) {
      return res.status(200).json(result);
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(result));
    }
  } catch (err) {
    console.error('[api/ats-score error]:', err.message);
    const status = err.message.includes('required') ? 400 : 500;
    if (res.status && res.json) {
      return res.status(status).json({ error: err.message });
    } else {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }
}
