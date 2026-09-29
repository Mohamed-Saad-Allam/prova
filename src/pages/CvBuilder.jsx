import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faPenToSquare,
  faUpload,
  faPrint,
  faFloppyDisk,
  faPlay,
  faRotateRight,
  faEye,
  faComments,
  faWandMagicSparkles,
  faCheck,
  faFileLines,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';
import { parseAndGenerateUploadedCV } from '../lib/llm';
import Header from '../components/layout/Header';
import ExactCvTemplate from '../components/cv/ExactCvTemplate';
import VoiceCvAssistant from '../components/cv/VoiceCvAssistant';
import toast from 'react-hot-toast';

const INITIAL_CV_DATA = {
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

export default function CvBuilder({ user }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const [activeMode, setActiveMode] = useState('voice'); // 'voice' | 'editor' | 'upload'
  const [cvData, setCvData] = useState(() => {
    try {
      const savedDraft = localStorage.getItem('prova_cv_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') return { ...INITIAL_CV_DATA, ...parsed };
      }
    } catch (_e) {}
    return INITIAL_CV_DATA;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedCvId, setSavedCvId] = useState(null);

  // Auto-sync draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('prova_cv_draft', JSON.stringify(cvData));
    } catch (_e) {}
  }, [cvData]);

  // Load existing CV data from Supabase only on initial mount if draft is empty
  useEffect(() => {
    if (!user?.id) return;
    const fetchExistingCv = async () => {
      try {
        const { data: cvs } = await supabase
          .from('cvs')
          .select('id, raw_text, formatted_html')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (cvs && cvs.length > 0) {
          setSavedCvId(cvs[0].id);
          const hasDraft = !!localStorage.getItem('prova_cv_draft');
          if (!hasDraft && cvs[0].raw_text && cvs[0].raw_text.startsWith('{')) {
            try {
              const parsed = JSON.parse(cvs[0].raw_text);
              setCvData(prev => ({ ...prev, ...parsed }));
            } catch (_e) {}
          }
        }
      } catch (_err) {}
    };
    fetchExistingCv();
  }, [user?.id]);

  // Update specific fields of CV
  const handleUpdateCvData = (updates) => {
    setCvData(prev => {
      const next = {
        ...prev,
        ...updates,
      };
      try {
        localStorage.setItem('prova_cv_draft', JSON.stringify(next));
      } catch (_e) {}
      return next;
    });
  };

  const handleFieldChange = (fieldPath, value) => {
    setCvData(prev => {
      const next = { ...prev };
      next[fieldPath] = value;
      try {
        localStorage.setItem('prova_cv_draft', JSON.stringify(next));
      } catch (_e) {}
      return next;
    });
  };

  // Save CV to Supabase
  const handleSaveCv = async (silent = false) => {
    if (!user) {
      if (!silent) toast.error(isRtl ? 'يرجى تسجيل الدخول أولاً' : 'Please log in first');
      return;
    }
    setSaving(true);
    try {
      const serializedJson = JSON.stringify(cvData);
      const summaryText = `${cvData.name}\n${cvData.jobTitle}\n${cvData.address} | ${cvData.contact}\n\nObjective:\n${cvData.careerObjective}\n\nCompetencies:\n${(cvData.professionalCompetencies || []).join('\n')}\n\nExperience:\n${(cvData.careerHistory || []).map(j => `${j.title} at ${j.company}`).join('\n')}`;

      if (savedCvId) {
        await supabase.from('cvs').update({
          raw_text: serializedJson,
          formatted_html: summaryText,
          updated_at: new Date().toISOString(),
        }).eq('id', savedCvId);
      } else {
        const { data: newCv } = await supabase.from('cvs').insert({
          user_id: user.id,
          source: 'voice_builder',
          raw_text: serializedJson,
          formatted_html: summaryText,
          lang: isRtl ? 'ar' : 'en',
        }).select('id').single();
        if (newCv) setSavedCvId(newCv.id);
      }
      if (!silent) toast.success(isRtl ? 'تم حفظ السيرة الذاتية بنجاح ✓' : 'CV saved successfully ✓');
    } catch (err) {
      console.error('Save CV error:', err);
      if (!silent) toast.error(isRtl ? 'حدث خطأ أثناء الحفظ' : 'Failed to save CV');
    } finally {
      setSaving(false);
    }
  };

  // Direct Print
  const handlePrint = () => {
    handleSaveCv(true);
    window.print();
  };

  // Upload existing CV file
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading(isRtl ? 'جارٍ قراءة وتحليل ملف السيرة الذاتية واستخراج البيانات بالذكاء الاصطناعي...' : 'Extracting and parsing CV with AI...');
    try {
      const res = await parseAndGenerateUploadedCV(file, user?.id, isRtl ? 'ar' : 'en');
      if (res?.structuredCv) {
        setCvData(prev => {
          const next = {
            ...prev,
            ...res.structuredCv,
            careerHistory: Array.isArray(res.structuredCv.careerHistory) && res.structuredCv.careerHistory.length > 0
              ? res.structuredCv.careerHistory
              : prev.careerHistory,
            educationList: Array.isArray(res.structuredCv.educationList) && res.structuredCv.educationList.length > 0
              ? res.structuredCv.educationList
              : prev.educationList,
            projectsCertifications: Array.isArray(res.structuredCv.projectsCertifications) && res.structuredCv.projectsCertifications.length > 0
              ? res.structuredCv.projectsCertifications
              : prev.projectsCertifications,
          };
          try {
            localStorage.setItem('prova_cv_draft', JSON.stringify(next));
          } catch (_e) {}
          return next;
        });

        // If user logged in, persist to Supabase
        if (user?.id) {
          try {
            await supabase.from('cvs').insert({
              user_id: user.id,
              source: 'file_upload',
              raw_text: JSON.stringify(res.structuredCv),
              formatted_html: res.raw_text || '',
              lang: 'en',
            });
          } catch (_dbErr) {}
        }
      }
      toast.success(isRtl ? 'تم استخراج السيرة الذاتية بنجاح ونقلها بالكامل للقالب القياسي! 🎉' : 'CV parsed and loaded into template! 🎉', { id: toastId });
      setActiveMode('editor');
    } catch (err) {
      console.error('Upload CV parse error:', err);
      toast.error(err.message || (isRtl ? 'حدث خطأ أثناء معالجة الملف' : 'Failed to parse file'), { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-container" style={{ minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <Header user={user} />

      <main style={{ flex: 1, padding: '1.5rem 1rem 4rem', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        
        {/* ── Top Bar: Title & Mode Switcher & Global Actions ── */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
            background: 'var(--bg-surface)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-xl, 20px)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveMode('voice')}
              className={`btn btn-sm ${activeMode === 'voice' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ gap: '0.45rem', padding: '0.55rem 1rem' }}
            >
              <FontAwesomeIcon icon={faMicrophone} />
              <span>{isRtl ? 'المساعد الصوتي والشات' : 'Voice & Chat Assistant'}</span>
            </button>

            <button
              onClick={() => setActiveMode('editor')}
              className={`btn btn-sm ${activeMode === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ gap: '0.45rem', padding: '0.55rem 1rem' }}
            >
              <FontAwesomeIcon icon={faPenToSquare} />
              <span>{isRtl ? 'المعاينة والتحرير المباشر للقالب' : 'Live Template Editor'}</span>
            </button>

            <button
              onClick={() => setActiveMode('upload')}
              className={`btn btn-sm ${activeMode === 'upload' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ gap: '0.45rem', padding: '0.55rem 1rem' }}
            >
              <FontAwesomeIcon icon={faUpload} />
              <span>{isRtl ? 'رفع ملف سيرة ذاتية' : 'Upload Existing CV'}</span>
            </button>
          </div>

          {/* Master Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={handlePrint}
              className="btn btn-primary btn-sm"
              style={{ gap: '0.45rem', padding: '0.55rem 1.15rem' }}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span>{isRtl ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
            </button>

            <button
              onClick={() => handleSaveCv(false)}
              disabled={saving}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.45rem', padding: '0.55rem 1rem' }}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />
              <span>{saving ? (isRtl ? 'جارٍ الحفظ...' : 'Saving...') : (isRtl ? 'حفظ السيرة' : 'Save CV')}</span>
            </button>

            <button
              onClick={() => {
                handleSaveCv(true);
                navigate('/services');
              }}
              className="btn btn-ghost btn-sm"
              style={{ gap: '0.45rem', color: 'var(--c-coral)', padding: '0.55rem 1rem' }}
            >
              <FontAwesomeIcon icon={faPlay} />
              <span>{isRtl ? 'بدء مقابلة بهذه السيرة' : 'Start Mock Interview'}</span>
            </button>
          </div>
        </div>

        {/* ── Main Work Area ── */}
        <div style={{ width: '100%' }}>
          
          {/* 1. Voice & Chat Assistant Split View */}
          {activeMode === 'voice' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '1.5rem',
              alignItems: 'flex-start',
            }}>
              {/* Left: WhatsApp Voice Chat Assistant */}
              <div className="no-print" style={{ position: 'sticky', top: '1.5rem' }}>
                <VoiceCvAssistant
                  cvData={cvData}
                  onUpdateCvData={handleUpdateCvData}
                  onComplete={() => {
                    toast.success(isRtl ? 'اكتملت السيرة الذاتية! يمكنك الآن مراجعتها وطباعتها.' : 'CV ready for review and print!');
                    setActiveMode('editor');
                  }}
                  isRtl={isRtl}
                />
              </div>

              {/* Right: Live Updating Exact Template Preview */}
              <div style={{ overflowX: 'auto', paddingBottom: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '0.75rem' }} className="no-print">
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {isRtl ? '⚡ المعاينة الحية للقالب (يتم تحديثه في الوقت الفعلي أثناء حديثك):' : '⚡ Live Real-time Template Preview:'}
                  </span>
                </div>
                <ExactCvTemplate
                  data={cvData}
                  onChange={handleFieldChange}
                  editable={true}
                  isRtl={isRtl}
                />
              </div>
            </div>
          )}

          {/* 2. Direct Template Editor (Full Width) */}
          {activeMode === 'editor' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                className="no-print"
                style={{
                  maxWidth: 820,
                  width: '100%',
                  background: 'rgba(27, 138, 90, 0.08)',
                  border: '1px solid rgba(27, 138, 90, 0.25)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#1B8A5A' }}>
                  <FontAwesomeIcon icon={faPenToSquare} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    {isRtl ? 'وضع التعديل اليدوي المباشر: انقر على أي نص في القالب لتعديله مباشرة.' : 'Direct Editing Mode: Click on any text inside the template to edit.'}
                  </span>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '0.45rem' }}
                >
                  <FontAwesomeIcon icon={faPrint} />
                  <span>{isRtl ? 'طباعة القالب الآن' : 'Print Template Now'}</span>
                </button>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                <ExactCvTemplate
                  data={cvData}
                  onChange={handleFieldChange}
                  editable={true}
                  isRtl={isRtl}
                />
              </div>
            </div>
          )}

          {/* 3. Upload File Mode */}
          {activeMode === 'upload' && (
            <div className="no-print" style={{ maxWidth: 640, margin: '2rem auto' }}>
              <div
                className="card card-elevated"
                style={{
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-xl, 20px)',
                  border: '2px dashed var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.25rem',
                }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(27, 138, 90, 0.12)', color: '#1B8A5A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem',
                }}>
                  <FontAwesomeIcon icon={faUpload} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
                    {isRtl ? 'ارفع سيرتك الذاتية الحالية لتحويلها للقالب القياسي' : 'Upload CV to convert to standard template'}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {isRtl ? 'يدعم ملفات PDF و Word والنصوص. سيقوم الذكاء الاصطناعي باستخراج البيانات وملء القالب بدقة.' : 'Supports PDF, Word, and text files. AI will parse and fill the template.'}
                  </p>
                </div>

                <label
                  className="btn btn-primary"
                  style={{ cursor: 'pointer', padding: '0.75rem 1.75rem', gap: '0.6rem' }}
                >
                  <FontAwesomeIcon icon={faUpload} />
                  <span>{uploading ? (isRtl ? 'جارٍ التحليل...' : 'Parsing...') : (isRtl ? 'اختر ملف السيرة الذاتية' : 'Choose File')}</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
