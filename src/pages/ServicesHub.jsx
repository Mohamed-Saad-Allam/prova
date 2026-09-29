import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faPenToSquare,
  faChartSimple,
  faGear,
  faChevronRight,
  faChevronLeft,
  faWandMagicSparkles,
  faClock,
  faMars,
  faVenus,
  faCheck,
  faXmark,
  faStar,
  faBolt,
  faFileLines,
  faTrophy,
  faLightbulb,
  faCircleCheck,
  faTriangleExclamation,
  faRotateRight,
  faFire,
  faBullseye,
  faChartPie,
  faArrowsRotate,
  faArrowRight,
  faArrowLeft,
  faCompass,
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/layout/Header';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] },
  }),
};

const TIPS = [
  {
    titleAr: 'قاعدة STAR في الإجابة',
    descAr: 'قسّم إجابتك على الأسئلة السلوكية إلى: الموقف (Situation)، المهمة (Task)، الإجراء المتخذ (Action)، والنتيجة بالأرقام (Result).',
    titleEn: 'The STAR Method',
    descEn: 'Structure behavioral answers with: Situation, Task, Action taken, and measurable Result.',
  },
  {
    titleAr: 'تخصيص السيرة الذاتية لـ ATS',
    descAr: 'احرص على تطابق الكلمات المفتاحية في سيرتك الذاتية مع متطلبات الوظيفة المستهدفة لضمان تجاوز الفلاتر الآلية.',
    titleEn: 'ATS Keywords Optimization',
    descEn: 'Align keywords in your CV with the target job posting to pass automated applicant tracking systems.',
  },
  {
    titleAr: 'الوضوح ونبرة الصوت',
    descAr: 'تحدث بثقة وهدوء، خذ ثانية للتفكير قبل الإجابة، وركز على إبراز دورك وتأثيرك الشخصي في المشاريع السابقة.',
    titleEn: 'Confidence and Tone',
    descEn: 'Speak clearly and calmly. Pause briefly before answering and emphasize your individual impact on projects.',
  },
];

