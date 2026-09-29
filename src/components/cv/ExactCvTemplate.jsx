import React, { useRef } from 'react';

/**
 * ExactCvTemplate — ATS-Certified Single-Column Executive CV Template
 * 
 * Strict ATS & Design Standards:
 * 1. Single-column layout (no tables, no multi-columns, clean structure)
 * 2. Optional candidate profile photo upload with instant preview
 * 3. Standard section hierarchy: Contact Info → Professional Summary → Work Experience → Skills → Education → Projects/Certifications
 * 4. 100% English & LTR alignment
 * 5. Single font family ('Inter', sans-serif) with weight hierarchy
 * 6. Single accent color: Prova Brand Navy (#0f2b48 / #1e3a8a)
 * 7. Thin bottom divider line under headings
 * 8. Live inline editing (contentEditable) & text-based selectable A4 print export
 */
export default function ExactCvTemplate({
  data,
  onChange,
  editable = false,
}) {
  const d = data || {};
  const photoInputRef = useRef(null);

  const handleTextChange = (path, value) => {
    if (!onChange || !editable) return;
    onChange(path, value);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        handleTextChange('photoUrl', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    handleTextChange('photoUrl', null);
  };

  const navyColor = '#0f2b48'; // Prova Brand Navy
  const textColor = '#111827'; // Dark charcoal text
  const mutedColor = '#4b5563'; // Medium gray
  const dividerStyle = {
    borderBottom: '1.5px solid #0f2b48',
    paddingBottom: '3px',
    marginBottom: '8px',
  };

  const headerTitleStyle = {
    fontSize: '0.88rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: navyColor,
    margin: '0 0 6px 0',
    display: 'block',
    ...dividerStyle,
  };

  return (
    <div
      className="exact-cv-wrapper"
      dir="ltr"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        direction: 'ltr',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      {/* Hidden Photo File Input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        style={{ display: 'none' }}
      />

      {/* ════════════════════════════════════════════════════════════════
          PAGE 1 (A4: 210mm x 297mm) — ATS Single-Column Document
          ════════════════════════════════════════════════════════════════ */}
      <div
        className="exact-cv-page exact-cv-page-1"
        dir="ltr"
        style={{
          width: '100%',
          maxWidth: '210mm',
          minHeight: '297mm',
          backgroundColor: '#ffffff',
          color: textColor,
          padding: '20mm 20mm 20mm',
          boxShadow: '0 4px 25px rgba(0, 0, 0, 0.08)',
          borderRadius: '2px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          direction: 'ltr',
          textAlign: 'left',
        }}
      >
        {/* ── 1. HEADER (Contact Info & Optional Profile Photo) ── */}
        <header
          style={{
            marginBottom: '14px',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.25rem',
          }}
        >
          <div style={{ flex: 1 }}>
            <h1
              contentEditable={editable}
              suppressContentEditableWarning
              onBlur={(e) => handleTextChange('name', e.currentTarget.textContent)}
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: navyColor,
                margin: '0 0 2px 0',
                outline: 'none',
                lineHeight: 1.2,
              }}
            >
              {d.name || 'Your Full Name'}
            </h1>

            <div
              contentEditable={editable}
              suppressContentEditableWarning
              onBlur={(e) => handleTextChange('jobTitle', e.currentTarget.textContent)}
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#2563eb',
                marginBottom: '5px',
                outline: 'none',
              }}
            >
              {d.jobTitle || 'TARGET JOB TITLE'}
            </div>

            <div
              contentEditable={editable}
              suppressContentEditableWarning
              onBlur={(e) => handleTextChange('contact', e.currentTarget.textContent)}
              style={{
                fontSize: '0.82rem',
                color: mutedColor,
                lineHeight: 1.4,
                outline: 'none',
              }}
            >
              {[
                d.address || 'City, Country',
                d.contact || 'email@example.com | +20 1xx xxx xxxx',
                d.links || 'linkedin.com/in/username | github.com/username',
              ]
                .filter(Boolean)
                .join('  •  ')}
            </div>
          </div>

          {/* Profile Photo Area */}
          {d.photoUrl ? (
            <div
              style={{
                position: 'relative',
                flexShrink: 0,
                width: 72,
                height: 72,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid #0f2b48',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: editable ? 'pointer' : 'default',
              }}
              onClick={() => editable && photoInputRef.current?.click()}
              title={editable ? 'انقر لتغيير الصورة' : undefined}
            >
              <img
                src={d.photoUrl}
                alt={d.name || 'Profile'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {editable && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="no-print"
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title="حذف الصورة"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            editable && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="no-print"
                style={{
                  flexShrink: 0,
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  border: '1.5px dashed #cbd5e1',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '4px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
                title="إضافة صورة شخصية اختيارية للـ CV"
              >
                <span style={{ fontSize: '1.1rem' }}>📷</span>
                <span>+ Photo</span>
              </button>
            )
          )}
        </header>

        {/* ── 2. PROFESSIONAL SUMMARY (Max 2 lines) ── */}
        <section style={{ marginBottom: '14px' }}>
          <h2 style={headerTitleStyle}>PROFESSIONAL SUMMARY</h2>
          <p
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={(e) => handleTextChange('careerObjective', e.currentTarget.textContent)}
            style={{
              fontSize: '0.83rem',
              lineHeight: 1.45,
              color: textColor,
              margin: 0,
              outline: 'none',
              textAlign: 'left',
            }}
          >
            {d.careerObjective ||
              'Results-driven Professional with proven track record in architecting scalable solutions, optimizing operational workflows, and driving measurable business growth across cross-functional teams.'}
          </p>
        </section>

        {/* ── 3. WORK EXPERIENCE (3-5 bullet points starting with strong past action verbs & metrics) ── */}
        <section style={{ marginBottom: '14px' }}>
          <h2 style={headerTitleStyle}>WORK EXPERIENCE</h2>

          {(
            d.careerHistory || [
              {
                title: 'Senior Software Engineer',
                company: 'Tech Solutions Corp',
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
                company: 'Digital Systems Ltd',
                location: 'Alexandria, Egypt',
                dates: 'Jun 2019 – Dec 2021',
                duties: [
                  'Developed RESTful API endpoints and authentication services handling 1.5M+ requests per month.',
                  'Refactored legacy monolith codebase into modular services, improving maintainability score by 45%.',
                  'Collaborated with product designers to build responsive interfaces, increasing conversion rate by 18%.',
                ],
              },
            ]
          ).map((job, jIdx) => (
            <div key={jIdx} style={{ marginBottom: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updated = [...(d.careerHistory || [])];
                      updated[jIdx] = { ...updated[jIdx], title: e.currentTarget.textContent };
                      handleTextChange('careerHistory', updated);
                    }}
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: navyColor,
                      outline: 'none',
                    }}
                  >
                    {job.title || 'Job Title'}
                  </span>
                  <span style={{ color: mutedColor, fontSize: '0.82rem' }}>|</span>
                  <span
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updated = [...(d.careerHistory || [])];
                      updated[jIdx] = { ...updated[jIdx], company: e.currentTarget.textContent };
                      handleTextChange('careerHistory', updated);
                    }}
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: textColor,
                      outline: 'none',
                    }}
                  >
                    {job.company || 'Company Name'}
                  </span>
                  {job.location && (
                    <span
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updated = [...(d.careerHistory || [])];
                        updated[jIdx] = { ...updated[jIdx], location: e.currentTarget.textContent };
                        handleTextChange('careerHistory', updated);
                      }}
                      style={{ fontSize: '0.8rem', color: mutedColor, outline: 'none' }}
                    >
                      ({job.location})
                    </span>
                  )}
                </div>

                <span
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const updated = [...(d.careerHistory || [])];
                    updated[jIdx] = { ...updated[jIdx], dates: e.currentTarget.textContent };
                    handleTextChange('careerHistory', updated);
                  }}
                  style={{
                    fontSize: '0.8rem',
                    color: mutedColor,
                    fontWeight: 500,
                    outline: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {job.dates || 'Dates'}
                </span>
              </div>

              <ul
                style={{
                  margin: '4px 0 0 0',
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                {(
                  job.duties || [
                    'Spearheaded core feature development, increasing user engagement by 25%.',
                    'Streamlined database queries, reducing response times by 30%.',
                  ]
                ).map((duty, dIdx) => (
                  <li
                    key={dIdx}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updated = [...(d.careerHistory || [])];
                      const newDuties = [...(updated[jIdx]?.duties || [])];
                      newDuties[dIdx] = e.currentTarget.textContent;
                      updated[jIdx] = { ...updated[jIdx], duties: newDuties };
                      handleTextChange('careerHistory', updated);
                    }}
                    style={{
                      fontSize: '0.82rem',
                      lineHeight: 1.45,
                      color: textColor,
                      outline: 'none',
                    }}
                  >
                    {duty}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ── 4. SKILLS (Single Column, Categorized, No Multi-Column Grids) ── */}
        <section style={{ marginBottom: '14px' }}>
          <h2 style={headerTitleStyle}>SKILLS</h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '0.82rem',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: navyColor }}>Technical Skills:</span>
              <span
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange('technicalSkills', e.currentTarget.textContent)}
                style={{ outline: 'none', color: textColor }}
              >
                {d.technicalSkills ||
                  (Array.isArray(d.professionalCompetencies)
                    ? d.professionalCompetencies.join(' • ')
                    : 'JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, REST APIs, Docker, Git')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: navyColor }}>Methodologies & Tools:</span>
              <span
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange('methodologies', e.currentTarget.textContent)}
                style={{ outline: 'none', color: textColor }}
              >
                {d.methodologies ||
                  'Agile/Scrum, CI/CD, Test-Driven Development (TDD), System Architecture, Cloud Deployment (AWS)'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: navyColor }}>Core Competencies:</span>
              <span
                contentEditable={editable}
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange('coreCompetencies', e.currentTarget.textContent)}
                style={{ outline: 'none', color: textColor }}
              >
                {d.coreCompetencies ||
                  (Array.isArray(d.personalCompetencies)
                    ? d.personalCompetencies.join(' • ')
                    : 'Cross-Functional Leadership, Problem Solving, Analytical Thinking, Performance Optimization')}
              </span>
            </div>
          </div>
        </section>

        {/* ── 5. EDUCATION ── */}
        <section style={{ marginBottom: '14px' }}>
          <h2 style={headerTitleStyle}>EDUCATION</h2>

          {(
            d.educationList || [
              {
                degree: d.universityQualifications?.[0]?.degree || "Bachelor of Science in Computer Science",
                institution: d.universityName || "Cairo University",
                dates: d.universityQualifications?.[0]?.dates || "2017 – 2021",
                grade: d.universityQualifications?.[0]?.grade || "Excellent with Honors",
              },
            ]
          ).map((edu, eIdx) => (
            <div key={eIdx} style={{ marginBottom: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <div>
                  <span
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updated = [...(d.educationList || [])];
                      updated[eIdx] = { ...updated[eIdx], degree: e.currentTarget.textContent };
                      handleTextChange('educationList', updated);
                    }}
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: navyColor,
                      outline: 'none',
                    }}
                  >
                    {edu.degree || 'Degree / Major'}
                  </span>
                  <span style={{ color: mutedColor, margin: '0 5px' }}>|</span>
                  <span
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updated = [...(d.educationList || [])];
                      updated[eIdx] = { ...updated[eIdx], institution: e.currentTarget.textContent };
                      handleTextChange('educationList', updated);
                    }}
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: textColor,
                      outline: 'none',
                    }}
                  >
                    {edu.institution || 'University Name'}
                  </span>
                  {edu.grade && (
                    <span
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updated = [...(d.educationList || [])];
                        updated[eIdx] = { ...updated[eIdx], grade: e.currentTarget.textContent };
                        handleTextChange('educationList', updated);
                      }}
                      style={{ fontSize: '0.8rem', color: mutedColor, marginLeft: '6px', outline: 'none' }}
                    >
                      ({edu.grade})
                    </span>
                  )}
                </div>

                <span
                  contentEditable={editable}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const updated = [...(d.educationList || [])];
                    updated[eIdx] = { ...updated[eIdx], dates: e.currentTarget.textContent };
                    handleTextChange('educationList', updated);
                  }}
                  style={{
                    fontSize: '0.8rem',
                    color: mutedColor,
                    fontWeight: 500,
                    outline: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {edu.dates || 'Dates'}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* ── 6. PROJECTS & CERTIFICATIONS (If available) ── */}
        <section style={{ marginBottom: '0' }}>
          <h2 style={headerTitleStyle}>PROJECTS & CERTIFICATIONS</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(
              d.projectsCertifications || [
                {
                  title: 'AWS Certified Solutions Architect – Associate',
                  issuer: 'Amazon Web Services (AWS)',
                  date: '2023',
                  detail: 'Demonstrated expertise in cloud architecture, security, and scalable infrastructure design.',
                },
                {
                  title: 'Enterprise Analytics Dashboard System',
                  issuer: 'Independent Project',
                  date: '2022',
                  detail: 'Built high-throughput real-time telemetry processing dashboard handling 50K events/sec.',
                },
              ]
            ).map((item, pIdx) => (
              <div key={pIdx} style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updated = [...(d.projectsCertifications || [])];
                        updated[pIdx] = { ...updated[pIdx], title: e.currentTarget.textContent };
                        handleTextChange('projectsCertifications', updated);
                      }}
                      style={{ fontWeight: 700, color: navyColor, outline: 'none' }}
                    >
                      {item.title}
                    </span>
                    {item.issuer && (
                      <>
                        <span style={{ color: mutedColor, margin: '0 4px' }}>–</span>
                        <span
                          contentEditable={editable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const updated = [...(d.projectsCertifications || [])];
                            updated[pIdx] = { ...updated[pIdx], issuer: e.currentTarget.textContent };
                            handleTextChange('projectsCertifications', updated);
                          }}
                          style={{ color: textColor, fontWeight: 500, outline: 'none' }}
                        >
                          {item.issuer}
                        </span>
                      </>
                    )}
                  </div>
                  {item.date && (
                    <span
                      contentEditable={editable}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updated = [...(d.projectsCertifications || [])];
                        updated[pIdx] = { ...updated[pIdx], date: e.currentTarget.textContent };
                        handleTextChange('projectsCertifications', updated);
                      }}
                      style={{ color: mutedColor, fontSize: '0.8rem', outline: 'none', whiteSpace: 'nowrap' }}
                    >
                      {item.date}
                    </span>
                  )}
                </div>
                {item.detail && (
                  <p
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const updated = [...(d.projectsCertifications || [])];
                      updated[pIdx] = { ...updated[pIdx], detail: e.currentTarget.textContent };
                      handleTextChange('projectsCertifications', updated);
                    }}
                    style={{ margin: '1px 0 0 0', color: mutedColor, outline: 'none' }}
                  >
                    {item.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Global Print Styles for Pure Text-Based Selectable PDF ── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          body, html {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, nav, .no-print, button, .voice-assistant-panel, .toast, [role="status"], [role="alert"] {
            display: none !important;
          }
          .page-container {
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            width: 100% !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            display: block !important;
          }
          .exact-cv-wrapper {
            display: block !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
          }
          .exact-cv-page {
            display: block !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .exact-cv-page h1, .exact-cv-page h2 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .exact-cv-page section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
