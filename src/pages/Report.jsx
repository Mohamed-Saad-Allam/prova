import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faLightbulb,
  faPenToSquare,
  faRotateRight,
  faShareNodes,
  faPlay,
  faPrint,
  faGraduationCap,
  faBrain,
  faComments,
  faShieldHalved,
  faBriefcase,
  faCalendarDays,
  faChartPie,
  faTriangleExclamation,
  faCheckDouble,
  faArrowRight,
  faCopy,
  faCheck,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';
import { generateReport } from '../lib/llm';
import Header from '../components/layout/Header';
import toast from 'react-hot-toast';
import logoImg from '../assets/logo.png';

/* ── Animated Score Ring ── */
function ScoreRing({ score }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const step = Math.max(1, score / 40);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplayScore(Math.round(current));
      if (current >= score) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [score]);

  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const color = score >= 80 ? '#48BB78' : score >= 65 ? 'var(--c-coral)' : '#E53E3E';

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={11} />
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.05s, stroke 0.3s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 900, color, lineHeight: 1 }}>{displayScore}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>/ 100</span>
      </div>
    </div>
  );
}

export default function Report({ user }) {
  const { t, i18n } = useTranslation();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const [interviewId, setInterviewId] = useState(paramId || null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noInterviews, setNoInterviews] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'errors' | 'cv_gaps' | 'roadmap'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const resolveId = async () => {
      if (paramId) {
        setInterviewId(paramId);
        return;
      }
      if (!user) return;
      const { data, error: fetchErr } = await supabase
        .from('interviews')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchErr || !data || data.length === 0) {
        setNoInterviews(true);
        setLoading(false);
      } else {
        setInterviewId(data[0].id);
      }
    };
    resolveId();
  }, [paramId, user]);

  useEffect(() => {
    if (!interviewId) return;
    loadReport(interviewId);
  }, [interviewId]);

  const loadReport = async (targetId) => {
    setLoading(true);
    setError(null);
    try {
      const { data: existing } = await supabase
        .from('reports')
        .select('*')
        .eq('interview_id', targetId)
        .single();

      if (existing) {
        let parsed = existing;
        // Try parsing rich JSON if embedded in cv_suggestions
        if (existing.cv_suggestions && existing.cv_suggestions.startsWith('{')) {
          try {
            const rich = JSON.parse(existing.cv_suggestions);
            parsed = { ...existing, ...rich };
          } catch (_e) {}
        }
        setReport(parsed);
      } else {
        const result = await generateReport(targetId);
        setReport(result);
      }
    } catch (err) {
      console.error('Report error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const parsedReport = useMemo(() => {
    if (!report) return null;
    let data = { ...report };
    if (typeof data.cv_suggestions === 'string' && data.cv_suggestions.startsWith('{')) {
      try {
        const json = JSON.parse(data.cv_suggestions);
        data = { ...data, ...json };
      } catch (_e) {}
    }
    return data;
  }, [report]);

  const copyReportSummary = () => {
    if (!parsedReport) return;
    const text = `📊 تقرير تقييم مقابلة Prova AI:
النتيجة العامة: ${parsedReport.score || 0}/100
التقييم: ${parsedReport.verdict || 'تمت المقابلة بنجاح'}

الملخص:
${parsedReport.summary || parsedReport.strengths || ''}

نقاط القوة:
${parsedReport.strengths || ''}

نقاط التطوير:
${parsedReport.weaknesses || ''}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(isRtl ? 'تم نسخ التقرير للحافظة!' : 'Report copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  if (noInterviews) {
    return (
      <div className="page-container" style={{ minHeight: '100dvh', background: 'var(--bg-base)' }}>
        <Header user={user} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
          <div className="card card-elevated" style={{ maxWidth: 440, padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(235,94,40,0.12)', color: 'var(--c-coral)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: '1.8rem' }} />
            </div>
            <h2>{isRtl ? 'لا توجد تقارير سابقة بعد' : 'No Interview Reports Yet'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isRtl ? 'ابدأ مقابلتك التدريبية الأولى وسيقوم الذكاء الاصطناعي بتحليل أدائك وتحديد أخطائك بدقة.' : 'Take your first mock interview to receive an in-depth performance and CV gap analysis.'}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/interview')} style={{ gap: '0.5rem' }}>
              <FontAwesomeIcon icon={faPlay} />
              {isRtl ? 'ابدأ مقابلة تجريبية الآن' : 'Start an Interview'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '1.2rem', background: 'var(--bg-base)' }}>
        <Header user={user} />
        <div style={{
          width: 50, height: 50,
          border: '3.5px solid var(--border-subtle)',
          borderTopColor: 'var(--c-coral)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
          {isRtl ? 'جارٍ تحليل حوار المقابلة واستخراج التقييم الدقيق...' : 'Analyzing interview transcript & generating in-depth diagnostic...'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          {isRtl ? 'يتم الآن مطابقة إجاباتك مع متطلبات مجالك ورصد نقاط القوة والأخطاء وخطة التطوير.' : 'Evaluating technical depth, communication, CV alignment and 30-day roadmap.'}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !parsedReport) {
    return (
      <div className="page-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '1rem', background: 'var(--bg-base)' }}>
        <Header user={user} />
        <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: '2.5rem', color: 'var(--c-coral)' }} />
        <p>{error || t('common.error')}</p>
        <button className="btn btn-primary" onClick={() => interviewId && loadReport(interviewId)}>{t('common.retry')}</button>
      </div>
    );
  }

  const score = parsedReport.score || 0;
  const dimensions = parsedReport.dimensions || [
    { key: 'domain_mastery', label: isRtl ? 'الكفاءة التخصصية والعلمية' : 'Domain & Technical Depth', score: score, feedback: isRtl ? 'إلمام جيد بأساسيات المجال' : 'Solid domain knowledge' },
    { key: 'problem_solving', label: isRtl ? 'التفكير التحليلي وحل المشكلات' : 'Analytical Problem Solving', score: Math.max(60, score - 5), feedback: isRtl ? 'طريقة تفكير منطقية' : 'Structured approach' },
    { key: 'communication', label: isRtl ? 'جودة ووضوح التواصل' : 'Communication & Clarity', score: Math.min(98, score + 4), feedback: isRtl ? 'لباقة ووضوح في الطرح' : 'Clear communication' },
    { key: 'confidence', label: isRtl ? 'الثقة والاتزان المهني' : 'Confidence & Composure', score: score, feedback: isRtl ? 'حضور متزن وهادئ' : 'Composed delivery' },
    { key: 'role_fit', label: isRtl ? 'المطابقة مع متطلبات الوظيفة' : 'Job Profile Alignment', score: score, feedback: isRtl ? 'خلفية متوافقة مع المتطلبات' : 'Strong profile match' },
  ];

  const detectedErrors = parsedReport.detected_errors || [];
  const cvGaps = parsedReport.cv_gaps_analysis || [];
  const actionPlan = parsedReport.action_plan_30_days || [];
  const stats = parsedReport.stats || { totalTurns: 10, talkRatio: '65%', clarityRating: 'جيد جداً', hesitationLevel: 'منخفض' };

  const candidateName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || (isRtl ? 'المرشح' : 'Candidate');

  return (
    <div className="page-container" style={{ minHeight: '100dvh', background: 'var(--bg-base)' }}>
      {/* ── Web App Header (Hidden when printing) ── */}
      <div className="no-print">
        <Header user={user} />
      </div>

      <main style={{ flex: 1, padding: '2rem 1.25rem 5rem', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        
        {/* ══════════════════════════════════════════════════════════════
            1. SCREEN VIEW (Interactive Tabs for Web Users)
            ══════════════════════════════════════════════════════════════ */}
        <div className="report-screen-view">
          {/* Top Header & Export Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(235,94,40,0.12)',
                color: 'var(--c-coral)',
                fontSize: '0.78rem',
                fontWeight: 800,
                marginBottom: '0.5rem',
              }}>
                <FontAwesomeIcon icon={faWandMagicSparkles} />
                <span>{isRtl ? 'تقرير التقييم التشخيصي الذكي' : 'AI Diagnostic Evaluation Report'}</span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isRtl ? 'نتائج وتحليل المقابلة الوظيفية' : 'Interview Performance Diagnostic'}
              </h1>
            </div>

            {/* Actions: Print & Copy (Hidden when printing) */}
            <div className="no-print" style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                onClick={() => window.print()}
                className="btn btn-secondary btn-sm"
                style={{ gap: '0.45rem', padding: '0.55rem 1rem' }}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>{isRtl ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
              </button>
              <button
                onClick={copyReportSummary}
                className="btn btn-ghost btn-sm"
                style={{ gap: '0.45rem', padding: '0.55rem 1rem' }}
              >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ التقرير' : 'Copy Summary')}</span>
              </button>
            </div>
          </div>

          {/* Master Score & Verdict Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="card card-elevated"
            style={{
              padding: '2rem',
              borderRadius: 'var(--radius-xl, 20px)',
              background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-subtle))',
              border: '1px solid var(--border-subtle)',
              marginBottom: '1.75rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '2rem',
              alignItems: 'center',
            }}
          >
            {/* Left / Score Column */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                {isRtl ? 'الدرجة الكلية المحققة' : 'Overall Performance Score'}
              </span>
              <ScoreRing score={score} />
              <span
                className={`badge ${score >= 80 ? 'badge-green' : score >= 65 ? 'badge-coral' : 'badge-red'}`}
                style={{ fontSize: '0.88rem', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)' }}
              >
                {parsedReport.verdict || (score >= 80 ? (isRtl ? '🎉 موصى به للتوظيف' : '🎉 Recommended') : (isRtl ? '💪 يحتاج ممارسة إضافية' : '💪 Needs More Practice'))}
              </span>
            </div>

            {/* Right / Executive Summary & Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {isRtl ? 'الملخص التنفيذي للأداء' : 'Executive Summary'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.92rem', margin: 0 }}>
                  {parsedReport.summary || (isRtl ? 'تم إجراء المقابلة ومطابقة المؤهلات التخصصية بنجاح.' : 'Interview completed and evaluated against professional standards.')}
                </p>
              </div>

              {/* Quick Micro-Stats Pill Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '0.6rem',
                padding: '0.85rem',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{isRtl ? 'عدد جولات النقاش' : 'Dialogue Turns'}</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{stats.totalTurns || 8}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{isRtl ? 'معدل التحدث' : 'Talk Ratio'}</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--c-coral)' }}>{stats.talkRatio || '65%'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{isRtl ? 'وضوح الأفكار' : 'Clarity'}</span>
                  <strong style={{ fontSize: '0.95rem', color: '#48BB78' }}>{stats.clarityRating || (isRtl ? 'ممتاز' : 'High')}</strong>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Interactive Section Tabs (Hidden when printing) */}
          <div className="no-print" style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem',
            overflowX: 'auto',
            paddingBottom: '0.2rem',
          }}>
            {[
              { id: 'overview', label: isRtl ? '📊 المؤشرات والكفاءات' : '📊 Competency Dimensions' },
              { id: 'errors', label: isRtl ? `⚠️ الأخطاء المرصودة (${detectedErrors.length})` : `⚠️ Detected Errors (${detectedErrors.length})` },
              { id: 'cv_gaps', label: isRtl ? `📝 تطوير وإعادة صياغة السيرة (${cvGaps.length})` : `📝 CV Gap Analysis (${cvGaps.length})` },
              { id: 'roadmap', label: isRtl ? '🚀 خطة التطوير (30 يوم)' : '🚀 30-Day Action Plan' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.7rem 1.2rem',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.9rem',
                  fontWeight: activeTab === tab.id ? 800 : 600,
                  color: activeTab === tab.id ? 'var(--c-coral)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2.5px solid var(--c-coral)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            
            {/* TAB 1: OVERVIEW & DIMENSIONS */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              >
                {/* Dimensional Progress Bars */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                    {isRtl ? 'مؤشرات الأداء التخصصي والتواصلي' : 'Competency Sub-Scores'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {dimensions.map((dim) => (
                      <div key={dim.key || dim.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {dim.label}
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: dim.score >= 80 ? '#48BB78' : dim.score >= 65 ? 'var(--c-coral)' : '#E53E3E' }}>
                            {dim.score}%
                          </span>
                        </div>
                        <div style={{
                          height: 9,
                          background: 'var(--bg-subtle)',
                          borderRadius: 'var(--radius-full)',
                          overflow: 'hidden',
                          position: 'relative',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(10, dim.score))}%`,
                            background: dim.score >= 80
                              ? 'linear-gradient(90deg, #48BB78, #38A169)'
                              : dim.score >= 65
                                ? 'linear-gradient(90deg, #F6AD55, #EB5E28)'
                                : 'linear-gradient(90deg, #FC8181, #E53E3E)',
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        {dim.feedback && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                            {dim.feedback}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strengths & Weaknesses Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1.5rem', borderInlineStart: '4px solid #48BB78' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', color: '#48BB78' }}>
                      <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: '1.15rem' }} />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{isRtl ? 'نقاط القوة المرصودة' : 'Key Strengths'}</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.9rem', whiteSpace: 'pre-line', margin: 0 }}>
                      {parsedReport.strengths || (isRtl ? 'تفاعل سريع والتزام بالنقاش المهني.' : 'Responsive and professional discussion.')}
                    </p>
                  </div>

                  <div className="card" style={{ padding: '1.5rem', borderInlineStart: '4px solid var(--c-coral)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem', color: 'var(--c-coral)' }}>
                      <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: '1.15rem' }} />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{isRtl ? 'فرص التحسين والتطوير' : 'Areas for Improvement'}</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.9rem', whiteSpace: 'pre-line', margin: 0 }}>
                      {parsedReport.weaknesses || (isRtl ? 'الحاجة لدعم الإجابات بأمثلة واقعية بالأرقام.' : 'Support answers with concrete metrics.')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: DETECTED ERRORS & CORRECTIONS */}
            {activeTab === 'errors' && (
              <motion.div
                key="errors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                {detectedErrors.length === 0 ? (
                  <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: '2.5rem', color: '#48BB78', marginBottom: '0.8rem' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{isRtl ? 'أداء ممتاز، لم يتم رصد أخطاء جوهرية!' : 'Great performance! No major errors detected.'}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{isRtl ? 'حافظ على هذا المستوى وراجع قسم السيرة الذاتية لتعزيز قوة ملفك.' : 'Keep up the good work and check the CV section to polish your profile.'}</p>
                  </div>
                ) : (
                  detectedErrors.map((errItem, idx) => (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        borderInlineStart: '4px solid #E53E3E',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(229,62,62,0.12)',
                          color: '#E53E3E',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}>
                          {isRtl ? `ملاحظة #${idx + 1}` : `Observation #${idx + 1}`}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {errItem.topic || (isRtl ? 'موضوع السؤال' : 'Topic')}
                        </h4>
                      </div>

                      {errItem.candidate_response && (
                        <div style={{ background: 'var(--bg-subtle)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.86rem' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem', fontWeight: 700 }}>
                            {isRtl ? 'ما ذكرته أثناء المقابلة:' : 'What you stated:'}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{errItem.candidate_response}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#E53E3E', fontSize: '0.86rem' }}>
                          <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginTop: '0.2rem' }} />
                          <span><strong>{isRtl ? 'الخلل المرصود:' : 'The Issue:'}</strong> {errItem.issue}</span>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          color: '#2B6CB0',
                          background: 'rgba(66,153,225,0.08)',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.86rem',
                          lineHeight: 1.6,
                          border: '1px solid rgba(66,153,225,0.2)',
                        }}>
                          <FontAwesomeIcon icon={faLightbulb} style={{ marginTop: '0.2rem', color: '#3182CE' }} />
                          <span><strong>{isRtl ? 'الإجابة النموذجية الموصى بها:' : 'Coach Model Answer:'}</strong> {errItem.ideal_answer}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {/* TAB 3: CV GAP ANALYSIS & REWRITER */}
            {activeTab === 'cv_gaps' && (
              <motion.div
                key="cv_gaps"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div className="card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(235,94,40,0.06)', border: '1px solid rgba(235,94,40,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--c-coral)' }}>
                        {isRtl ? 'تطوير وتحديث السيرة الذاتية بناءً على المقابلة' : 'CV Optimization Engine'}
                      </h4>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {isRtl ? 'تم رصد فجوات في سيرتك الذاتية أثناء أسئلة المحاور. إليك الصياغات المقترحة بالأرقام والنتائج.' : 'Concrete before & after bullet points to pass ATS and impress recruiters.'}
                      </p>
                    </div>
                    <Link
                      to="/cv-editor"
                      className="btn btn-primary btn-sm"
                      style={{ gap: '0.45rem' }}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                      <span>{isRtl ? 'تعديل السيرة الذاتية الآن' : 'Edit CV Now'}</span>
                    </Link>
                  </div>
                </div>

                {cvGaps.map((gap, idx) => (
                  <div key={idx} className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <FontAwesomeIcon icon={faPenToSquare} style={{ color: 'var(--c-coral)' }} />
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {gap.section || (isRtl ? 'قسم السيرة الذاتية' : 'CV Section')}
                      </h4>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                      <strong>{isRtl ? 'الفجوة الحالية:' : 'Current Gap:'}</strong> {gap.current_gap}
                      <br />
                      <strong>{isRtl ? 'التوصية:' : 'Recommendation:'}</strong> {gap.recommendation}
                    </p>

                    {/* Before & After Comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ background: 'rgba(229,62,62,0.06)', border: '1px solid rgba(229,62,62,0.2)', padding: '0.9rem', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#E53E3E', display: 'block', marginBottom: '0.35rem' }}>
                          ❌ {isRtl ? 'الصياغة الضعيفة (قبل):' : 'Before (Weak):'}
                        </span>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {gap.before_example}
                        </p>
                      </div>

                      <div style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.25)', padding: '0.9rem', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38A169', display: 'block', marginBottom: '0.35rem' }}>
                          ✅ {isRtl ? 'الصياغة الاحترافية بالأثر والأرقام (بعد):' : 'After (High Impact):'}
                        </span>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                          {gap.after_example}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* TAB 4: 30-DAY PERSONALIZED ROADMAP */}
            {activeTab === 'roadmap' && (
              <motion.div
                key="roadmap"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div className="card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(74,144,217,0.06)', border: '1px solid rgba(74,144,217,0.2)' }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#3182CE' }}>
                    {isRtl ? 'خطة العمل المخصصة للتحضير للمقابلات الحقيقية (30 يوماً)' : '30-Day Targeted Career Roadmap'}
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {isRtl ? 'اتبع هذه المهام الأسبوعية لسد كافة الثغرات التي ظهرت أثناء مقابلتك قبل التقديم الفعلي للشركات.' : 'Weekly milestone tasks to master your weak points before real interviews.'}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {actionPlan.map((plan, idx) => (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        padding: '1.35rem',
                        borderRadius: 'var(--radius-lg)',
                        borderTop: '3.5px solid var(--c-coral)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--c-coral)' }}>
                          {plan.week}
                        </span>
                        <FontAwesomeIcon icon={faCalendarDays} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} />
                      </div>

                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {plan.focus || plan.title}
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
                        {(plan.tasks || []).map((tItem, tIdx) => (
                          <div key={tIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                            <FontAwesomeIcon icon={faCheckDouble} style={{ color: '#48BB78', fontSize: '0.78rem', marginTop: '0.25rem' }} />
                            <span style={{ lineHeight: 1.5 }}>{tItem}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Bottom Master CTA Bar (Hidden when printing) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="no-print"
            style={{
              display: 'flex',
              gap: '0.85rem',
              flexWrap: 'wrap',
              marginTop: '2.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <Link
              to="/cv-editor"
              state={{ suggestions: parsedReport.cv_suggestions }}
              className="btn btn-primary btn-lg"
              style={{ flex: 1, minWidth: 180, justifyContent: 'center', gap: '0.55rem' }}
            >
              <FontAwesomeIcon icon={faPenToSquare} />
              <span>{isRtl ? 'تحديث وتطوير السيرة الذاتية' : 'Update & Polish CV'}</span>
            </Link>
            <Link
              to="/interview"
              className="btn btn-secondary btn-lg"
              style={{ flex: 1, minWidth: 180, justifyContent: 'center', gap: '0.55rem' }}
            >
              <FontAwesomeIcon icon={faRotateRight} />
              <span>{isRtl ? 'إجراء مقابلة تدريبية جديدة' : 'Retake Mock Interview'}</span>
            </Link>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            2. DEDICATED PRINT DOCUMENT (Visible ONLY when printing)
            ══════════════════════════════════════════════════════════════ */}
        <div className="report-print-document" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
          {/* Header Strip with Prova Brand Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2.5px solid #1B2A41',
            paddingBottom: '14px',
            marginBottom: '18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img src={logoImg} alt="Prova" style={{ height: '46px', width: 'auto', objectFit: 'contain' }} />
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#1B2A41' }}>
                  {isRtl ? 'تقرير التقييم التشخيصي الشامل للمقابلة الوظيفية' : 'Comprehensive Interview Diagnostic Assessment Report'}
                </h1>
                <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                  {isRtl ? 'منصة Prova — محاكاة وتقييم المقابلات بالذكاء الاصطناعي التفاعلي' : 'Prova Platform — AI Interview Simulation & Evaluation Engine'}
                </span>
              </div>
            </div>
            <div style={{ textAlign: isRtl ? 'left' : 'right', fontSize: '0.78rem', color: '#334155', lineHeight: 1.5 }}>
              <div><strong>{isRtl ? 'المرشح:' : 'Candidate:'}</strong> {candidateName}</div>
              <div><strong>{isRtl ? 'التاريخ:' : 'Date:'}</strong> {new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div><strong>{isRtl ? 'معرف الجلسة:' : 'Session ID:'}</strong> {interviewId ? interviewId.slice(0, 8).toUpperCase() : 'PV-REPORT'}</div>
            </div>
          </div>

          {/* Master Score & Executive Summary Block */}
          <div className="print-avoid-break" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderRadius: '10px',
            background: '#F8FAFC',
            border: '1.5px solid #E2E8F0',
            marginBottom: '18px',
          }}>
            <div style={{ flex: 1, marginInlineEnd: '20px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                {isRtl ? 'الملخص التنفيذي للأداء' : 'Executive Performance Summary'}
              </span>
              <h2 style={{ margin: '4px 0 6px', fontSize: '1.05rem', fontWeight: 900, color: '#1B2A41' }}>
                {parsedReport.verdict || (score >= 80 ? (isRtl ? '🎉 موصى به للتوظيف' : 'Recommended') : (isRtl ? '💪 يحتاج ممارسة إضافية' : 'Needs Practice'))}
              </h2>
              <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.6, color: '#334155' }}>
                {parsedReport.summary}
              </p>
            </div>
            <div style={{
              textAlign: 'center',
              minWidth: '100px',
              padding: '12px 18px',
              borderRadius: '8px',
              background: '#FFFFFF',
              border: `2.5px solid ${score >= 80 ? '#10B981' : score >= 65 ? '#EB5E28' : '#EF4444'}`,
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: score >= 80 ? '#10B981' : score >= 65 ? '#EB5E28' : '#EF4444', lineHeight: 1 }}>
                {score}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginTop: '4px' }}>
                / 100
              </div>
            </div>
          </div>

          {/* Micro-Stats Strip */}
          <div className="print-avoid-break" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>{isRtl ? 'عدد جولات الحوار' : 'Dialogue Turns'}</span>
              <strong style={{ fontSize: '0.95rem', color: '#1B2A41' }}>{stats.totalTurns || 8}</strong>
            </div>
            <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>{isRtl ? 'معدل التحدث للمرشح' : 'Candidate Talk Ratio'}</span>
              <strong style={{ fontSize: '0.95rem', color: '#EB5E28' }}>{stats.talkRatio || '65%'}</strong>
            </div>
            <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>{isRtl ? 'وضوح الأفكار والاتزان' : 'Clarity & Delivery'}</span>
              <strong style={{ fontSize: '0.95rem', color: '#10B981' }}>{stats.clarityRating || (isRtl ? 'ممتاز' : 'High')}</strong>
            </div>
          </div>

          {/* Section 1: Detailed Competency Evaluation */}
          <div className="print-avoid-break" style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#1B2A41', borderBottom: '1.5px solid #E2E8F0', paddingBottom: '6px', marginBottom: '12px' }}>
              {isRtl ? '1. مؤشرات الأداء والكفاءات التخصصية' : '1. Competency Dimensions & Sub-scores'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dimensions.map((dim, idx) => (
                <div key={idx} style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1B2A41' }}>{dim.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: dim.score >= 80 ? '#10B981' : dim.score >= 65 ? '#EB5E28' : '#EF4444' }}>
                      {dim.score}%
                    </span>
                  </div>
                  {dim.feedback && (
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>{dim.feedback}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & Improvement Areas */}
          <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '22px' }}>
            <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.88rem', fontWeight: 900, color: '#166534' }}>
                ✅ {isRtl ? 'نقاط القوة المرصودة' : 'Key Strengths'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.6, color: '#15803D', whiteSpace: 'pre-line' }}>
                {parsedReport.strengths}
              </p>
            </div>
            <div style={{ padding: '12px 14px', background: '#FFF7ED', borderRadius: '6px', border: '1px solid #FED7AA' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.88rem', fontWeight: 900, color: '#9A3412' }}>
                ⚠️ {isRtl ? 'فرص التحسين والتطوير' : 'Areas for Improvement'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.6, color: '#C2410C', whiteSpace: 'pre-line' }}>
                {parsedReport.weaknesses}
              </p>
            </div>
          </div>

          {/* Section 2: Detected Errors & Model Answers */}
          {detectedErrors && detectedErrors.length > 0 && (
            <div className="print-avoid-break" style={{ marginBottom: '22px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#1B2A41', borderBottom: '1.5px solid #E2E8F0', paddingBottom: '6px', marginBottom: '12px' }}>
                {isRtl ? `2. الأخطاء المرصودة والردود النموذجية البديلة (${detectedErrors.length})` : `2. Detected Errors & Coach Model Answers (${detectedErrors.length})`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {detectedErrors.map((errItem, idx) => (
                  <div key={idx} className="print-avoid-break" style={{ padding: '10px 14px', background: '#FFF5F5', borderRadius: '6px', border: '1px solid #FED7D7' }}>
                    <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#9B2C2C', marginBottom: '4px' }}>
                      #{idx + 1} — {errItem.topic}
                    </div>
                    {errItem.candidate_response && (
                      <div style={{ fontSize: '0.78rem', color: '#4A5568', marginBottom: '3px' }}>
                        <strong>{isRtl ? 'ما ذكرته أثناء المقابلة:' : 'What you stated:'}</strong> {errItem.candidate_response}
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: '#C53030', marginBottom: '4px' }}>
                      <strong>{isRtl ? 'الخلل المرصود:' : 'Diagnosed Issue:'}</strong> {errItem.issue}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#1E40AF', background: '#EFF6FF', padding: '6px 10px', borderRadius: '4px', border: '1px solid #DBEAFE' }}>
                      <strong>{isRtl ? 'الإجابة النموذجية الموصى بها:' : 'Coach Model Answer:'}</strong> {errItem.ideal_answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: CV Gap Analysis & ATS Optimization */}
          {cvGaps && cvGaps.length > 0 && (
            <div className="print-avoid-break" style={{ marginBottom: '22px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#1B2A41', borderBottom: '1.5px solid #E2E8F0', paddingBottom: '6px', marginBottom: '12px' }}>
                {isRtl ? `3. تطوير وإعادة صياغة السيرة الذاتية لـ ATS (${cvGaps.length})` : `3. CV Gap Analysis & ATS Optimization (${cvGaps.length})`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {cvGaps.map((gap, idx) => (
                  <div key={idx} className="print-avoid-break" style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#EB5E28', marginBottom: '3px' }}>
                      {gap.section}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: '6px' }}>
                      <strong>{isRtl ? 'التوصية المهنية:' : 'Recommendation:'}</strong> {gap.recommendation}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem' }}>
                      <div style={{ background: '#FFF5F5', padding: '6px 8px', borderRadius: '4px', color: '#9B2C2C', border: '1px solid #FED7D7' }}>
                        <strong>❌ الصياغة السابقة (قبل):</strong> {gap.before_example}
                      </div>
                      <div style={{ background: '#F0FDF4', padding: '6px 8px', borderRadius: '4px', color: '#166534', fontWeight: 600, border: '1px solid #BBF7D0' }}>
                        <strong>✅ الصياغة المعتمدة (بعد):</strong> {gap.after_example}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: 30-Day Targeted Career Roadmap */}
          {actionPlan && actionPlan.length > 0 && (
            <div className="print-avoid-break" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#1B2A41', borderBottom: '1.5px solid #E2E8F0', paddingBottom: '6px', marginBottom: '12px' }}>
                {isRtl ? '4. خطة التطوير والممارسة المخصصة (30 يوماً)' : '4. 30-Day Action & Practice Plan'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {actionPlan.map((plan, idx) => (
                  <div key={idx} className="print-avoid-break" style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#EB5E28', marginBottom: '2px' }}>
                      {plan.week} — {plan.focus || plan.title}
                    </div>
                    <ul style={{ margin: '4px 0 0', paddingInlineStart: '18px', fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>
                      {(plan.tasks || []).map((task, tIdx) => (
                        <li key={tIdx}>{task}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Verification Footer */}
          <div style={{
            marginTop: '25px',
            paddingTop: '10px',
            borderTop: '1px solid #CBD5E1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: '#64748B',
          }}>
            <span>{isRtl ? 'تم إصدار هذا التقرير تلقائياً عبر محرك Prova AI للتحليل الوظيفي' : 'Officially generated by Prova AI Career Diagnostic Engine'}</span>
            <span>https://prova-app-si.vercel.app</span>
          </div>
        </div>

      </main>

      {/* ══════════════════════════════════════════════════════════════
          3. PRINT-SPECIFIC CSS RULES (Strict Document Formatting)
          ══════════════════════════════════════════════════════════════ */}
      <style>{`
        @media screen {
          .report-print-document {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 14mm;
          }
          html, body, #root, .page-container, main {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          .report-screen-view,
          header,
          footer,
          nav,
          .site-header {
            display: none !important;
          }
          .report-print-document {
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: inherit !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