export default function ServicesHub({ user }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language || 'ar';
  const isRtl = lang.startsWith('ar');
  const arrowIcon = isRtl ? faChevronLeft : faChevronRight;
  const forwardArrow = isRtl ? faArrowLeft : faArrowRight;

  const [recentInterviews, setRecentInterviews] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [showInterviewerModal, setShowInterviewerModal] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState(
    () => localStorage.getItem('prova_selected_avatar') || 'ahmed'
  );

  // ── Dynamic Quota & Profile State ──
  const [profileData, setProfileData] = useState(null);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [todayCount, setTodayCount] = useState(0);
  const [cvExists, setCvExists] = useState(false);
  const [stats, setStats] = useState({
    avgScore: null,
    totalCompleted: 0,
  });

  const [activeTipIdx, setActiveTipIdx] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // 1. Profile data (quota limit, bonus, ban status, reset timestamp)
      let prof = null;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('daily_interview_limit, bonus_interviews, quota_reset_at, is_banned, ban_reason')
          .eq('id', user.id)
          .single();
        prof = data;
        setProfileData(data);
      } catch (_e) {}

      const totalAllowed = (prof?.daily_interview_limit != null ? prof.daily_interview_limit : 3) + (prof?.bonus_interviews || 0);
      setDailyLimit(totalAllowed);

      // 2. Recent interviews & Stats calculation
      try {
        const { data: ivs } = await supabase
          .from('interviews')
          .select('id, status, started_at, ended_at, reports(score, verdict, strengths)')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(10);

        if (ivs) {
          setRecentInterviews(ivs.slice(0, 4));
          const completed = ivs.filter((i) => i.status === 'completed');
          const scored = completed.filter((i) => i.reports?.[0]?.score != null);
          const avg = scored.length > 0
            ? Math.round(scored.reduce((acc, curr) => acc + (curr.reports[0].score || 0), 0) / scored.length)
            : null;

          setStats({
            avgScore: avg,
            totalCompleted: completed.length,
          });
        }
      } catch (_e) {}

      setLoadingRecent(false);

      // 3. Count today's interviews accounting for quota_reset_at
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let countQuery = supabase
          .from('interviews')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (prof?.quota_reset_at && new Date(prof.quota_reset_at) > startOfDay) {
          countQuery = countQuery.gte('started_at', prof.quota_reset_at);
        } else {
          countQuery = countQuery.gte('started_at', startOfDay.toISOString());
        }

        const { count } = await countQuery;
        setTodayCount(count || 0);
      } catch (_e) {}

      // 4. Check if CV is uploaded
      try {
        const { data: cvData } = await supabase
          .from('cvs')
          .select('id, raw_text')
          .eq('user_id', user.id)
          .maybeSingle();
        setCvExists(Boolean(cvData && (cvData.raw_text || cvData.id)));
      } catch (_e) {}
    };

    fetchData();
  }, [user]);

  const services = [
    {
      id: 'interview',
      icon: <FontAwesomeIcon icon={faPlay} style={{ fontSize: '1.4rem' }} />,
      tagIcon: faFire,
      tagText: isRtl ? 'المقابلة الذكية' : 'AI Simulation',
      title: t('services.startInterview'),
      desc: isRtl
        ? 'محاكاة مقابلة عمل صوتية حية مدتها 5 دقائق بالذكاء الاصطناعي مع تقييم فوري وتفصيلي.'
        : '5-minute live AI voice mock interview tailored to your exact resume with instant feedback.',
      color: 'var(--c-coral)',
      bg: 'rgba(232, 130, 90, 0.12)',
      borderColor: 'rgba(232, 130, 90, 0.35)',
      primary: true,
      actionText: isRtl ? 'دخول المقابلة الآن' : 'Start Mock Interview',
    },
    {
      id: 'cv',
      icon: <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: '1.4rem' }} />,
      tagIcon: faFileLines,
      tagText: isRtl ? 'متوافق مع ATS' : 'ATS Optimized',
      title: t('services.editCv'),
      desc: isRtl
        ? 'إنشاء وتعديل سيرتك الذاتية باحترافية، فحص توافق الكلمات المفتاحية، وتصديرها PDF.'
        : 'Build and polish your professional ATS-friendly resume with instant export options.',
      color: 'var(--c-navy)',
      bg: 'rgba(27, 42, 65, 0.08)',
      borderColor: 'var(--border-subtle)',
      path: '/cv-editor',
      actionText: isRtl ? 'تعديل السيرة الذاتية' : 'Edit Resume',
    },
    {
      id: 'reports',
      icon: <FontAwesomeIcon icon={faChartSimple} style={{ fontSize: '1.4rem' }} />,
      tagIcon: faChartPie,
      tagText: isRtl ? 'تحليل شامل' : 'In-depth Analytics',
      title: t('services.viewReports'),
      desc: isRtl
        ? 'استعراض تقارير أدائك السابقة، نقاط القوة، وفرص التحسين المقترحة من خبير المقابلات.'
        : 'Review your past session metrics, strengths, and personalized action plans.',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.10)',
      borderColor: 'var(--border-subtle)',
      path: '/reports',
      actionText: isRtl ? 'استعراض التقارير' : 'View Performance',
    },
    {
      id: 'settings',
      icon: <FontAwesomeIcon icon={faGear} style={{ fontSize: '1.4rem' }} />,
      tagIcon: faGear,
      tagText: isRtl ? 'التفضيلات' : 'Customization',
      title: t('services.settings'),
      desc: isRtl
        ? 'تخصيص تفضيلات الصوت، لغة المنصة، وإدارة بيانات حسابك الشخصي.'
        : 'Configure audio settings, preferred language, and account credentials.',
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.10)',
      borderColor: 'var(--border-subtle)',
      path: '/settings',
      actionText: isRtl ? 'إدارة الإعدادات' : 'Manage Settings',
    },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (isRtl) {
      if (h < 12) return 'صباح الخير';
      if (h < 17) return 'مساء الخير';
      return 'مساء النور';
    } else {
      if (h < 12) return 'Good morning';
      if (h < 17) return 'Good afternoon';
      return 'Good evening';
    }
  };

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || (isRtl ? 'صديقي' : 'Friend');
  const userInitials = (user?.user_metadata?.full_name || user?.email || 'P')
    .slice(0, 2)
    .toUpperCase();

  const remainingQuota = Math.max(0, dailyLimit - todayCount);
  const quotaPercent = Math.min(100, Math.round((todayCount / (dailyLimit || 1)) * 100));

  const activeTip = TIPS[activeTipIdx % TIPS.length];

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} />

      <main style={{ flex: 1, padding: '2rem 1.5rem 4rem', maxWidth: 1060, margin: '0 auto', width: '100%' }}>
        {/* ── 1. Hero Welcome & Career Status ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(135deg, rgba(232,130,90,0.08) 0%, rgba(27,42,65,0.04) 100%)',
            border: '1px solid rgba(232,130,90,0.22)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.75rem 2rem',
            marginBottom: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Ambient Glow */}
          <div
            style={{
              position: 'absolute',
              top: '-40%',
              insetInlineEnd: '-10%',
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,130,90,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', zIndex: 1 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                fontWeight: 800,
                boxShadow: 'var(--shadow-coral)',
                flexShrink: 0,
              }}
            >
              {userInitials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {greeting()}
                </span>
                {/* Pure text tag without bubble background */}
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--c-coral-dark)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: '0.75rem' }} />
                  <span>{isRtl ? 'المرشح الذكي' : 'Smart Candidate'}</span>
                </span>
              </div>
              <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', fontWeight: 800, margin: '0.2rem 0' }}>
                {userName}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                {isRtl
                  ? 'مركز قيادة مسارك المهني — تدرّب على المقابلات الحية وطوّر سيرتك الذاتية بالذكاء الاصطناعي.'
                  : 'Your AI Career Command Hub — Practice live interviews and accelerate your career readiness.'}
              </p>
            </div>
          </div>

          {/* Quick Quota & Persona Pill */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              minWidth: 260,
              zIndex: 1,
            }}
          >
            {/* Persona trigger */}
            <button
              onClick={() => setShowInterviewerModal(true)}
              className="btn btn-ghost"
              style={{
                padding: '0.55rem 0.9rem',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                fontSize: '0.84rem',
                fontWeight: 700,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FontAwesomeIcon
                  icon={selectedInterviewer === 'ahmed' ? faMars : faVenus}
                  style={{ color: selectedInterviewer === 'ahmed' ? '#2B6CB0' : '#9B59B6' }}
                />
                <span>
                  {isRtl
                    ? `المحاور: ${selectedInterviewer === 'ahmed' ? 'أحمد (مدير توظيف)' : 'سارة (خبيرة استقطاب)'}`
                    : `Interviewer: ${selectedInterviewer === 'ahmed' ? 'Ahmed (Hiring Lead)' : 'Sara (Talent Lead)'}`}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--c-coral)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>{isRtl ? 'تغيير' : 'Switch'}</span>
                <FontAwesomeIcon icon={faArrowsRotate} style={{ fontSize: '0.7rem' }} />
              </span>
            </button>

            {/* Daily Quota Indicator */}
            <div
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: 'var(--radius-lg)',
                background: remainingQuota === 0 ? 'rgba(235,87,87,0.10)' : 'var(--bg-surface)',
                border: `1px solid ${remainingQuota === 0 ? 'rgba(235,87,87,0.30)' : 'var(--border-subtle)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: 700, color: remainingQuota === 0 ? '#EB5757' : 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FontAwesomeIcon icon={faChartSimple} style={{ fontSize: '0.75rem', color: 'var(--c-coral)' }} />
                  {isRtl ? 'رصيد مقابلات اليوم:' : "Today's Quota:"}
                </span>
                <span style={{ fontWeight: 800, color: remainingQuota === 0 ? '#EB5757' : 'var(--c-coral-dark)' }}>
                  {isRtl ? `${remainingQuota} من ${dailyLimit} متبقية` : `${remainingQuota} of ${dailyLimit} left`}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-subtle)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${quotaPercent}%`,
                    height: '100%',
                    background:
                      remainingQuota === 0
                        ? '#EB5757'
                        : 'linear-gradient(90deg, var(--c-coral), var(--c-coral-dark))',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 2. Interactive User Career Roadmap (رحلة المرشح في Prova) ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="card"
          style={{
            padding: '1.5rem',
            marginBottom: '2.5rem',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FontAwesomeIcon icon={faCompass} style={{ color: 'var(--c-coral)', fontSize: '1.1rem' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isRtl ? 'مسار جاهزيتك للتوظيف' : 'Your Career Readiness Pathway'}
              </h2>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {isRtl ? '3 خطوات واضحة لاحتراف المقابلات' : '3 clear steps to interview mastery'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Step 1: CV Setup */}
            <div
              onClick={() => navigate('/cv-editor')}
              style={{
                padding: '1.15rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                background: cvExists ? 'rgba(16, 185, 129, 0.04)' : 'rgba(232, 130, 90, 0.04)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                  {isRtl ? 'الخطوة 1' : 'Step 1'}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cvExists ? '#10B981' : 'var(--c-coral)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FontAwesomeIcon icon={cvExists ? faCircleCheck : faTriangleExclamation} />
                  <span>{cvExists ? (isRtl ? 'السيرة جاهزة' : 'CV Ready') : (isRtl ? 'بحاجة لتحديث' : 'Needs Setup')}</span>
                </span>
              </div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isRtl ? 'إعداد وفحص السيرة الذاتية' : 'Resume & ATS Setup'}
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {isRtl
                  ? 'يقرأ الذكاء الاصطناعي بياناتك وخبراتك لتوجيه أسئلة مخصصة لمجالك وتخصصك.'
                  : 'AI analyzes your skills to tailor realistic questions for your exact domain.'}
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-coral)' }}>
                <span>{cvExists ? (isRtl ? 'مراجعة وتعديل الـ CV' : 'Edit Resume') : (isRtl ? 'إنشاء السيرة الذاتية الآن' : 'Create Resume Now')}</span>
                <FontAwesomeIcon icon={forwardArrow} style={{ fontSize: '0.75rem' }} />
              </div>
            </div>

            {/* Step 2: Live AI Mock Interview */}
            <div
              onClick={() => setShowInterviewerModal(true)}
              style={{
                padding: '1.15rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(232, 130, 90, 0.3)',
                background: 'linear-gradient(135deg, rgba(232, 130, 90, 0.08) 0%, rgba(209, 107, 66, 0.03) 100%)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--c-coral-dark)' }}>
                  {isRtl ? 'الخطوة 2 (الأساسية)' : 'Step 2 (Core)'}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-coral)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FontAwesomeIcon icon={faBolt} />
                  <span>{isRtl ? '5 دقائق حية' : '5 Live Mins'}</span>
                </span>
              </div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isRtl ? 'خوض المقابلة الصوتية التفاعلية' : 'Live Voice AI Simulation'}
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {isRtl
                  ? 'تحاور صوتياً مع مدير التوظيف الذكي في سيناريوهات واقعية وسريعة.'
                  : 'Engage in live voice conversation with the AI hiring manager under realistic timers.'}
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--c-coral-dark)' }}>
                <span>{isRtl ? 'بدء محاكاة المقابلة' : 'Start Simulation'}</span>
                <FontAwesomeIcon icon={forwardArrow} style={{ fontSize: '0.75rem' }} />
              </div>
            </div>

            {/* Step 3: Actionable Analytics */}
            <div
              onClick={() => navigate('/reports')}
              style={{
                padding: '1.15rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(16, 185, 129, 0.04)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                  {isRtl ? 'الخطوة 3' : 'Step 3'}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FontAwesomeIcon icon={faTrophy} />
                  <span>{stats.avgScore != null ? `${stats.avgScore}/100` : (isRtl ? 'التقارير' : 'Reports')}</span>
                </span>
              </div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {isRtl ? 'تحليل الأداء وخطة التحسين' : 'Performance Report & Polish'}
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {isRtl
                  ? 'اكتشف نقاط قوتك والفرص التي تحتاج لتطوير لضمان التفوق في مقابلاتك الحقيقية.'
                  : 'Get breakdown of competencies, communication clarity, and custom feedback.'}
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#10B981' }}>
                <span>{isRtl ? 'استعراض التقييم' : 'View Feedback'}</span>
                <FontAwesomeIcon icon={forwardArrow} style={{ fontSize: '0.75rem' }} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── 3. Quick Career KPI Metrics ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
        >
          {/* Card 1: Average AI Score */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(232,130,90,0.12)',
                color: 'var(--c-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={faStar} />
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                {isRtl ? 'متوسط أداء المقابلات' : 'Average AI Score'}
              </p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.15rem 0 0', color: 'var(--text-primary)' }}>
                {stats.avgScore != null ? `${stats.avgScore}/100` : (isRtl ? 'قيد التجربة' : 'Pending')}
              </h3>
            </div>
          </motion.div>

          {/* Card 2: Completed Simulations */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={faTrophy} />
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                {isRtl ? 'المقابلات المكتملة' : 'Completed Sessions'}
              </p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.15rem 0 0', color: 'var(--text-primary)' }}>
                {isRtl ? `${stats.totalCompleted} جلسات` : `${stats.totalCompleted} sessions`}
              </h3>
            </div>
          </motion.div>

          {/* Card 3: CV Status */}
          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="card"
            onClick={() => navigate('/cv-editor')}
            style={{
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-md)',
                background: cvExists ? 'rgba(27, 42, 65, 0.08)' : 'rgba(232, 130, 90, 0.12)',
                color: cvExists ? 'var(--c-navy)' : 'var(--c-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={faFileLines} />
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                {isRtl ? 'حالة السيرة الذاتية' : 'Resume Status'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FontAwesomeIcon
                    icon={cvExists ? faCircleCheck : faTriangleExclamation}
                    style={{ color: cvExists ? '#10B981' : 'var(--c-coral)', fontSize: '0.85rem' }}
                  />
                  <span>
                    {cvExists
                      ? (isRtl ? 'مربوطة ومحدثة' : 'Active & Synced')
                      : (isRtl ? 'بحاجة لتحديث' : 'Needs Setup')}
                  </span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Daily Allowance */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(139, 92, 246, 0.12)',
                color: '#8B5CF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={faBolt} />
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                {isRtl ? 'حد المقابلة الواحدة' : 'Max Session Length'}
              </p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.15rem 0 0', color: 'var(--text-primary)' }}>
                {isRtl ? '5 دقائق ذكية' : '5 Smart Mins'}
              </h3>
            </div>
          </motion.div>
        </div>

        {/* ── 4. Main Services Grid ── */}
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            {isRtl ? 'خدمات منصة Prova الذكية' : 'Prova Career Services'}
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            marginBottom: '3rem',
          }}
        >
          {services.map((s, i) => (
            <motion.div
              key={s.id}
              custom={i + 2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              whileHover={{ y: -5, boxShadow: 'var(--shadow-lg)' }}
              onClick={() => {
                if (s.id === 'interview') {
                  setShowInterviewerModal(true);
                } else if (s.path) {
                  navigate(s.path);
                }
              }}
              className="card"
              style={{
                cursor: 'pointer',
                padding: '1.75rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                border: `1px solid ${s.borderColor}`,
                background: s.primary
                  ? 'linear-gradient(135deg, rgba(232,130,90,0.07) 0%, rgba(209,107,66,0.04) 100%)'
                  : 'var(--bg-surface)',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 'var(--radius-xl)',
                transition: 'all 0.25s ease',
              }}
            >
              {/* Pure Text Tag (NO background or enclosed border) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-lg)',
                    background: s.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: s.color,
                  }}
                >
                  {s.icon}
                </div>
                {/* Clean tag without pill background */}
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: s.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <FontAwesomeIcon icon={s.tagIcon} style={{ fontSize: '0.8rem' }} />
                  <span>{s.tagText}</span>
                </span>
              </div>

              <div>
                <h3 style={{ marginBottom: '0.4rem', fontSize: '1.15rem', fontWeight: 800 }}>
                  {s.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.55 }}>
                  {s.desc}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: s.color }}>
                  {s.actionText}
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: s.bg,
                    color: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                  }}
                >
                  <FontAwesomeIcon icon={arrowIcon} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── 5. Smart Career Tip & Best Practice Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(232, 130, 90, 0.12)',
                color: 'var(--c-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--c-coral-dark)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FontAwesomeIcon icon={faLightbulb} style={{ fontSize: '0.75rem' }} />
                  <span>{isRtl ? 'نصيحة مهنية سريعة:' : 'Pro Career Tip:'}</span>
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isRtl ? activeTip.titleAr : activeTip.titleEn}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                {isRtl ? activeTip.descAr : activeTip.descEn}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTipIdx((prev) => prev + 1)}
            className="btn btn-ghost btn-icon btn-sm"
            title={isRtl ? 'نصيحة أخرى' : 'Next tip'}
            style={{ borderRadius: 'var(--radius-full)', color: 'var(--text-muted)' }}
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
        </motion.div>

        {/* ── 6. Recent Interviews Activity Feed ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FontAwesomeIcon icon={faClock} style={{ color: 'var(--c-coral)', fontSize: '1rem' }} />
              {isRtl ? 'سجل المقابلات الأخيرة' : 'Recent Interview Sessions'}
            </h2>
            {recentInterviews.length > 0 && (
              <Link to="/reports" style={{ fontSize: '0.85rem', color: 'var(--c-coral)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>{isRtl ? 'عرض كل التقارير' : 'View all reports'}</span>
                <FontAwesomeIcon icon={arrowIcon} style={{ fontSize: '0.75rem' }} />
              </Link>
            )}
          </div>

          {loadingRecent ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isRtl ? 'جاري جلب المقابلات...' : 'Loading recent activity...'}
            </div>
          ) : recentInterviews.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentInterviews.map((iv) => {
                const score = iv.reports?.[0]?.score;
                const isCompleted = iv.status === 'completed';
                const formattedDate = iv.started_at
                  ? new Date(iv.started_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <Link
                    key={iv.id}
                    to={score != null ? `/report/${iv.id}` : '#'}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div
                      className="card"
                      style={{
                        padding: '1.1rem 1.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        transition: 'all 0.2s ease',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 'var(--radius-md)',
                            background: isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(232,130,90,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isCompleted ? '#10B981' : 'var(--c-coral)',
                            fontSize: '1.15rem',
                          }}
                        >
                          <FontAwesomeIcon icon={isCompleted ? faCircleCheck : faClock} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: 'var(--text-primary)' }}>
                              {isRtl ? 'جلسة مقابلة ذكية' : 'AI Simulation Session'}
                            </p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              #{iv.id.slice(-5).toUpperCase()}
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.15rem 0 0' }}>
                            {formattedDate} • {isCompleted ? (isRtl ? 'مكتملة ومقيّمة' : 'Completed & Graded') : (isRtl ? 'جلسة غير مكتملة' : 'Incomplete')}
                          </p>
                        </div>
                      </div>

                      {/* Clean score text without pill background */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {score != null ? (
                          <span
                            style={{
                              fontSize: '0.92rem',
                              fontWeight: 800,
                              color: score >= 75 ? '#10B981' : 'var(--c-coral-dark)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>{score}/100</span>
                            <FontAwesomeIcon icon={faBullseye} style={{ fontSize: '0.8rem' }} />
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {isRtl ? 'بدون تقييم' : 'No score'}
                          </span>
                        )}
                        <FontAwesomeIcon icon={arrowIcon} style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              className="card"
              style={{
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: 'rgba(232,130,90,0.12)',
                  color: 'var(--c-coral)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                }}
              >
                <FontAwesomeIcon icon={faPlay} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                {isRtl ? 'لم تُجرِ أي مقابلة تجريبية حتى الآن' : 'No mock interviews yet'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 460, margin: 0 }}>
                {isRtl
                  ? 'ابدأ أول تجربة محاكاة مدتها 5 دقائق لتقييم مستواك ومعرفة نقاط قوتك واكتساب الثقة قبل مقابلاتك الواقعية.'
                  : 'Start your first 5-minute interactive simulation to evaluate your performance and build confidence.'}
              </p>
              <button
                onClick={() => setShowInterviewerModal(true)}
                className="btn btn-primary"
                style={{ marginTop: '0.5rem', fontWeight: 800, padding: '0.65rem 1.6rem' }}
              >
                <FontAwesomeIcon icon={faPlay} />
                <span>{isRtl ? 'بدء المقابلة الأولى الآن' : 'Start First Interview'}</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* ── 7. Interviewer Selection Modal (Pre-Interview) ── */}
        <AnimatePresence>
          {showInterviewerModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 15 }}
                transition={{ duration: 0.25 }}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-xl)',
                  maxWidth: 580,
                  width: '100%',
                  padding: '2rem',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  position: 'relative',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                      {isRtl ? 'اختر المحاور الذكي للمقابلة' : 'Select AI Interviewer'}
                    </h2>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      {isRtl
                        ? 'اختر شخصية ونبرة المحاور قبل بدء الجلسة التفاعلية (5 دقائق مركزة).'
                        : 'Choose persona and tone before starting your 5-minute focused session.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowInterviewerModal(false)}
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-full)' }}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>

                {/* Interviewer Options */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
                  {/* Option 1: Ahmed (Male) */}
                  <div
                    onClick={() => setSelectedInterviewer('ahmed')}
                    style={{
                      cursor: 'pointer',
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${selectedInterviewer === 'ahmed' ? 'var(--c-coral)' : 'var(--border-subtle)'}`,
                      background: selectedInterviewer === 'ahmed' ? 'rgba(232, 130, 90, 0.08)' : 'var(--bg-subtle)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      position: 'relative',
                    }}
                  >
                    {selectedInterviewer === 'ahmed' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          insetInlineEnd: 10,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--c-coral)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, #2B6CB0, #1A365D)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                        }}
                      >
                        <FontAwesomeIcon icon={faMars} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {isRtl ? 'أحمد' : 'Ahmed'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--c-coral)', fontWeight: 700 }}>
                          {isRtl ? 'مدير توظيف تنفيذي' : 'Executive Hiring Lead'}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                      {isRtl
                        ? 'صوت رجالي طبيعي وواثق • متخصص في إدارة المقابلات الوظيفية والتحديات التقنية والمهنية.'
                        : 'Natural male voice • Specializes in technical depth and role competency evaluation.'}
                    </p>
                  </div>

                  {/* Option 2: Sara (Female) */}
                  <div
                    onClick={() => setSelectedInterviewer('sara')}
                    style={{
                      cursor: 'pointer',
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${selectedInterviewer === 'sara' ? 'var(--c-coral)' : 'var(--border-subtle)'}`,
                      background: selectedInterviewer === 'sara' ? 'rgba(232, 130, 90, 0.08)' : 'var(--bg-subtle)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      position: 'relative',
                    }}
                  >
                    {selectedInterviewer === 'sara' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          insetInlineEnd: 10,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--c-coral)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, #9B59B6, #6C3483)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                        }}
                      >
                        <FontAwesomeIcon icon={faVenus} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {isRtl ? 'سارة' : 'Sara'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#9B59B6', fontWeight: 700 }}>
                          {isRtl ? 'خبيرة استقطاب كفاءات' : 'Senior Talent Acquisition Lead'}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                      {isRtl
                        ? 'صوت أنثوي متقن ولبق • متخصصة في تحليل المهارات السلوكية والتوافق الثقافي والقيادي.'
                        : 'Articulate female voice • Expert in behavioral evaluation, culture fit, and soft skills.'}
                    </p>
                  </div>
                </div>

                {/* Quota & Status Notice */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: todayCount >= dailyLimit ? 'rgba(235, 87, 87, 0.10)' : 'rgba(16, 185, 129, 0.08)',
                    border: `1px solid ${todayCount >= dailyLimit ? 'rgba(235, 87, 87, 0.25)' : 'rgba(16, 185, 129, 0.20)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: todayCount >= dailyLimit ? '#EB5757' : '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <FontAwesomeIcon
                      icon={todayCount >= dailyLimit ? faTriangleExclamation : faCircleCheck}
                      style={{ fontSize: '0.9rem' }}
                    />
                    <span>
                      {todayCount >= dailyLimit
                        ? isRtl
                          ? `استنفدت الحد المسموح (${todayCount} من ${dailyLimit} مقابلات اليوم). يتجدد رصيدك يومياً.`
                          : `You reached your limit of ${dailyLimit} interviews today. Resets daily.`
                        : isRtl
                        ? `رصيد المقابلات اليوم: ${todayCount} من ${dailyLimit} مستخدمة (أقصى مدة: 5 دقائق للمقابلة)`
                        : `Today's Quota: ${todayCount} of ${dailyLimit} used (Max 5 mins each)`}
                    </span>
                  </div>
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowInterviewerModal(false)}
                    className="btn btn-ghost"
                    style={{ padding: '0.65rem 1.25rem' }}
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    disabled={todayCount >= dailyLimit || profileData?.is_banned}
                    onClick={() => {
                      if (profileData?.is_banned) {
                        toast.error(
                          isRtl
                            ? `حسابك معلق: ${profileData.ban_reason || 'يرجى مراجعة الإدارة'}`
                            : `Account suspended: ${profileData.ban_reason || 'Contact admin'}`
                        );
                        return;
                      }
                      if (todayCount >= dailyLimit) return;
                      localStorage.setItem('prova_selected_avatar', selectedInterviewer);
                      setShowInterviewerModal(false);
                      navigate(`/interview?interviewer=${selectedInterviewer}`);
                    }}
                    className="btn btn-primary"
                    style={{
                      padding: '0.65rem 1.6rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: todayCount >= dailyLimit || profileData?.is_banned ? 0.5 : 1,
                      cursor: todayCount >= dailyLimit || profileData?.is_banned ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <FontAwesomeIcon icon={faPlay} />
                    <span>{isRtl ? 'دخول المقابلة الآن (5 دقائق)' : 'Start Interview (5 Mins)'}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
