import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFloppyDisk,
  faArrowLeft,
  faArrowRight,
  faCircleInfo,
  faPrint,
  faMicrophone,
  faPenToSquare,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/layout/Header';
import ExactCvTemplate from '../components/cv/ExactCvTemplate';
import toast from 'react-hot-toast';

const DEFAULT_CV_DATA = {
  name: 'Alex Morgan',
  jobTitle: 'Senior Software Engineer & Team Lead',
  address: 'Cairo, Egypt',
  contact: 'alex.morgan@example.com | +20 100 123 4567',
  links: 'linkedin.com/in/alexmorgan | github.com/alexmorgan',
  careerObjective: 'Results-driven Senior Software Engineer with 7+ years of experience architecting high-throughput distributed systems and leading cross-functional engineering teams to accelerate feature delivery by 40%.',
  careerHistory: [
    {
      title: 'Senior Software Engineer & Team Lead',
      company: 'Tech Horizons Global',
      location: 'Cairo, Egypt',
      dates: 'Jan 2022 – Present',
      duties: [
        'Architected distributed microservices backend reducing system latency by 35% across 250K+ daily active users.',
        'Engineered automated CI/CD deployment pipelines, shortening release cycles from 2 weeks to under 4 hours.',
        'Led a cross-functional team of 6 engineers to deliver enterprise client platform 3 weeks ahead of schedule.',
        'Optimized PostgreSQL database query execution plans, slashing server memory consumption by 28%.',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'Digital Core Systems',
      location: 'Alexandria, Egypt',
      dates: 'Jun 2019 – Dec 2021',
      duties: [
        'Developed RESTful API endpoints and authentication services handling 1.5M+ requests per month.',
        'Refactored legacy monolith codebase into modular services, improving maintainability score by 45%.',
        'Collaborated with product designers to build responsive interfaces, increasing conversion rate by 18%.',
      ],
    },
  ],
  technicalSkills: 'JavaScript (ES6+), TypeScript, React, Node.js, Python, PostgreSQL, REST APIs, Docker, Git, AWS',
  methodologies: 'Agile/Scrum, CI/CD, Test-Driven Development (TDD), System Architecture, Microservices',
  coreCompetencies: 'Cross-Functional Leadership, Problem Solving, Analytical Thinking, Performance Optimization',
  educationList: [
    {
      degree: 'Bachelor of Science in Computer Science',
      institution: 'Cairo University',
      dates: '2015 – 2019',
      grade: 'Very Good with Honors (GPA 3.7/4.0)',
    },
  ],
  projectsCertifications: [
    {
      title: 'AWS Certified Solutions Architect – Associate',
      issuer: 'Amazon Web Services (AWS)',
      date: '2023',
      detail: 'Demonstrated deep expertise in scalable cloud architecture, IAM security, and resilient VPC network design.',
    },
    {
      title: 'Real-Time Enterprise Telemetry Pipeline',
      issuer: 'Production Open-Source Project',
      date: '2022',
      detail: 'Built high-throughput data processing pipeline capable of handling 50,000 telemetry events per second.',
    },
  ],
};

export default function CvEditor({ user }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRtl = i18n.language === 'ar';
  const backIcon = isRtl ? faArrowRight : faArrowLeft;

  const [cvData, setCvData] = useState(DEFAULT_CV_DATA);
  const [cvId, setCvId] = useState(null);
  const [saving, setSaving] = useState(false);
  const suggestions = location.state?.suggestions;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('cvs')
        .select('id, raw_text, formatted_html')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setCvId(data.id);
        if (data.raw_text && data.raw_text.startsWith('{')) {
          try {
            const parsed = JSON.parse(data.raw_text);
            setCvData(prev => ({ ...prev, ...parsed }));
          } catch (_e) {}
        }
      }
    };
    load();
  }, [user]);

  const handleFieldChange = (fieldPath, value) => {
    setCvData(prev => {
      const next = { ...prev };
      next[fieldPath] = value;
      return next;
    });
  };

  const handleSave = async (silent = false) => {
    if (!user) return;
    setSaving(true);
    try {
      const serializedJson = JSON.stringify(cvData);
      const summaryText = `${cvData.name}\n${cvData.jobTitle}\n${cvData.address} | ${cvData.contact}`;

      if (cvId) {
        await supabase.from('cvs').update({
          raw_text: serializedJson,
          formatted_html: summaryText,
          updated_at: new Date().toISOString(),
        }).eq('id', cvId);
      } else {
        const { data: newCv } = await supabase.from('cvs').insert({
          user_id: user.id,
          source: 'editor',
          raw_text: serializedJson,
          formatted_html: summaryText,
          lang: isRtl ? 'ar' : 'en',
        }).select('id').single();
        if (newCv) setCvId(newCv.id);
      }
      if (!silent) toast.success(isRtl ? 'تم حفظ السيرة الذاتية بنجاح ✓' : 'CV saved successfully ✓');
    } catch (err) {
      console.error('Save error:', err);
      if (!silent) toast.error(isRtl ? 'حدث خطأ أثناء الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    handleSave(true);
    window.print();
  };

  return (
    <div className="page-container" style={{ minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <Header user={user} />

      <main style={{ flex: 1, padding: '1.5rem 1rem 4rem', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        
        {/* ── Toolbar ── */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--bg-surface)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-xl, 20px)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ gap: '0.4rem' }}>
              <FontAwesomeIcon icon={backIcon} />
              <span>{t('common.back')}</span>
            </button>
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>
              {isRtl ? 'محرر السيرة الذاتية القياسي' : 'Standard CV Template Editor'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => navigate('/cv-builder')}
              className="btn btn-ghost btn-sm"
              style={{ gap: '0.45rem', color: '#1B8A5A' }}
            >
              <FontAwesomeIcon icon={faMicrophone} />
              <span>{isRtl ? 'المساعد الصوتي' : 'Voice Assistant'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="btn btn-primary btn-sm"
              style={{ gap: '0.45rem', padding: '0.55rem 1.15rem' }}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span>{isRtl ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleSave(false)}
              disabled={saving}
              style={{ gap: '0.4rem' }}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />
              <span>{saving ? t('common.loading') : t('common.save')}</span>
            </button>
          </div>
        </div>

        {/* ── AI Suggestions Banner ── */}
        {suggestions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card no-print"
            style={{
              marginBottom: '1.25rem',
              padding: '1rem 1.25rem',
              borderInlineStart: '3px solid #1B8A5A',
              background: 'rgba(27, 138, 90, 0.08)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <FontAwesomeIcon icon={faCircleInfo} style={{ color: '#1B8A5A', flexShrink: 0, marginTop: 4, fontSize: '1.1rem' }} />
              <div>
                <p style={{ fontWeight: 800, marginBottom: '0.3rem', color: '#1B8A5A' }}>
                  {isRtl ? 'توصيات واقتراحات تحسين السيرة الذاتية' : 'AI Optimization Suggestions'}
                </p>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>
                  {suggestions}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Instruction Note */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }} className="no-print">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
            {isRtl ? '💡 انقر مباشرة على أي نص داخل القالب لتعديله أو حذفه أو إضافة بياناتك.' : '💡 Click directly on any text in the template below to edit.'}
          </p>
        </div>

        {/* ── The Exact 2-Page CV Document ── */}
        <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
          <ExactCvTemplate
            data={cvData}
            onChange={handleFieldChange}
            editable={true}
            isRtl={isRtl}
          />
        </div>

      </main>
    </div>
  );
}
