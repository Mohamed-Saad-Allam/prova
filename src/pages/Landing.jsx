import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileLines,
  faMicrophone,
  faChartSimple,
  faArrowLeft,
  faArrowRight,
  faPlay,
  faCircleCheck,
  faStar,
  faBolt,
  faShieldHalved,
  faUsers,
  faComments,
  faCheck,
  faXmark,
  faChevronDown,
  faChevronUp,
  faRocket,
  faTrophy,
  faBullseye,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function Landing({ user, userRole }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const arrowIcon = isRtl ? faArrowLeft : faArrowRight;

  const [selectedInterviewer, setSelectedInterviewer] = useState('ahmed');
  const [activeDemoTrack, setActiveDemoTrack] = useState('medical');
  const [openFaq, setOpenFaq] = useState(0);
  const candidateName = user?.user_metadata?.full_name?.split(' ')[0] || '';

  // ── Interactive Demo Scenarios (Universal across all professions) ──
  const demoScenarios = {
    medical: {
      role: isRtl ? 'طبيب مقيم ورعاية صحية (Medical Resident / Physician)' : 'Medical Resident / Healthcare Physician',
      cvSnippet: isRtl ? 'خبرة 3 سنوات في تشخيص الحالات الحرجة وإدارة بروتوكولات الطوارئ السريعة' : '3 years in acute patient diagnosis and emergency clinical protocols',
      question: isRtl
        ? 'أهلاً بيك دكتور! شفت في سيرتك الذاتية إنك تعاملت مع حالات طوارئ حرجة تحت ضغط الوقت.. احكيلي عن أصعب تشخيص دقيق اتخذت فيه قراراً عاجلاً؟'
        : 'Welcome Doctor! I noticed in your CV you managed critical emergency cases under tight timelines. What was the most demanding acute diagnosis you navigated?',
      answerSample: isRtl
        ? 'استقبلت حالة اشتباه جلطة قلبية حادة غير نمطية، قمت فوراً بعمل رسم قلب متقدم وأعطيت العلاج التحفظي بعد استبعاد الموانع ونسقت مع القسطرة في أقل من 15 دقيقة.'
        : 'I received an atypical acute coronary case, immediately executed a 12-lead ECG, initiated protocol-based thrombolysis post-contraindication review, and coordinated cath-lab transfer in under 15 minutes.',
      aiEvaluation: isRtl
        ? 'إجابة متميزة تبرز الهدوء والامتثال الصارم للبروتوكولات الطبية وسرعة اتخاذ القرار لإنقاذ حياة المريض.'
        : 'Outstanding clinical judgment displaying adherence to protocols and rapid life-saving triage decision-making.',
      score: 96,
    },
    finance: {
      role: isRtl ? 'محاسب مالي ورئيس حسابات (Senior Financial Accountant)' : 'Senior Financial Accountant & Auditor',
      cvSnippet: isRtl ? 'إعداد القوائم المالية، الموازنات التقديرية، وخفض الهدر المالي بنسبة 18%' : 'Financial statement preparation, budgeting, and 18% operational cost reduction',
      question: isRtl
        ? 'ممتاز جداً.. شفت في الـ CV إنك خفضت الهدر المالي بنسبة 18%. احكيلي إيه كانت استراتيجيتك في مراجعة الدورة المستندية وتدفقات السيولة؟'
        : 'Impressive! You achieved an 18% cost reduction. How did you structure your audit of document workflows and cash flow cycles?',
      answerSample: isRtl
        ? 'حللت بنود المصروفات التشغيلية، وأعدت التفاوض على شروط الدفع مع كبار الموردين، واستبدلنا العمليات الورقية بنظام ERP قفل الثغرات وضبط المخزون.'
        : 'I audited overhead expenditure line-by-line, renegotiated payment terms with top suppliers, and replaced manual paperwork with an integrated ERP workflow.',
      aiEvaluation: isRtl
        ? 'فهم مالي عميق يربط بين المحاسبة الدقيقة والقرارات الاستراتيجية لتعظيم ربحية المؤسسة.'
        : 'Deep financial acumen bridging tactical bookkeeping with strategic bottom-line profitability enhancement.',
      score: 94,
    },
    sales: {
      role: isRtl ? 'مدير مبيعات وتطوير أعمال (Business Development & Sales Manager)' : 'Business Development & Sales Manager',
      cvSnippet: isRtl ? 'تحقيق 140% من المستهدف البيعي السنوي وإغلاق صفقات مؤسسية (B2B)' : 'Exceeded sales quota by 140% and closed high-ticket B2B enterprise accounts',
      question: isRtl
        ? 'عاش جداً.. لما العميل المؤسسي يماطل في توقيع العقد بحجة الميزانية أو وجود عروض منافسة، إيه طريقتك في قيادة المفاوضات وإتمام الصفقة؟'
        : 'Great! When enterprise clients stall on signing due to budget freezes or rival bids, how do you handle negotiations to close the deal?',
      answerSample: isRtl
        ? 'بعيد توجيه النقاش من السعر إلى العائد الاستثماري (ROI) والقيمة المضافة، وببني دراسة جدوى تثبت وفراً حقيقياً مع تقديم خطة دفع مرنة تحسم التعاقد فوراً.'
        : 'I pivot the dialogue from price to ROI and long-term value, presenting a concrete business case with a phased payment structure that seals the agreement.',
      aiEvaluation: isRtl
        ? 'مهارة إقناع وتفاوض رفيعة المستوى تعتمد على لغة الأرقام والمكسب المشترك بدلاً من الضغط البيعي التقليدي.'
        : 'High-level consultative selling and negotiation mastery centered on tangible ROI rather than aggressive pitching.',
      score: 95,
    },
    legal: {
      role: isRtl ? 'مستشار قانوني للشركات والعقود (Corporate Legal Counsel)' : 'Corporate Legal Counsel & Contracts Specialist',
      cvSnippet: isRtl ? 'صياغة ومراجعة العقود التجارية، وحل النزاعات، وضمان الامتثال التشريعي' : 'Commercial contract drafting, labor dispute resolution, and regulatory compliance',
      question: isRtl
        ? 'أهلاً بك! في حال اكتشفت ثغرة قانونية في عقد توريد رئيسي تعرض الشركة لغرامات مالية كبيرة، إيه أول إجراء قانوني وقائي تتخذه؟'
        : 'Welcome! If you discover an ambiguous liability clause in a master supply agreement exposing the firm to heavy penalties, what preventive action do you take?',
      answerSample: isRtl
        ? 'أعددت ملحقاً تفسيرياً معدلاً (Addendum) يعيد ضبط حدود المسؤولية والتعويضات، وبدأت تفاوضاً ودياً مبنياً على استمرارية الشراكة لتوثيق الشروط الجديدة رسمياً.'
        : 'I drafted a clarifying addendum capping liabilities and indemnities, initiating constructive partner negotiations to ratify the amended terms without litigation.',
      aiEvaluation: isRtl
        ? 'حكمة قانونية وإجراءات وقائية استباقية تحمي مصالح المنشأة وتتفادى النزاعات القضائية المكلفة.'
        : 'Proactive risk mitigation and strategic legal drafting shielding company assets from costly exposure.',
      score: 93,
    },
    education: {
      role: isRtl ? 'معلم ومشرف تربوي (Academic Educator & Trainer)' : 'Academic Educator & Curriculum Lead',
      cvSnippet: isRtl ? 'تدريس أكثر من 600 طالب، وتطبيق استراتيجيات التعلم التفاعلي والتقييم المستمر' : 'Educated 600+ learners, integrating interactive pedagogy and formative assessments',
      question: isRtl
        ? 'سؤال مهم.. إزاي بتتعامل مع الفروق الفردية داخل الفصل وتضمن تفاعل الطلاب المتعثرين دون إبطاء تقدم الطلاب المتفوقين؟'
        : 'Crucial question: How do you address differentiated learning abilities in the classroom without stalling high achievers?',
      answerSample: isRtl
        ? 'بطبق استراتيجية التعليم المتمايز (Differentiated Learning) من خلال تقسيم الأنشطة لمهام متدرجة الصعوبة، مع توجيه الطلاب المتفوقين لدور المرشدين لأقرانهم.'
        : 'I implement tiered learning objectives with scaffolded activities, enabling advanced students to tackle deeper challenges and mentor their peers.',
      aiEvaluation: isRtl
        ? 'منهجية تربوية ناضجة تعزز المشاركة والتحفيز الذاتي وتبني بيئة تعليمية إيجابية للجميع.'
        : 'Mature instructional methodology fostering self-efficacy and inclusive classroom engagement.',
      score: 95,
    },
    tech: {
      role: isRtl ? 'مهندس برمجيات ونظم (Software & Systems Engineer)' : 'Software & Cloud Systems Engineer',
      cvSnippet: isRtl ? 'بناء وتطوير نظم رقمية عالية الاعتمادية وتحسين الأداء بنسبة 40%' : 'Engineered resilient distributed systems, boosting response throughput by 40%',
      question: isRtl
        ? 'احكيلي عن أكبر تحدي واجهته في الحفاظ على استقرار الخدمة وسرعة استجابة النظام تحت ضغط العمليات؟'
        : 'Tell me about your toughest challenge in maintaining high availability and sub-second response times under peak traffic.',
      answerSample: isRtl
        ? 'اعتمدنا استراتيجيات التخزين المؤقت وتحسين استعلامات قواعد البيانات مع التوزيع الديناميكي للأحمال وضبط مراقبة الأداء التلقائية.'
        : 'We implemented multi-tier caching, optimized database indexes, dynamic auto-scaling, and telemetry monitoring for bottleneck isolation.',
      aiEvaluation: isRtl
        ? 'حلول معمارية واقعية تثبت فهمك لجودة النظم وهندسة الحلول تحت الضغط.'
        : 'Pragmatic architectural choices demonstrating systems reliability and operational maturity under load.',
      score: 94,
    },
  };

  // ── FAQ Items ──
  const faqs = [
    {
      q: isRtl ? 'هل المنصة مناسبة لتخصصي حتى لو لم يكن مجالاً تقنياً أو برمجياً؟' : 'Is Prova suitable for my field even if it is not tech or software?',
      a: isRtl
        ? 'نعم بكل تأكيد! تم تصميم Prova ليكون محاوراً متخصصاً في أكثر من 50 مجالاً وظيفياً: من الطب والصيدلة والتمريض، إلى المحاسبة والمالية والبنوك، المحاماة والقانون، التعليم والتدريس، التسويق والمبيعات، خدمة العملاء، الهندسة، الإدارة، وغيرها. المحاور يقرأ سيرتك الذاتية ويناقشك في صلب مهنتك الدقيقة ومصطلحات مجالك.'
        : 'Absolutely yes! Prova is engineered for over 50 professional domains: medicine, pharmacy, nursing, accounting, banking, corporate law, teaching, marketing, sales, customer support, engineering, and operations. The AI reads your CV and speaks your exact professional language.',
    },
    {
      q: isRtl ? 'هل المقابلة عبارة عن أسئلة ثابتة ومحفوظة؟' : 'Are interview questions canned or fixed?',
      a: isRtl
        ? 'إطلاقاً! في Prova المحاور الذكي يقرأ ملفك وسيرتك الذاتية ومشاريعك السابقة، ويبني حواراً حياً مفتوحاً يناقشك في أدق تفاصيل مسيرتك المهنية كأنك أمام مدير توظيف بشري حقيقي.'
        : 'Not at all! Prova’s AI reads your actual CV and projects, conducting a fluid, context-aware dialogue that tests your specific experience rather than asking generic questions.',
    },
    {
      q: isRtl ? 'كيف يساعدني محاكي Prova في التخلص من توتر المقابلات؟' : 'How does Prova help eliminate interview anxiety?',
      a: isRtl
        ? 'التوتر ينتج عن المفاجأة وعدم الاعتياد على الكلام بصوت عالٍ. خوض المقابلة بالصوت الحي ورؤية لغة الجسد واستلام التغذية الراجعة يجعلك تدخل مقابلتك الحقيقية وكأنها جلستك العاشرة بكل هدوء وثقة.'
        : 'Anxiety stems from unfamiliarity. Speaking live, hearing rapid voice replies, and receiving constructive feedback prepares you so your real interview feels like your tenth rehearsal.',
    },
    {
      q: isRtl ? 'ما الفرق بين المحاور "أحمد" والمحاورة "سارة"؟' : 'What is the difference between Ahmed and Sara?',
      a: isRtl
        ? 'أحمد يمثل مدير المقابلات التخصصية والمهنية ويركز على عمق التخصص، القرارات الفنية، وفحص الإنجازات والمهام المذكورة في سيرتك الذاتية في أي مجال. سارة تمثل مسؤولة الموارد البشرية والقيادة وتركز على المهارات الشخصية (Soft Skills)، أسلوب التواصل، إدارة ضغط العمل، والملائمة الثقافية.'
        : 'Ahmed acts as a Senior Hiring Manager focusing on hard skills, domain depth, and past deliverables in your industry. Sara acts as a Talent Acquisition Lead focusing on leadership, soft skills, and cultural fit.',
    },
    {
      q: isRtl ? 'هل السيرة الذاتية التي تنشئها المنصة متوافقة مع أنظمة الـ ATS؟' : 'Is the generated CV compliant with ATS filters?',
      a: isRtl
        ? 'نعم 100%. تم تصميم نظام صياغة الـ CV ليتطابق مع معايير أنظمة الفرز الآلي العالمية (Applicant Tracking Systems)، مع استخراج الكلمات المفتاحية الأكثر طلباً في سوق العمل.'
        : 'Yes, 100%. Our formatting complies strictly with international ATS scanners, embedding industry-standard keywords and clean typographic hierarchy.',
    },
    {
      q: isRtl ? 'ما الذي أحصل عليه في تقرير التقييم بعد انتهاء المقابلة؟' : 'What is included in the evaluation report?',
      a: isRtl
        ? 'تحصل على درجة نهائية مئوية، تقييم تفصيلي لمهارات التواصل، عمق المعرفة في مجالك، تحليل الثقة وسرعة البديهة، بالإضافة إلى نقاط القوة، الأخطاء التي يجب تجنبها، وإجابات بديلة مقترحة.'
        : 'You receive an overall scorecard, communication breakdown, technical depth analysis, strengths, critical blindspots, and actionable improvements for future interviews.',
    },
    {
      q: isRtl ? 'هل استخدام منصة Prova مجاني؟' : 'Is Prova completely free to use?',
      a: isRtl
        ? 'نعم! يمكنك التسجيل مجاناً، بناء وتعديل سيرتك الذاتية، وخوض المقابلات اليومية واستخراج تقاريرك بدون أي بطاقة بنكية.'
        : 'Yes! You can sign up for free, build and optimize your CV, conduct daily interview sessions, and generate reports without entering any credit card.',
    },
  ];

  return (
    <div className="page-container" style={{ background: 'var(--bg-base)', minHeight: '100dvh' }}>
      <Header user={user} />

      <main style={{ flex: 1, overflow: 'hidden' }}>
        {/* ══════════════════════════════════════════
            1. HERO SECTION (Dynamic, Bold, Universal)
        ══════════════════════════════════════════ */}
        <section
          className="bg-animated"
          style={{
            minHeight: '92vh',
            display: 'flex',
            alignItems: 'center',
            padding: '3.5rem 1.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient Lighting Orbs */}
          <div
            style={{
              position: 'absolute',
              top: '12%',
              insetInlineEnd: '6%',
              width: 520,
              height: 520,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,130,90,0.12) 0%, rgba(27,42,65,0.02) 70%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
              animation: 'float-orb 10s ease-in-out infinite alternate',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8%',
              insetInlineStart: '5%',
              width: 440,
              height: 440,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(27,42,65,0.08) 0%, rgba(232,130,90,0.02) 70%)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ maxWidth: 1240, margin: '0 auto', width: '100%', position: 'relative', zIndex: 2 }}>
            <div className="hero-grid">
              {/* Left Column: Messaging & CTAs */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="hero-text-col"
                style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}
              >
                {/* Eyebrow Text (Clean text without capsule container) */}
                <motion.div variants={fadeUp} className="hero-eyebrow-container">
                  <div className="hero-eyebrow" style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--c-coral)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>✨</span>
                    <span>{isRtl ? 'منصة المقابلات الذكية لكافة التخصصات والمهن' : 'Universal AI Voice Interviews for All Professions'}</span>
                  </div>
                </motion.div>

                {/* Headline */}
                <motion.div variants={fadeUp}>
                  <h1 className="hero-headline" style={{ fontSize: 'clamp(2.1rem, 4.2vw, 3.3rem)', lineHeight: 1.2, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    {isRtl ? 'تدرّب على مقابلتك في أي تخصص وظيفي كأنك أمام ' : 'Rehearse for your interview in any profession with the '}
                    <span className="text-gradient">
                      {isRtl ? 'مدير التوظيف الحقيقي' : 'Real Hiring Lead'}
                    </span>
                  </h1>
                </motion.div>

                {/* Subtitle */}
                <motion.p
                  variants={fadeUp}
                  className="hero-subtitle"
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '1.05rem',
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: 520,
                  }}
                >
                  {isRtl
                    ? 'مقابلة صوتية حية مخصصة لسيرتك الذاتية وتخصصك، تحاكي مقابلات العمل الحقيقية بدقة 100%.'
                    : 'Live interactive voice interviews tailored strictly to your resume and domain, mirroring real-world hiring.'}
                </motion.p>

                {/* Adaptive Action Bar (User vs Guest) */}
                <motion.div variants={fadeUp} className="hero-actions" style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                  {user ? (
                    <>
                      <Link to="/services" className="btn btn-primary btn-xl" style={{ gap: '0.65rem' }}>
                        <span>{isRtl ? `مرحباً ${candidateName} — مركز الخدمات 🚀` : `Continue to Hub 🚀`}</span>
                        <FontAwesomeIcon icon={arrowIcon} />
                      </Link>
                      <Link to="/cv-editor" className="btn btn-ghost btn-lg" style={{ gap: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                        <FontAwesomeIcon icon={faFileLines} style={{ color: 'var(--c-coral)' }} />
                        <span>{isRtl ? 'محرر السيرة الذاتية' : 'Edit CV'}</span>
                      </Link>
                      {userRole === 'admin' && (
                        <Link to="/admin" className="btn btn-ghost btn-lg" style={{ gap: '0.5rem', background: 'rgba(232,130,90,0.1)', color: 'var(--c-coral)', border: '1px solid rgba(232,130,90,0.25)' }}>
                          <FontAwesomeIcon icon={faShieldHalved} />
                          <span>{isRtl ? 'لوحة الإدارة' : 'Admin Hub'}</span>
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      <Link to="/auth?mode=signup" className="btn btn-primary btn-xl" style={{ gap: '0.65rem' }}>
                        <span>{isRtl ? 'ابدأ مقابلتك مجاناً الآن' : 'Start Free Rehearsal'}</span>
                        <FontAwesomeIcon icon={arrowIcon} />
                      </Link>
                      <a href="#demo" className="btn btn-ghost btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(232,130,90,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesomeIcon icon={faPlay} style={{ color: 'var(--c-coral)', fontSize: '0.75rem' }} />
                        </div>
                        <span>{isRtl ? 'تجربة المحاكاة التفاعلية' : 'Interactive Demo'}</span>
                      </a>
                    </>
                  )}
                </motion.div>

                {/* Social Proof & Metrics */}
                <motion.div variants={fadeUp} className="hero-social-proof" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="hero-avatars-row" style={{ display: 'flex' }}>
                    {['#E8825A', '#1B2A41', '#2A9D8F', '#E76F51', '#457B9D'].map((bg, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: bg,
                          border: '2.5px solid var(--bg-base)',
                          marginInlineStart: idx > 0 ? -10 : 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {['ط', 'م', 'س', 'ن', 'ك'][idx]}
                      </div>
                    ))}
                  </div>
                  <div className="hero-rating-box">
                    <div className="hero-stars-row" style={{ display: 'flex', gap: 3, color: '#f59e0b', fontSize: '0.8rem', marginBottom: 2 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <FontAwesomeIcon key={i} icon={faStar} />
                      ))}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {isRtl ? 'يثق بنا أكثر من ' : 'Trusted by '}
                      <strong style={{ color: 'var(--text-primary)' }}>{isRtl ? '5,000+ متقدم في كافة التخصصات' : '5,000+ diverse professionals'}</strong>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Column: Hero Visual Card (Interactive Demo Preview) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 25 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                style={{ position: 'relative' }}
              >
                <div
                  className="card"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 24,
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-xl)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Switcher: Ahmed vs Sara */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: 4, borderRadius: 12, border: '1px solid var(--border-subtle)', flex: 1 }}>
                      <button
                        onClick={() => setSelectedInterviewer('ahmed')}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.75rem',
                          borderRadius: 8,
                          border: 'none',
                          background: selectedInterviewer === 'ahmed' ? 'var(--bg-surface)' : 'transparent',
                          color: selectedInterviewer === 'ahmed' ? 'var(--c-coral)' : 'var(--text-secondary)',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          boxShadow: selectedInterviewer === 'ahmed' ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span>👨‍💼</span>
                        <span>{isRtl ? 'أحمد (المقابلة التخصصية)' : 'Ahmed (Domain Lead)'}</span>
                      </button>
                      <button
                        onClick={() => setSelectedInterviewer('sara')}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.75rem',
                          borderRadius: 8,
                          border: 'none',
                          background: selectedInterviewer === 'sara' ? 'var(--bg-surface)' : 'transparent',
                          color: selectedInterviewer === 'sara' ? 'var(--c-coral)' : 'var(--text-secondary)',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          boxShadow: selectedInterviewer === 'sara' ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span>👩‍💼</span>
                        <span>{isRtl ? 'سارة (المقابلة السلوكية)' : 'Sara (Culture & People)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Simulated Zoom Video View Tile */}
                  <div
                    style={{
                      aspectRatio: '16/10',
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #1B2A41 0%, #152233 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.5rem',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Background Grid Accent */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(232,130,90,0.18) 0%, transparent 65%)',
                      }}
                    />

                    {/* Top Row inside Video Tile: Live Pill & Prova Shield */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        insetInlineStart: 12,
                        insetInlineEnd: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        zIndex: 3,
                      }}
                    >
                      {/* Live Indicator */}
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.55)',
                          backdropFilter: 'blur(8px)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: '#10b981',
                            display: 'inline-block',
                            boxShadow: '0 0 8px #10b981',
                          }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>
                          {isRtl ? 'جلسة ذكية مباشرة' : 'Live Session'}
                        </span>
                      </div>

                      {/* Security / Engine Pill */}
                      <div
                        style={{
                          background: 'rgba(232,130,90,0.15)',
                          border: '1px solid rgba(232,130,90,0.3)',
                          color: 'var(--c-coral)',
                          padding: '0.22rem 0.6rem',
                          borderRadius: 999,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <FontAwesomeIcon icon={faShieldHalved} />
                        <span>Prova Live</span>
                      </div>
                    </div>

                    {/* Avatar Silhouette & Gentle Ambient Pulse */}
                    <motion.div
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: 92,
                        height: 92,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                        boxShadow: '0 8px 30px rgba(232,130,90,0.4)',
                        position: 'relative',
                        zIndex: 2,
                      }}
                    >
                      {selectedInterviewer === 'sara' ? '👩‍💼' : '👨‍💼'}
                    </motion.div>

                    {/* Speaking / Audio Waveform Bars (Subtle Ambient Motion) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '1rem', zIndex: 2 }}>
                      {[10, 22, 14, 28, 18, 12, 24, 16].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [6, h, 6] }}
                          transition={{ duration: 0.6 + i * 0.08, repeat: Infinity, delay: i * 0.05, ease: 'easeInOut' }}
                          style={{
                            width: 3.5,
                            borderRadius: 2,
                            background: 'var(--c-coral)',
                          }}
                        />
                      ))}
                    </div>

                    {/* Bottom Row inside Video Tile: Name Pill & Latency */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        insetInlineStart: 12,
                        insetInlineEnd: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        zIndex: 3,
                      }}
                    >
                      {/* Name Pill */}
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(8px)',
                          padding: '0.28rem 0.65rem',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.74rem',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        <FontAwesomeIcon icon={faMicrophone} style={{ color: 'var(--c-coral)', fontSize: '0.7rem' }} />
                        <span>
                          {selectedInterviewer === 'sara'
                            ? (isRtl ? 'سارة (المقابلة السلوكية)' : 'Sara (HR Lead)')
                            : (isRtl ? 'أحمد (المقابلة التخصصية)' : 'Ahmed (Domain Lead)')}
                        </span>
                      </div>

                      {/* Sonic Latency Pill */}
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(8px)',
                          padding: '0.28rem 0.65rem',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.7rem',
                          color: '#f59e0b',
                          fontWeight: 800,
                        }}
                      >
                        <FontAwesomeIcon icon={faBolt} />
                        <span>{isRtl ? '< 0.5s استجابة' : '< 0.5s Latency'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Context Dialogue Snippet */}
                  <div
                    style={{
                      marginTop: '1rem',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 14,
                      padding: '0.9rem 1.1rem',
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--c-coral)' }}>
                        {selectedInterviewer === 'sara'
                          ? (isRtl ? 'سارة (المقابلة السلوكية):' : 'Sara (HR Fit):')
                          : (isRtl ? 'أحمد (المقابلة التخصصية):' : 'Ahmed (Domain Lead):')}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {selectedInterviewer === 'sara'
                        ? (isRtl
                            ? '«قرأت في سيرتك الذاتية إنك أدرت مهاماً حيوية مع فرق متعددة، إيه أصعب موقف تواصل مررت بيه وإزاي حافظت على روح الفريق وبيئة العمل؟»'
                            : '"I noticed in your CV you worked across cross-functional teams. What was your toughest communication challenge and how did you resolve it?"')
                        : (isRtl
                            ? '«لاحظت في الـ CV إنك قمت بإنجاز مهم في مجالك الوظيفي، إيه كان أكبر تحدي عملي واجهته فيه وإزاي اتخذت القرار السليم؟»'
                            : '"I saw your major accomplishments in your field. What was your most critical challenge and how did you execute the optimal solution?"')}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ══════════════════════════════════════════
                STATS & TRUST TICKER
            ══════════════════════════════════════════ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              style={{ marginTop: '4rem' }}
              className="stats-grid"
            >
              {[
                { val: '15,000+', label: isRtl ? 'مقابلة تم إجراؤها في كافة المجالات' : 'Interviews across all fields' },
                { val: '< 0.5s', label: isRtl ? 'سرعة استجابة الصوت الحقيقي' : 'Instant voice audio response' },
                { val: '50+ تخصص', label: isRtl ? 'تغطية طبية، مالية، قانونية، وهندسية' : 'Covering all major professions' },
                { val: '92%', label: isRtl ? 'وصلوا لمرحلة العروض الوظيفية' : 'Secured real job offers' },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="card"
                  style={{
                    textAlign: 'center',
                    padding: '1.25rem 1rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 16,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--c-coral)', lineHeight: 1 }}>
                    {s.val}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.4rem 0 0', fontWeight: 600 }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            2. MEET THE AI HIRING LEADS
        ══════════════════════════════════════════ */}
        <section id="interviewers" style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.6rem' }}>
                {isRtl ? 'محاورون حقيقيون مخصصون لمجالك ومهنتك' : 'Real-World Interview Personas'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 660, margin: '0 auto', fontSize: '0.96rem', lineHeight: 1.6 }}>
                {isRtl
                  ? 'اختر بين المقابلة الفنية والتخصصية في صلب مهنتك مع "أحمد" أو مقابلة القيادة والملائمة السلوكية مع "سارة". كل محاور يقيمك بناءً على معايير مجالك الدقيقة.'
                  : 'Choose between in-depth domain expertise screening with Ahmed, or leadership and behavioral evaluation with Sara.'}
              </p>
            </div>

            <div className="interviewers-grid">
              {/* Ahmed Card */}
              <div
                className="card"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 20,
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-navy), #253957)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', boxShadow: 'var(--shadow-md)' }}>
                    👨‍💼
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{isRtl ? 'أحمد — مدير المقابلات التخصصية والمهنية' : 'Ahmed — Senior Hiring & Domain Lead'}</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--c-coral)', fontWeight: 700 }}>
                      {isRtl ? 'المقابلة الفنية والتخصصية لكافة المجالات (Domain & Hard Skills)' : 'Domain & Professional Mastery'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                    <span>{isRtl ? 'يركز على صلب مهنتك (طبي، مالي، قانوني، تعليمي، تسويقي، هندسي، إلخ) وفحص إنجازاتك' : 'Evaluates your domain-specific expertise, case studies, and career milestones'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                    <span>{isRtl ? 'يناقشك في منهجية عملك، التحديات التي واجهتها، وكيف اتخذت القرارات المهنية' : 'Explores professional methodologies, critical dilemmas, and tactical choices'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                    <span>{isRtl ? 'نبرة مصرية واثقة ومتزنة تماثل مديري التوظيف في كبرى المؤسسات والشركات' : 'Confident, pragmatic tone modeled after senior industry interviewers'}</span>
                  </div>
                </div>

                <Link
                  to={user ? "/interview?interviewer=ahmed" : "/auth?mode=signup"}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', gap: '0.5rem' }}
                >
                  <span>{isRtl ? 'خوض مقابلة تخصصية مع أحمد' : 'Start Domain Rehearsal with Ahmed'}</span>
                  <FontAwesomeIcon icon={arrowIcon} />
                </Link>
              </div>

              {/* Sara Card */}
              <div
                className="card"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 20,
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', boxShadow: 'var(--shadow-coral)' }}>
                    👩‍💼
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{isRtl ? 'سارة — مديرة الموارد البشرية والمقابلات السلوكية' : 'Sara — Head of Talent & People'}</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--c-coral)', fontWeight: 700 }}>
                      {isRtl ? 'المقابلة السلوكية والقيادية (Behavioral & Leadership Fit)' : 'Behavioral & Leadership Alignment'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                    <span>{isRtl ? 'تركز على المهارات الشخصية (Soft Skills)، أسلوب التواصل، والعمل الجماعي تحت الضغط' : 'Assesses communication clarity, emotional intelligence, and team dynamics'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                    <span>{isRtl ? 'تقييم طريقة التعامل مع الزملاء والعملاء والإدارة وحل النزاعات المهنية بحكمة' : 'Evaluates conflict management, stakeholder relations, and crisis navigation'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                    <span>{isRtl ? 'أسلوب حواري ذكي ومريح يستخرج أفضل ما في شخصيتك المهنية وطموحك' : 'Empathetic, engaging conversational style designed to highlight your potential'}</span>
                  </div>
                </div>

                <Link
                  to={user ? "/interview?interviewer=sara" : "/auth?mode=signup"}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', gap: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', fontWeight: 800 }}
                >
                  <span>{isRtl ? 'خوض مقابلة سلوكية مع سارة' : 'Start Culture Rehearsal with Sara'}</span>
                  <FontAwesomeIcon icon={arrowIcon} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            3. INTERACTIVE SIMULATION PLAYGROUND (#demo)
        ══════════════════════════════════════════ */}
        <section id="demo" style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                {isRtl ? 'شاهد كيف يبني الذكاء الاصطناعي حواراً حقيقياً في أي مهنة' : 'See How Prova Drives Authentic Interviews in Any Field'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {isRtl ? 'اختر مجالك الوظيفي وشاهد كيف يربط المحاور بين سيرتك الذاتية وإجابتك التخصصية' : 'Select your professional track to experience domain-grounded questioning'}
              </p>
            </div>

            {/* Track Selector Tabs (Universal Professions) */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
              {[
                { key: 'medical', label: isRtl ? '🩺 الطب والرعاية الصحية' : '🩺 Healthcare & Medicine' },
                { key: 'finance', label: isRtl ? '💰 المحاسبة والمالية' : '💰 Accounting & Finance' },
                { key: 'sales', label: isRtl ? '📢 المبيعات والتسويق' : '📢 Sales & Marketing' },
                { key: 'legal', label: isRtl ? '⚖️ القانون والمحاماة' : '⚖️ Legal & Corporate Law' },
                { key: 'education', label: isRtl ? '🎓 التعليم والتدريس' : '🎓 Education & Teaching' },
                { key: 'tech', label: isRtl ? '💻 الهندسة والتقنية' : '💻 Engineering & Tech' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveDemoTrack(tab.key)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: 999,
                    border: activeDemoTrack === tab.key ? '1px solid var(--c-coral)' : '1px solid var(--border-default)',
                    background: activeDemoTrack === tab.key ? 'rgba(232,130,90,0.14)' : 'var(--bg-surface)',
                    color: activeDemoTrack === tab.key ? 'var(--c-coral)' : 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Interactive Showcase Box */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDemoTrack}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="card"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 24,
                  padding: '2rem',
                  boxShadow: 'var(--shadow-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
              >
                {/* Dossier Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--c-coral)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {isRtl ? 'المسمى الوظيفي المستهدف' : 'Target Role'}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{demoScenarios[activeDemoTrack].role}</h3>
                  </div>
                  <div style={{ background: 'var(--bg-subtle)', padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <strong>{isRtl ? 'بيانات الـ CV:' : 'CV Highlight:'}</strong> {demoScenarios[activeDemoTrack].cvSnippet}
                  </div>
                </div>

                {/* Simulated Conversation Flow */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* AI Question */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.1rem', flexShrink: 0 }}>
                      👨‍💼
                    </div>
                    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '0.85rem 1.15rem', borderRadius: '16px 16px 16px 4px', maxWidth: '85%' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--c-coral)', marginBottom: 2 }}>{isRtl ? 'أحمد (مدير المقابلة التخصصية):' : 'Ahmed (Lead):'}</div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {demoScenarios[activeDemoTrack].question}
                      </p>
                    </div>
                  </div>

                  {/* Candidate Answer */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-navy), #253957)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 800, flexShrink: 0 }}>
                      {candidateName ? candidateName.charAt(0) : (isRtl ? 'أنت' : 'You')}
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))', color: '#fff', padding: '0.85rem 1.15rem', borderRadius: '16px 16px 4px 16px', maxWidth: '85%', boxShadow: 'var(--shadow-coral)' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.85, marginBottom: 2 }}>{candidateName || (isRtl ? 'إجابتك الصوتية في المقابلة:' : 'Your spoken reply:')}</div>
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                        {demoScenarios[activeDemoTrack].answerSample}
                      </p>
                    </div>
                  </div>

                  {/* Realtime AI Feedback Banner */}
                  <div style={{ marginTop: '0.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <FontAwesomeIcon icon={faTrophy} style={{ color: '#10b981', fontSize: '1.1rem' }} />
                      <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#10b981' }}>{isRtl ? 'تحليل الأداء الفوري:' : 'Instant Evaluation:'}</div>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{demoScenarios[activeDemoTrack].aiEvaluation}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#10b981', color: '#fff', padding: '0.25rem 0.65rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 900 }}>
                      <FontAwesomeIcon icon={faStar} />
                      <span>{demoScenarios[activeDemoTrack].score} / 100</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            4. COMPARISON: BEFORE VS WITH PROVA
        ══════════════════════════════════════════ */}
        <section style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-surface)' }}>
          <div style={{ maxWidth: 1050, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                {isRtl ? 'لماذا تضمن Prova اجتيازك لمقابلات العمل في أي مجال؟' : 'Why Rehearsing on Prova Changes the Game'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {isRtl ? 'الفرق بين التحضير العشوائي التقليدي وبين التدريب الواقعي الموجه' : 'Traditional memorization vs Realtime adaptive AI rehearsal'}
              </p>
            </div>

            <div className="comparison-grid">
              {/* Old Traditional Way */}
              <div
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 20,
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faXmark} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ef4444' }}>
                    {isRtl ? 'التحضير التقليدي العشوائي' : 'Traditional Way (Without Prova)'}
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#ef4444', fontWeight: 800 }}>✕</span>
                    <span>{isRtl ? 'حفظ إجابات عامة تفضحك فور طرح أول سؤال تخصصي حقيقي غير متوقع.' : 'Memorizing textbook answers that collapse under realistic pressure.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#ef4444', fontWeight: 800 }}>✕</span>
                    <span>{isRtl ? 'توتر مفرط وتلعثم في أول 5 دقائق بسبب عدم التحدث الصوتي مسبقاً.' : 'Crippling anxiety and freezing during the first 5 minutes of the call.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#ef4444', fontWeight: 800 }}>✕</span>
                    <span>{isRtl ? 'رفض متكرر دون أن تعرف أين أخطأت أو كيف تحسن طريقة إجابتك.' : 'Ghosted or rejected without any constructive feedback on your blindspots.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#ef4444', fontWeight: 800 }}>✕</span>
                    <span>{isRtl ? 'سيرة ذاتية تفشل في عبور فلاتر الـ ATS وتضيع في بريد المؤسسات.' : 'CV fails ATS parsing and gets discarded before human eyes see it.'}</span>
                  </div>
                </div>
              </div>

              {/* With Prova */}
              <div
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid rgba(16,185,129,0.35)',
                  borderRadius: 20,
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: 'var(--shadow-md)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faCheck} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                    {isRtl ? 'مع منصة بروفا (Prova Rehearsal)' : 'With Prova Rehearsal'}
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                    <span>{isRtl ? 'حوار صوتي مفتوح في تخصصك يدربك على التفكير السريع والرد بثقة.' : 'Unscripted voice dialogue in your field training your brain to answer fluently.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                    <span>{isRtl ? 'دخول المقابلة الحقيقية بهدوء واسترخاء بعد خوض 3 بروفات كاملة.' : 'Entering your real interview calm and composed, treated like rehearsal #4.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                    <span>{isRtl ? 'تقرير تقييم شامل فوري يوضح نقاط القوة والضعف بدقة مذهلة.' : 'Instant, granular scorecard detailing strengths and exact improvements.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                    <span>{isRtl ? 'سيرة ذاتية ذكية مطابقة لمعايير الـ ATS تضاعف فرصة استدعائك.' : 'ATS-optimized CV that bypasses filters and triples your interview calls.'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            5. CORE FEATURES (#features)
        ══════════════════════════════════════════ */}
        <section id="features" style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                {isRtl ? 'كل ما تحتاجه لتخطي المقابلة بنجاح في مجالك' : 'Everything You Need in One Unified Platform'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {isRtl ? 'من لحظة صياغة السيرة الذاتية حتى استلام العرض الوظيفي' : 'From dossier formulation to post-interview performance audit'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {[
                {
                  icon: faMicrophone,
                  color: 'var(--c-coral)',
                  title: isRtl ? 'صوت بشري فائق السرعة' : 'Realtime Voice Engine',
                  desc: isRtl
                    ? 'ردود صوتية في أقل من ثانية عبر محركات عصبية، لتتحدث بحرية كأنك في مكالمة Zoom حقيقية مع مدير توظيف خبير.'
                    : 'Sub-second neural voice response powered by Cartesia Sonic for authentic live conversational rhythm.',
                },
                {
                  icon: faFileLines,
                  color: 'var(--c-navy)',
                  title: isRtl ? 'محرر CV ذكي ومتوافق مع ATS' : 'Smart ATS CV Dossier',
                  desc: isRtl
                    ? 'صياغة ذكية لخبراتك في أي مهنة مع قياس فوري لمدى توافقها مع روبوتات الفرز العالمية، وتصدير PDF احترافي.'
                    : 'Contextual builder and ATS keyword scanner to ensure your dossier passes automated screening.',
                },
                {
                  icon: faComments,
                  color: 'var(--c-coral)',
                  title: isRtl ? 'حوار حر غير مكرر' : 'Dynamic Unscripted Dialogue',
                  desc: isRtl
                    ? 'المحاور يقرأ كل سطر في خبراتك ومجالك ويبني مساراً مختلفاً لكل شخص، فلا توجد أسئلة محفوظة أو مسبقة الصنع.'
                    : 'Context-grounded probing that tailors unique interview paths based on your actual achievements.',
                },
                {
                  icon: faChartSimple,
                  color: 'var(--c-navy)',
                  title: isRtl ? 'تقارير تقييم فورية شاملة' : 'Granular Performance Reports',
                  desc: isRtl
                    ? 'تحليل شامل لعمق الإجابة، المهارات التخصصية، الثقة بالنفس، مع اقتراحات عملية لرفع نسبة قبولك.'
                    : 'In-depth assessment covering communication, domain mastery, confidence, and specific action items.',
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="card"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 20,
                    padding: '1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: 'rgba(232,130,90,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: f.color,
                      fontSize: '1.35rem',
                    }}
                  >
                    <FontAwesomeIcon icon={f.icon} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.45rem', fontSize: '1.1rem', fontWeight: 800 }}>{f.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            6. HOW IT WORKS (#how-it-works)
        ══════════════════════════════════════════ */}
        <section id="how-it-works" style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                {isRtl ? 'كيف تعمل منصة Prova؟' : 'How Prova Works in 3 Easy Steps'}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                {
                  num: '01',
                  title: isRtl ? 'ابنِ سيرتك الذاتية أو استورد ملفك' : 'Build or Import Your CV',
                  desc: isRtl
                    ? 'أدخل بياناتك وخبراتك في أي مجال، والمنصة تصيغ ملفك المهني بشكل احترافي متوافق مع معايير الـ ATS.'
                    : 'Input your background in any profession, and the platform formats it into an ATS-compliant dossier.',
                },
                {
                  num: '02',
                  title: isRtl ? 'اختر محاورك وادخل غرفة المقابلة الحية' : 'Pick Your Lead & Enter the Live Room',
                  desc: isRtl
                    ? 'اختر المقابلة التخصصية مع أحمد أو السلوكية مع سارة، وتحدث بالصوت في غرفة محاكاة واقعية بدون تأخير.'
                    : 'Select domain screening with Ahmed or behavioral fit with Sara, speaking live in our meeting stage.',
                },
                {
                  num: '03',
                  title: isRtl ? 'استلم تقرير أدائك الفوري ونقاط التحسين' : 'Receive Your Scorecard & Roadmap',
                  desc: isRtl
                    ? 'احصل على تحليل كامل لكل إجابة، أخطاءك الشائعة، ودرجات التقييم لتدخل مقابلتك الحقيقية بكل ثقة.'
                    : 'Review detailed grades across technical and soft skills, complete with tailored improvement tips.',
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className="card"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 20,
                    padding: '1.75rem 2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 16,
                      background: idx === 1 ? 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))' : 'rgba(232,130,90,0.12)',
                      color: idx === 1 ? '#fff' : 'var(--c-coral)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      flexShrink: 0,
                      boxShadow: idx === 1 ? 'var(--shadow-coral)' : 'none',
                    }}
                  >
                    {step.num}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', fontWeight: 800 }}>{step.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            7. CANDIDATE REVIEWS & TESTIMONIALS (Diverse)
        ══════════════════════════════════════════ */}
        <section id="reviews" style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                {isRtl ? 'مرشحون من كافة التخصصات حصلوا على وظائفهم' : 'Candidates Across All Sectors Who Landed Offers'}
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {[
                {
                  name: isRtl ? 'د. مروان سمير' : 'Dr. Marwan Samir',
                  role: isRtl ? 'طبيب مقيم @ مستشفى دار الفؤاد' : 'Medical Resident @ Dar Al Fouad',
                  avatar: 'م',
                  color: '#2A9D8F',
                  quote: isRtl
                    ? 'كنت خايف من أسئلة سيناريوهات الطوارئ في مقابلة المستشفى. خضت مقابلتين على بروفا، والأسئلة كانت مطابقة تماماً للمواقف الواقعية اللي سألوني فيها!'
                    : 'I was nervous about clinical triage scenarios in my hospital board interview. Prova asked accurate situational cases and boosted my confidence completely.',
                },
                {
                  name: isRtl ? 'ريهام مصطفى' : 'Reham Moustafa',
                  role: isRtl ? 'رئيس حسابات ومالية @ مجموعة استثمارية' : 'Chief Accountant @ Investment Group',
                  avatar: 'ر',
                  color: '#E8825A',
                  quote: isRtl
                    ? 'المحاور سألني في تفاصيل القوائم المالية وإدارة التدفقات النقدية بدقة أذهلتني! التقرير النهائي وضح لي إزاي أصيغ خفض التكاليف بالأرقام.'
                    : 'The AI grilled me on cash flow cycles and budgeting. The report showed me exactly how to articulate financial savings with metrics.',
                },
                {
                  name: isRtl ? 'أحمد الشناوي' : 'Ahmed El-Shenawy',
                  role: isRtl ? 'مدير مبيعات وتطوير أعمال @ الرياض' : 'Sales Lead @ Riyadh',
                  avatar: 'أ',
                  color: '#E76F51',
                  quote: isRtl
                    ? 'سرعة الرد الصوتي والمناقشة في إغلاق الصفقات والتفاوض مع العملاء خلتني مستعد لأصعب أسئلة الإدارة. دخلت المقابلة واثق وجالي العرض.'
                    : 'Instant voice responses and realistic negotiation roleplay prepared me for the toughest questions. Received the offer within days.',
                },
                {
                  name: isRtl ? 'نورين الشامي' : 'Nourine El-Shamy',
                  role: isRtl ? 'مشرفة تربوية ومعلمة @ مدرسة دولية' : 'Academic Lead @ International School',
                  avatar: 'ن',
                  color: '#1B2A41',
                  quote: isRtl
                    ? 'سارة ناقشتني في استراتيجيات التعليم المتمايز والتعامل مع أولياء الأمور. حسيت إني في مقابلة حقيقية مع إدارة المدرسة.'
                    : 'Sara questioned me on differentiated learning and parental communication. Felt exactly like a real school board interview.',
                },
              ].map((rev, i) => (
                <div
                  key={i}
                  className="card"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 20,
                    padding: '1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 3, color: '#f59e0b', fontSize: '0.85rem' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <FontAwesomeIcon key={s} icon={faStar} />
                    ))}
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.65, fontStyle: 'italic' }}>
                    «{rev.quote}»
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: rev.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                      {rev.avatar}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>{rev.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{rev.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            8. FREQUENTLY ASKED QUESTIONS (#faq)
        ══════════════════════════════════════════ */}
        <section id="faq" style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                {isRtl ? 'الأسئلة الأكثر شيوعاً' : 'Everything You Need to Know'}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="card"
                    style={{
                      background: 'var(--bg-base)',
                      border: isOpen ? '1px solid var(--c-coral)' : '1px solid var(--border-default)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      style={{
                        width: '100%',
                        padding: '1.25rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        border: 'none',
                        textAlign: isRtl ? 'right' : 'left',
                        cursor: 'pointer',
                        gap: '1rem',
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: '0.96rem', color: isOpen ? 'var(--c-coral)' : 'var(--text-primary)' }}>
                        {faq.q}
                      </span>
                      <FontAwesomeIcon
                        icon={isOpen ? faChevronUp : faChevronDown}
                        style={{ color: isOpen ? 'var(--c-coral)' : 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}
                      />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 1.5rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65, borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            9. FINAL CONVERSION CTA BANNER
        ══════════════════════════════════════════ */}
        <section style={{ padding: '5.5rem 1.5rem', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 840, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{
                background: 'linear-gradient(135deg, #1B2A41 0%, #223755 100%)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xl)',
              }}
              className="cta-banner-box"
            >
              {/* Decorative Glow */}
              <div
                style={{
                  position: 'absolute',
                  top: -80,
                  right: -80,
                  width: 260,
                  height: 260,
                  borderRadius: '50%',
                  background: 'rgba(232,130,90,0.22)',
                  filter: 'blur(50px)',
                }}
              />

              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(232,130,90,0.18)', color: 'var(--c-coral)', fontSize: '1.75rem', marginBottom: '1.25rem' }}>
                <FontAwesomeIcon icon={faRocket} />
              </div>

              <h2 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)', fontWeight: 900, margin: '0 0 0.85rem' }}>
                {isRtl ? 'جاهز لبروفـتك الحقيقية في تخصصك؟' : 'Ready for your professional rehearsal?'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 2rem' }}>
                {isRtl
                  ? 'مهما كانت وظيفتك أو تخصصك، لا تجعل أول مقابلة حقيقية تكون أول تجربة لصوتك. انضم إلى آلاف المهنيين وتدرّب مجاناً الآن.'
                  : 'Whatever your profession, never let your real interview be your first dry run. Join thousands of candidates and rehearse for free.'}
              </p>

              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link
                  to={user ? "/services" : "/auth?mode=signup"}
                  className="btn btn-primary btn-xl"
                  style={{ gap: '0.65rem', padding: '0.85rem 2.4rem', fontSize: '1rem', fontWeight: 800 }}
                >
                  <span>{user ? (isRtl ? 'الدخول إلى مركز الخدمات' : 'Go to Services Hub') : (isRtl ? 'ابدأ تجربتك المجانية الآن' : 'Start Free Now')}</span>
                  <FontAwesomeIcon icon={arrowIcon} />
                </Link>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
                {[
                  isRtl ? 'مجاني بالكامل' : '100% Free',
                  isRtl ? 'لكافة التخصصات' : 'All professions supported',
                  isRtl ? 'بدون بطاقة ائتمان' : 'No credit card needed',
                  isRtl ? 'جلسة فورية في ثوانٍ' : 'Instant onboarding',
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ color: 'var(--c-coral)' }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        @media (max-width: 992px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 2.5rem !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .interviewers-grid { grid-template-columns: 1fr !important; }
          .comparison-grid { grid-template-columns: 1fr !important; }

          /* ── Centering Hero Content & Buttons on Mobile & Tablets ── */
          .hero-text-col {
            align-items: center !important;
            text-align: center !important;
          }
          .hero-eyebrow-container {
            display: flex !important;
            justify-content: center !important;
            width: 100% !important;
          }
          .hero-eyebrow {
            justify-content: center !important;
            text-align: center !important;
          }
          .hero-headline {
            text-align: center !important;
          }
          .hero-subtitle {
            text-align: center !important;
            margin-inline: auto !important;
          }
          .hero-actions {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            gap: 0.75rem !important;
          }
          .hero-actions .btn {
            width: 100% !important;
            max-width: 380px !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .hero-social-proof {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            margin: 0 auto !important;
            gap: 0.5rem !important;
          }
          .hero-avatars-row {
            justify-content: center !important;
          }
          .hero-stars-row {
            justify-content: center !important;
          }
          .hero-rating-box {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; gap: 0.6rem !important; }
        }
      `}</style>
    </div>
  );
}
