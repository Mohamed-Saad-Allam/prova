import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullseye,
  faCircleCheck,
  faTriangleExclamation,
  faWandMagicSparkles,
  faArrowRight,
  faArrowLeft,
  faFileLines,
  faLightbulb,
  faCheck,
  faRotateRight,
  faPenToSquare,
  faChevronDown,
  faChevronUp,
  faBrain,
  faGraduationCap,
  faCopy,
  faMagnifyingGlassChart,
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/layout/Header';
import { checkAtsMatch, loadAtsReports, SAMPLE_JOB_DESCRIPTIONS } from '../lib/ats';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] },
  }),
};

export default function AtsScore({ user }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language || 'ar';
  const isRtl = lang.startsWith('ar');
  const forwardArrow = isRtl ? faArrowLeft : faArrowRight;

  // State
  const [cvRecord, setCvRecord] = useState(null);
  const [cvParsed, setCvParsed] = useState(null);
  const [customCvText, setCustomCvText] = useState('');
  const [showCvEditor, setShowCvEditor] = useState(false);

  const [jobDescription, setJobDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [result, setResult] = useState(null);

  const [showNlpDetails, setShowNlpDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('gaps'); // 'gaps' | 'requirements' | 'strengths' | 'tips'
  const [history, setHistory] = useState([]);

  // Helper: Format raw JSON CV into human-readable text
  const formatCvForDisplay = (raw) => {
    if (!raw) return '';
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        const data = JSON.parse(raw);
        const lines = [];
        if (data.name) lines.push(`Candidate: ${data.name}`);
        if (data.jobTitle) lines.push(`Target Role: ${data.jobTitle}`);
        if (data.careerObjective) lines.push(`Summary: ${data.careerObjective}`);
        if (data.technicalSkills) lines.push(`Technical Skills: ${data.technicalSkills}`);
        if (data.methodologies) lines.push(`Methodologies: ${data.methodologies}`);
        if (data.coreCompetencies) lines.push(`Core Competencies: ${data.coreCompetencies}`);
        if (Array.isArray(data.careerHistory)) {
          lines.push('\nWork Experience:');
          data.careerHistory.forEach((h) => {
            lines.push(`- ${h.title || ''} at ${h.company || ''} (${h.dates || ''})`);
            if (Array.isArray(h.duties)) {
              h.duties.forEach((d) => lines.push(`  * ${d}`));
            } else if (h.duties) {
              lines.push(`  * ${h.duties}`);
            }
          });
        }
        if (Array.isArray(data.projectsCertifications)) {
          lines.push('\nKey Projects & Certifications:');
          data.projectsCertifications.forEach((p) => {
            lines.push(`- ${p.title || ''} (${p.issuer || ''}): ${p.detail || ''}`);
          });
        }
        return lines.join('\n');
      } catch (_e) {}
    }
    return String(raw);
  };

  // 1. Fetch user's latest CV
  useEffect(() => {
    if (!user) return;
    const fetchCv = async () => {
      try {
        const { data, error } = await supabase
          .from('cvs')
          .select('id, raw_text, formatted_html, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setCvRecord(data);
          setCustomCvText(formatCvForDisplay(data.raw_text));
          if (data.raw_text && data.raw_text.trim().startsWith('{')) {
            try {
              setCvParsed(JSON.parse(data.raw_text));
            } catch (_e) {}
          }
        }
      } catch (_e) {}
    };

    fetchCv();
  }, [user]);

  // 2. Fetch past ATS reports
  useEffect(() => {
    if (!cvRecord?.id) return;
    loadAtsReports(cvRecord.id).then((reports) => {
      setHistory(reports);
    });
  }, [cvRecord?.id]);

  // Handle Match Analysis
  const handleCheckMatch = async () => {
    if (!jobDescription.trim()) {
      toast.error(isRtl ? 'يرجى كتابة أو لصق الوصف الوظيفي أولاً' : 'Please paste a job description first');
      return;
    }

    const textToAnalyze = customCvText.trim() || cvRecord?.raw_text;

    if (!textToAnalyze && !cvRecord?.id) {
      toast.error(isRtl ? 'يرجى كتابة أو اختيار سيرة ذاتية أولاً' : 'Please provide CV text first.');
      return;
    }

    setAnalyzing(true);
    setResult(null);

    // Dynamic Step Indicators
    setAnalysisStep(
      isRtl
        ? 'جاري تحويل النصوص إلى متجهات رقمية دلالية (Gemini Embeddings)...'
        : 'Generating high-dimensional semantic vector embeddings...'
    );

    const stepTimer1 = setTimeout(() => {
      setAnalysisStep(
        isRtl
          ? 'حساب معامل التشابه الجيبي (Cosine Similarity) في الفضاء المتجهي...'
          : 'Computing vector cosine similarity in semantic space...'
      );
    }, 1500);

    const stepTimer2 = setTimeout(() => {
      setAnalysisStep(
        isRtl
          ? 'استخراج فجوات المهارات والتحليل التفصيلي بالذكاء الاصطناعي...'
          : 'Analyzing skill gaps and actionable recommendations...'
      );
    }, 3200);

    try {
      const matchResult = await checkAtsMatch({
        cvText: textToAnalyze,
        jobDescription,
        cvId: cvRecord?.id,
        lang,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setResult(matchResult);

      // Refresh history
      if (cvRecord?.id) {
        loadAtsReports(cvRecord.id).then(setHistory);
      }

      toast.success(
        isRtl
          ? `تم حساب التوافق الدلالي بنجاح: ${matchResult.score}%`
          : `Semantic ATS Match calculated: ${matchResult.score}%`
      );

      // Smooth scroll to results
      setTimeout(() => {
        document.getElementById('ats-results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    } catch (err) {
      console.error('ATS check failed:', err);
      toast.error(err.message || (isRtl ? 'حدث خطأ أثناء فحص التوافق' : 'Failed to calculate ATS score'));
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Color & Badge helpers
  const getScoreColor = (score) => {
    if (score >= 80) return '#10B981'; // Emerald
    if (score >= 65) return 'var(--c-coral)'; // Coral
    if (score >= 50) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return isRtl ? 'توافق دلالي ممتاز (Strong Fit)' : 'Excellent Semantic Match';
    if (score >= 70) return isRtl ? 'توافق جيد جداً مع بعض الفجوات' : 'Good Match with minor gaps';
    if (score >= 55) return isRtl ? 'توافق متوسط يحتاج تطوير' : 'Moderate Match — needs tailoring';
    return isRtl ? 'فجوة دلالية واضحة عن متطلبات الوظيفة' : 'Low Match — significant gaps';
  };

  const candidateName = cvParsed?.name || user?.user_metadata?.full_name || (isRtl ? 'المرشح' : 'Candidate');
  const candidateTitle = cvParsed?.jobTitle || (isRtl ? 'المسمى المهني المسجل' : 'Registered Title');

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} />

      <main style={{ flex: 1, padding: '2rem 1.5rem 5rem', maxWidth: 1040, margin: '0 auto', width: '100%' }}>
        {/* ── Breadcrumb & Navigation ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <button
            onClick={() => navigate('/services')}
            className="btn btn-ghost"
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              gap: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <FontAwesomeIcon icon={isRtl ? faArrowRight : faArrowLeft} />
            <span>{isRtl ? 'العودة لخدمات Prova' : 'Back to Services'}</span>
          </button>

          <Link
            to="/cv-editor"
            className="btn btn-ghost"
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              gap: '0.4rem',
              color: 'var(--c-coral)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
            <span>{isRtl ? 'تعديل السيرة الذاتية' : 'Edit Resume'}</span>
          </Link>
        </div>

        {/* ── Hero Title & NLP Introduction ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(135deg, rgba(232,130,90,0.09) 0%, rgba(27,42,65,0.04) 100%)',
            border: '1px solid rgba(232,130,90,0.25)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            marginBottom: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Subtle Ambient Radial Highlight */}
          <div
            style={{
              position: 'absolute',
              top: '-30%',
              insetInlineEnd: '-10%',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,130,90,0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--c-coral-dark)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <FontAwesomeIcon icon={faBrain} />
                <span>{isRtl ? 'ذكاء اصطناعي دلالي (NLP Embeddings)' : 'Semantic AI Embeddings'}</span>
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {isRtl ? 'أبعد من الكلمات الحرفية' : 'Beyond Literal Keywords'}
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(1.6rem, 3.8vw, 2.2rem)', fontWeight: 800, margin: '0.2rem 0 0.6rem' }}>
              {isRtl ? 'فحص توافق ATS بالتشابه الدلالي' : 'ATS Semantic Match Score'}
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', margin: 0, maxWidth: 760, lineHeight: 1.6 }}>
              {isRtl
                ? 'قارن سيرتك الذاتية بأي وصف وظيفي باستخدام متجهات Gemini الرقمية (3072-Dimensional Embeddings). يفهم النظام المعنى والمفاهيم المشتركة (مثل: "قيادة فريق هندسي" تطابق "Team Leadership") وليس مجرد تطابق الكلمات الحرفي.'
                : 'Compare your CV against target job descriptions using Gemini vector embeddings (3,072-dimensional semantic representations). The engine understands conceptual equivalence beyond literal regex matching.'}
            </p>
          </div>
        </motion.div>

        {/* ── Active CV Context Bar ── */}
        <div
          className="card"
          style={{
            padding: '1.1rem 1.5rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(232,130,90,0.12)',
                color: 'var(--c-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.15rem',
              }}
            >
              <FontAwesomeIcon icon={faFileLines} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {isRtl ? 'السيرة الذاتية المفحوصة:' : 'Current Active CV:'}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: '0.75rem' }} />
                  {isRtl ? 'متزامنة وجاهزة' : 'Synced'}
                </span>
              </div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0.1rem 0 0', color: 'var(--text-primary)' }}>
                {candidateName} — <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{candidateTitle}</span>
              </h4>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowCvEditor(!showCvEditor)}
              className="btn btn-ghost"
              style={{
                fontSize: '0.82rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: showCvEditor ? 'rgba(232, 130, 90, 0.12)' : 'var(--bg-subtle)',
                color: showCvEditor ? 'var(--c-coral-dark)' : 'var(--text-primary)',
                fontWeight: 700,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <FontAwesomeIcon icon={showCvEditor ? faChevronUp : faChevronDown} />
              <span>{isRtl ? (showCvEditor ? 'إخفاء نص الـ CV' : 'معاينة / تعديل نص السيرة') : (showCvEditor ? 'Hide CV Text' : 'View / Edit CV Text')}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/cv-editor')}
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-md)' }}
            >
              <FontAwesomeIcon icon={faPenToSquare} />
              <span>{isRtl ? 'المحرر الكامل' : 'Full CV Editor'}</span>
            </button>
          </div>
        </div>

        {/* ── Expandable CV Text Editor / Preview ── */}
        <AnimatePresence>
          {showCvEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              style={{ overflow: 'hidden', marginBottom: '2rem' }}
            >
              <div
                className="card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid rgba(232, 130, 90, 0.3)',
                  background: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faPenToSquare} style={{ color: 'var(--c-coral)' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {isRtl ? 'نص السيرة الذاتية المستخدم في الفحص الدلالي:' : 'CV Text Fed Into Semantic Embedding Model:'}
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {isRtl ? 'يمكنك تعديل أي بند هنا واختبار النتيجة فوراً' : 'You can adjust any line here to simulate improvements'}
                  </span>
                </div>

                <textarea
                  rows={6}
                  value={customCvText}
                  onChange={(e) => setCustomCvText(e.target.value)}
                  placeholder={isRtl ? 'اكتب أو الصق نص سيرتك الذاتية هنا...' : 'Type or paste CV text here...'}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '0.86rem',
                    lineHeight: 1.55,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Job Description Input Card ── */}
        <motion.div
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="card card-elevated"
          style={{
            padding: '1.75rem',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            marginBottom: '2.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isRtl ? 'أدخل الوصف الوظيفي المستهدف (Job Description)' : 'Target Job Description'}
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                {isRtl
                  ? 'انسخ والصق نص الإعلان الوظيفي أو اختر نموذجاً تجريبياً جاهزاً بنقرة واحدة.'
                  : 'Paste the job posting text or click any pre-filled benchmark sample.'}
              </p>
            </div>

            {jobDescription && (
              <button
                onClick={() => setJobDescription('')}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', color: '#EF4444', padding: '0.35rem 0.7rem' }}
              >
                <FontAwesomeIcon icon={faRotateRight} />
                <span>{isRtl ? 'مسح النص' : 'Clear Text'}</span>
              </button>
            )}
          </div>

          {/* Quick Benchmark Preset Pills */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {isRtl ? 'نماذج وظائف جاهزة للتجربة الفورية:' : 'Quick Benchmark Samples (1-Click):'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {SAMPLE_JOB_DESCRIPTIONS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setJobDescription(preset.text);
                    toast.success(isRtl ? `تم اختيار: ${preset.titleAr}` : `Selected: ${preset.titleEn}`);
                  }}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                    fontWeight: 700,
                  }}
                >
                  <FontAwesomeIcon icon={faBullseye} style={{ color: 'var(--c-coral)', fontSize: '0.75rem' }} />
                  <span>{isRtl ? preset.titleAr : preset.titleEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <textarea
              rows={8}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder={
                isRtl
                  ? 'الصق نص الوصف الوظيفي هنا (المسؤوليات، المهارات المطلوبة، سنوات الخبرة، التقنيات)...'
                  : 'Paste the target job description here (responsibilities, required skills, tools, methodologies)...'
              }
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                borderRadius: 'var(--radius-lg)',
                border: '1.5px solid var(--border-default)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--c-coral)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>{isRtl ? 'يدعم اللغتين العربية والإنجليزية بطلاقة' : 'Supports Arabic & English natively'}</span>
              <span>{jobDescription.length} {isRtl ? 'حرف' : 'chars'}</span>
            </div>
          </div>

          {/* Action Button & Loading Indicator */}
          <div>
            <button
              onClick={handleCheckMatch}
              disabled={analyzing || !jobDescription.trim()}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.95rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 800,
                borderRadius: 'var(--radius-lg)',
                justifyContent: 'center',
                boxShadow: analyzing ? 'none' : 'var(--shadow-coral)',
                opacity: analyzing || !jobDescription.trim() ? 0.75 : 1,
                cursor: analyzing || !jobDescription.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {analyzing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      border: '2.5px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>{isRtl ? 'جاري الفحص بالذكاء الدلالي...' : 'Calculating Semantic Embeddings...'}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  <span>{isRtl ? 'فحص التوافق بالذكاء الدلالي (Check Match)' : 'Check Semantic Match'}</span>
                  <FontAwesomeIcon icon={forwardArrow} style={{ fontSize: '0.85rem' }} />
                </div>
              )}
            </button>

            {analyzing && analysisStep && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '0.85rem',
                  textAlign: 'center',
                  fontSize: '0.84rem',
                  color: 'var(--c-coral-dark)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <FontAwesomeIcon icon={faBrain} />
                <span>{analysisStep}</span>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── Results Section ── */}
        <AnimatePresence>
          {result && (
            <motion.div
              id="ats-results-section"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ marginBottom: '3rem' }}
            >
              {/* 1. Score Showcase Hero Card */}
              <div
                className="card card-elevated"
                style={{
                  padding: '2rem',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  marginBottom: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '2rem',
                }}
              >
                {/* Score Details */}
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        background: `${getScoreColor(result.score)}18`,
                        color: getScoreColor(result.score),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <FontAwesomeIcon icon={faBullseye} />
                      <span>{getScoreLabel(result.score)}</span>
                    </span>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {result.embedding_model || 'gemini-embedding-2'}
                    </span>
                  </div>

                  <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0.3rem 0', color: 'var(--text-primary)' }}>
                    {isRtl ? 'درجة التوافق الدلالي:' : 'Semantic Match Score:'}{' '}
                    <span style={{ color: getScoreColor(result.score) }}>{result.score}%</span>
                  </h2>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0.4rem 0 1rem' }}>
                    {result.verdict || (isRtl
                      ? 'تم تحليل السيرة الذاتية مقابل الوصف الوظيفي بناءً على الفضاء المتجهي المشترك.'
                      : 'Evaluated candidate CV against job requirements in unified semantic vector space.')}
                  </p>

                  {/* Mathematical Metric Badges */}
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>Cosine Sim: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{result.macro_similarity || result.blended_similarity}</strong>
                    </div>

                    <div
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>Vector Dim: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>3,072-D</strong>
                    </div>

                    <div
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>{isRtl ? 'فجوات المهارات: ' : 'Skill Gaps: '}</span>
                      <strong style={{ color: result.missing_skills?.length > 0 ? '#EF4444' : '#10B981' }}>
                        {result.missing_skills?.length || 0}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Animated Circular Progress Gauge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: 140, height: 140 }}>
                    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
                      {/* Track */}
                      <circle
                        cx="70"
                        cy="70"
                        r="58"
                        stroke="var(--border-subtle)"
                        strokeWidth="11"
                        fill="transparent"
                      />
                      {/* Animated Indicator */}
                      <motion.circle
                        cx="70"
                        cy="70"
                        r="58"
                        stroke={getScoreColor(result.score)}
                        strokeWidth="11"
                        strokeDasharray={2 * Math.PI * 58}
                        initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                        animate={{ strokeDashoffset: (2 * Math.PI * 58) * (1 - result.score / 100) }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {result.score}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        / 100
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Academic NLP Theory Explainer Card (Toggleable) */}
              <div
                className="card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid rgba(232, 130, 90, 0.25)',
                  background: 'linear-gradient(135deg, rgba(232, 130, 90, 0.05) 0%, rgba(27, 42, 65, 0.03) 100%)',
                  marginBottom: '1.75rem',
                }}
              >
                <div
                  onClick={() => setShowNlpDetails(!showNlpDetails)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(232, 130, 90, 0.15)',
                        color: 'var(--c-coral-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                      }}
                    >
                      <FontAwesomeIcon icon={faGraduationCap} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        {isRtl ? 'الأساس الأكاديمي والرياضي للـ ATS Score (NLP Concepts)' : 'Academic NLP & Vector Foundations'}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                        {isRtl ? 'كيف يعمل تمثيل النصوص كمتجهات والتشابه الجيبي بدلاً من مطابقة الكلمات العادية؟' : 'How dense vector embeddings and cosine similarity replace keyword matching'}
                      </p>
                    </div>
                  </div>

                  <FontAwesomeIcon icon={showNlpDetails ? faChevronUp : faChevronDown} style={{ color: 'var(--text-muted)' }} />
                </div>

                <AnimatePresence>
                  {showNlpDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: 'hidden', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                          <h5 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--c-coral-dark)', marginBottom: '0.4rem' }}>
                            1. {isRtl ? 'المتجهات الرقمية الدلالية (Text Embeddings)' : 'Dense Semantic Embeddings'}
                          </h5>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            {isRtl
                              ? 'يتم تحويل نصوص السيرة الذاتية والوصف الوظيفي إلى متجهات رقمية عالية الأبعاد (3072 بُعداً بواسطة نموذج Gemini Embedding 2). هذا التمثيل يضع الكلمات المتقاربة دلالياً في نفس المنطقة الهندسية.'
                              : 'CV and JD texts are projected into a 3,072-dimensional continuous latent space via Gemini Embedding 2, capturing contextual relationships beyond syntax.'}
                          </p>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                          <h5 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10B981', marginBottom: '0.4rem' }}>
                            2. {isRtl ? 'معامل التشابه الجيبي (Cosine Similarity)' : 'Cosine Metric Function'}
                          </h5>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            {isRtl
                              ? 'يتم قياس الزاوية بين متجه السيرة الذاتية u ومتجه الوصف الوظيفي v وفق المعادلة: cos(θ) = (u · v) / (||u|| ||v||). هذا المعامل يتجاهل طول المستند ويركز بحتة على تطابق الاتجاه المعنوي.'
                              : 'Normalized inner dot-product cos(θ) = (u · v) / (||u|| ||v||) measures angular proximity irrespective of length, yielding reliable semantic distance.'}
                          </p>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                          <h5 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--c-navy)', marginBottom: '0.4rem' }}>
                            3. {isRtl ? 'الفارق بين التضمين ومطابقة الكلمات (Keywords)' : 'Embeddings vs Keyword Search'}
                          </h5>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            {isRtl
                              ? 'في المطابقة الحرفية: "led a team" لا تطابق "team leadership" (النتيجة = 0%). بينما في الـ Embeddings كلاهما ينتج متجهات متقاربة جداً بزاوية تشابه تفوق 0.82، مما يحقق تقييماً عادلاً ودقيقاً.'
                              : 'Keyword filters fail when synonymy or morphological variations occur ("managed squads" vs "team lead"). Vector embeddings capture latent synonymy seamlessly.'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 3. Detailed Tabs Navigation */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  borderBottom: '1.5px solid var(--border-subtle)',
                  paddingBottom: '0.5rem',
                  marginBottom: '1.5rem',
                  overflowX: 'auto',
                }}
              >
                <button
                  onClick={() => setActiveTab('gaps')}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.55rem 1rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-md)',
                    color: activeTab === 'gaps' ? '#EF4444' : 'var(--text-secondary)',
                    background: activeTab === 'gaps' ? 'rgba(239, 68, 68, 0.10)' : 'transparent',
                    border: activeTab === 'gaps' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid transparent',
                  }}
                >
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  <span>
                    {isRtl ? 'المهارات الناقصة' : 'Missing Skills'} ({result.missing_skills?.length || 0})
                  </span>
                </button>

                {result.requirements_breakdown?.length > 0 && (
                  <button
                    onClick={() => setActiveTab('requirements')}
                    className="btn btn-ghost"
                    style={{
                      padding: '0.55rem 1rem',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      borderRadius: 'var(--radius-md)',
                      color: activeTab === 'requirements' ? 'var(--c-coral-dark)' : 'var(--text-secondary)',
                      background: activeTab === 'requirements' ? 'rgba(232, 130, 90, 0.10)' : 'transparent',
                      border: activeTab === 'requirements' ? '1px solid rgba(232, 130, 90, 0.25)' : '1px solid transparent',
                    }}
                  >
                    <FontAwesomeIcon icon={faMagnifyingGlassChart} />
                    <span>
                      {isRtl ? 'تحليل المتطلبات الحبيبي' : 'Requirement Breakdown'} ({result.requirements_breakdown.length})
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('strengths')}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.55rem 1rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-md)',
                    color: activeTab === 'strengths' ? '#10B981' : 'var(--text-secondary)',
                    background: activeTab === 'strengths' ? 'rgba(16, 185, 129, 0.10)' : 'transparent',
                    border: activeTab === 'strengths' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid transparent',
                  }}
                >
                  <FontAwesomeIcon icon={faCircleCheck} />
                  <span>
                    {isRtl ? 'نقاط القوة المتطابقة' : 'Matching Strengths'} ({result.matching_strengths?.length || 0})
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('tips')}
                  className="btn btn-ghost"
                  style={{
                    padding: '0.55rem 1rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-md)',
                    color: activeTab === 'tips' ? '#8B5CF6' : 'var(--text-secondary)',
                    background: activeTab === 'tips' ? 'rgba(139, 92, 246, 0.10)' : 'transparent',
                    border: activeTab === 'tips' ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid transparent',
                  }}
                >
                  <FontAwesomeIcon icon={faLightbulb} />
                  <span>{isRtl ? 'توصيات التحسين' : 'Actionable Recommendations'}</span>
                </button>
              </div>

              {/* 4. Tab Content */}
              <div>
                {/* ── Tab: Missing Skills / Gaps ── */}
                {activeTab === 'gaps' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {result.missing_skills && result.missing_skills.length > 0 ? (
                      result.missing_skills.map((gap, i) => (
                        <div
                          key={i}
                          className="card"
                          style={{
                            padding: '1.25rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            background: 'var(--bg-surface)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: 'var(--radius-full)',
                                  background: gap.importance === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: gap.importance === 'high' ? '#EF4444' : '#D97706',
                                }}
                              >
                                {gap.importance === 'high'
                                  ? (isRtl ? 'أولوية عالية' : 'High Priority')
                                  : (isRtl ? 'أولوية متوسطة' : 'Medium Priority')}
                              </span>

                              {gap.category && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  • {gap.category}
                                </span>
                              )}
                            </div>

                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.3rem', color: 'var(--text-primary)' }}>
                              {gap.skill}
                            </h4>

                            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                              {gap.reason}
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(gap.skill);
                              toast.success(isRtl ? `تم نسخ "${gap.skill}"` : `Copied "${gap.skill}"`);
                            }}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)' }}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                            <span>{isRtl ? 'نسخ' : 'Copy'}</span>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10B981', fontSize: '2rem', marginBottom: '0.5rem' }} />
                        <h4 style={{ fontWeight: 800, margin: 0 }}>
                          {isRtl ? 'لا توجد فجوات مهارات رئيسية!' : 'No major skill gaps detected!'}
                        </h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.4rem 0 0' }}>
                          {isRtl ? 'سيرتك الذاتية تغطي كافة متطلبات الوظيفة الأساسية بكفاءة.' : 'Your resume adequately reflects the core requirements of this role.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Granular Requirement Breakdown ── */}
                {activeTab === 'requirements' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {result.requirements_breakdown?.map((item, i) => (
                      <div
                        key={i}
                        className="card"
                        style={{
                          padding: '1.25rem',
                          borderRadius: 'var(--radius-lg)',
                          border: `1px solid ${
                            item.status === 'satisfied'
                              ? 'rgba(16, 185, 129, 0.25)'
                              : item.status === 'partial'
                              ? 'rgba(245, 158, 11, 0.25)'
                              : 'rgba(239, 68, 68, 0.25)'
                          }`,
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                            {isRtl ? `متطلب رقم ${i + 1}` : `Requirement #${i + 1}`}
                          </span>

                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background:
                                item.status === 'satisfied'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : item.status === 'partial'
                                  ? 'rgba(245, 158, 11, 0.12)'
                                  : 'rgba(239, 68, 68, 0.12)',
                              color:
                                item.status === 'satisfied'
                                  ? '#10B981'
                                  : item.status === 'partial'
                                  ? '#D97706'
                                  : '#EF4444',
                            }}
                          >
                            {item.status === 'satisfied'
                              ? (isRtl ? 'مستوفى بالكامل' : 'Satisfied')
                              : item.status === 'partial'
                              ? (isRtl ? 'مستوفى جزئياً' : 'Partially Satisfied')
                              : (isRtl ? 'غير متوفر في الـ CV' : 'Not Found in CV')} ({item.score_percent}%)
                          </span>
                        </div>

                        <h5 style={{ fontSize: '0.94rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                          {item.requirement}
                        </h5>

                        {item.best_cv_match ? (
                          <div
                            style={{
                              background: 'var(--bg-base)',
                              padding: '0.65rem 0.85rem',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.82rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                              {isRtl ? 'أقرب نص دلالي في سيرتك الذاتية:' : 'Closest semantic match in your CV:'}
                            </span>
                            "{item.best_cv_match}"
                            <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--c-coral-dark)', fontWeight: 700 }}>
                              Cosine Sim: {item.similarity}
                            </span>
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.8rem', color: '#EF4444', margin: 0 }}>
                            {isRtl ? 'لم يتم العثور على خبرة متطابقة في سيرتك الذاتية.' : 'No corresponding experience was identified in your resume.'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Tab: Matching Strengths ── */}
                {activeTab === 'strengths' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {result.matching_strengths?.map((str, i) => (
                      <div
                        key={i}
                        className="card"
                        style={{
                          padding: '1.1rem 1.35rem',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          background: 'rgba(16, 185, 129, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                        }}
                      >
                        <FontAwesomeIcon icon={faCheck} style={{ color: '#10B981', fontSize: '1.1rem', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {str}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Tab: Recommendations ── */}
                {activeTab === 'tips' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {result.recommendations?.map((tip, i) => (
                      <div
                        key={i}
                        className="card"
                        style={{
                          padding: '1.25rem',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid rgba(139, 92, 246, 0.25)',
                          background: 'var(--bg-surface)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.85rem',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#8B5CF6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </div>
                        <div>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, margin: 0, lineHeight: 1.55 }}>
                            {tip}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Direct Next Steps CTA Bar */}
              <div
                style={{
                  marginTop: '2rem',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-xl)',
                  background: 'linear-gradient(135deg, var(--c-navy) 0%, var(--c-navy-dark) 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.25rem', color: '#fff' }}>
                    {isRtl ? 'ارفع درجة توافق سيرتك الذاتية الآن' : 'Boost your ATS match score now'}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                    {isRtl
                      ? 'أضف المهارات الناقصة في قسم الخبرات والمشاريع، ثم أعد الفحص.'
                      : 'Incorporate missing competencies into your resume bullet points and re-check.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate('/cv-editor')}
                    className="btn"
                    style={{
                      background: 'var(--c-coral)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 800,
                      padding: '0.65rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                    <span>{isRtl ? 'تعديل السيرة الذاتية' : 'Edit Resume'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/services')}
                    className="btn btn-ghost"
                    style={{
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      fontWeight: 700,
                      padding: '0.65rem 1.1rem',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span>{isRtl ? 'الخدمات الأخرى' : 'Other Services'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Past ATS Checks History ── */}
        {history && history.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {isRtl ? 'سجل الفحوصات السابقة لهذا الـ CV' : 'Past ATS Scans History'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.slice(0, 5).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="card"
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: `${getScoreColor(item.score)}15`,
                        color: getScoreColor(item.score),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                      }}
                    >
                      {item.score}%
                    </div>
                    <div>
                      <p style={{ fontSize: '0.86rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {item.job_description ? item.job_description.slice(0, 80) + '...' : (isRtl ? 'فحص وصف وظيفي' : 'Job Description Scan')}
                      </p>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (item.full_report) {
                        setResult(item.full_report);
                        document.getElementById('ats-results-section')?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        setJobDescription(item.job_description || '');
                        toast.success(isRtl ? 'تم تحميل نص الوصف الوظيفي' : 'Job description loaded into editor');
                      }
                    }}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)' }}
                  >
                    <span>{isRtl ? 'استعراض' : 'View'}</span>
                    <FontAwesomeIcon icon={forwardArrow} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
