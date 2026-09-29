import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faSun, faMoon, faRightFromBracket, faUser } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import toast from 'react-hot-toast';

export default function Settings({ user }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;

  const [theme, setTheme] = useState(localStorage.getItem('prova_theme') || 'light');
  const [profile, setProfile] = useState({ full_name: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
    });
  }, [user]);

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('prova_theme', newTheme);
    if (user) {
      supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
    }
  };

  const toggleLang = (newLang) => {
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
    localStorage.setItem('prova_lang', newLang);
    if (user) {
      supabase.from('profiles').update({ preferred_lang: newLang }).eq('id', user.id);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('prova_super_admin');
    await supabase.auth.signOut();
    navigate('/');
    toast.success(isRtl ? 'تم تسجيل الخروج' : 'Logged out successfully');
  };

  const sections = [
    {
      title: t('settings.language'),
      icon: <FontAwesomeIcon icon={faGlobe} style={{ fontSize: '1.25rem', color: 'var(--c-coral)' }} />,
      content: (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ar', 'en'].map((l) => (
            <button
              key={l}
              onClick={() => toggleLang(l)}
              className={`btn btn-sm ${lang === l ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {l === 'ar' ? t('settings.arabic') : t('settings.english')}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: t('settings.theme'),
      icon: theme === 'light' ? (
        <FontAwesomeIcon icon={faSun} style={{ fontSize: '1.25rem', color: 'var(--c-coral)' }} />
      ) : (
        <FontAwesomeIcon icon={faMoon} style={{ fontSize: '1.25rem', color: 'var(--c-coral)' }} />
      ),
      content: (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['light', 'dark'].map((th) => (
            <button
              key={th}
              onClick={() => toggleTheme(th)}
              className={`btn btn-sm ${theme === th ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, justifyContent: 'center', gap: '0.4rem' }}
            >
              <FontAwesomeIcon icon={th === 'light' ? faSun : faMoon} style={{ fontSize: '0.875rem' }} />
              {th === 'light' ? t('settings.light') : t('settings.dark')}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <Header user={user} />

      <main style={{ flex: 1, padding: '2rem 1rem 4rem', maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '2rem' }}
        >
          {t('settings.title')}
        </motion.h1>

        {/* Profile */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card"
            style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.2rem', fontWeight: 700, flexShrink: 0,
            }}>
              {profile.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p style={{ fontWeight: 700 }}>{profile.full_name || '—'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{profile.email}</p>
            </div>
          </motion.div>
        )}

        {/* Settings Sections */}
        {sections.map((sec, i) => (
          <motion.div
            key={sec.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="card"
            style={{ padding: '1.25rem 1.5rem', marginBottom: '0.75rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
              {sec.icon}
              <h3 style={{ fontSize: '0.95rem' }}>{sec.title}</h3>
            </div>
            {sec.content}
          </motion.div>
        ))}

        {/* Logout */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              className="btn btn-ghost"
              onClick={handleLogout}
              style={{ width: '100%', color: '#E53E3E', borderColor: '#E53E3E', justifyContent: 'center', marginTop: '1rem', gap: '0.5rem' }}
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
              {t('settings.logout')}
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
