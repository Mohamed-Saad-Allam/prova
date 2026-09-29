import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSun,
  faMoon,
  faGlobe,
  faBars,
  faXmark,
  faRightFromBracket,
  faUser,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../../lib/supabaseClient';

import logoImg from '../../assets/logo.png';

export default function Header({ user }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('prova_theme') || 'light');
  const [scrolled, setScrolled] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // ── Sync user role ──
  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    if (localStorage.getItem('prova_super_admin') === 'true') {
      setUserRole('admin');
    }
    supabase.from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.role === 'admin' || localStorage.getItem('prova_super_admin') === 'true') {
          setUserRole('admin');
        } else {
          setUserRole('user');
        }
      })
      .catch(() => {});
  }, [user]);

  // ── Scroll shadow ──
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Theme toggle ──
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('prova_theme', next);
  };

  // ── Language toggle ──
  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    localStorage.setItem('prova_lang', next);
  };

  // ── Logout ──
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: scrolled ? 'var(--bg-surface)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        transition: 'all var(--transition-base)',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <div
        className="main-content header-inner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          maxWidth: '1200px',
        }}
      >
        {/* ── Logo Image Only (Always links to Landing / Home) ── */}
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          title="Prova"
        >
          <img
            src={logoImg}
            alt="Prova Logo"
            className="header-logo"
            style={{
              width: 'auto',
              objectFit: 'contain',
              transition: 'transform 0.2s ease',
              filter: 'drop-shadow(0 2px 10px rgba(0, 0, 0, 0.08))',
            }}
          />
        </Link>

        {/* ── Desktop Nav ── */}
        <nav className="desktop-nav">
          {!user ? (
            <>
              <a href="#features" className="nav-link">
                {isRtl ? 'المميزات' : 'Features'}
              </a>
              <a href="#interviewers" className="nav-link">
                {isRtl ? 'المحاورون' : 'Interviewers'}
              </a>
              <a href="#how-it-works" className="nav-link">
                {isRtl ? 'كيف يعمل' : 'How it works'}
              </a>
              <a href="#faq" className="nav-link">
                {isRtl ? 'الأسئلة الشائعة' : 'FAQ'}
              </a>
            </>
          ) : (
            <>
              <Link to="/services" className="nav-link" style={{ fontWeight: 700, color: 'var(--c-coral)' }}>
                {isRtl ? 'مركز الخدمات' : 'Services Hub'}
              </Link>
              <Link to="/cv-editor" className="nav-link">
                {isRtl ? 'محرر الـ CV' : 'CV Editor'}
              </Link>
            </>
          )}

          {/* Admin Hub Shortcut Pill */}
          {userRole === 'admin' && (
            <Link
              to="/admin"
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(232,130,90,0.15), rgba(209,107,66,0.25))',
                color: 'var(--c-coral)',
                border: '1px solid rgba(232,130,90,0.4)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                boxShadow: '0 2px 8px rgba(232,130,90,0.15)',
              }}
              title={isRtl ? 'الانتقال إلى لوحة تحكم المشرف العام' : 'Open Admin Hub'}
            >
              <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 13 }} />
              <span>{isRtl ? 'لوحة الإدارة' : 'Admin Hub'}</span>
            </Link>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginInlineStart: '0.25rem' }}>
            <button
              className="btn btn-icon btn-ghost"
              onClick={toggleLang}
              title={i18n.language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
              style={{ fontSize: '0.78rem', fontWeight: 700, gap: 0 }}
            >
              {i18n.language === 'ar' ? 'EN' : 'ع'}
            </button>

            <button className="btn btn-icon btn-ghost" onClick={toggleTheme} title="Toggle theme">
              {theme === 'light' ? (
                <FontAwesomeIcon icon={faMoon} style={{ fontSize: 16 }} />
              ) : (
                <FontAwesomeIcon icon={faSun} style={{ fontSize: 16 }} />
              )}
            </button>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link to="/settings" className="btn btn-icon btn-ghost" title={t('settings.title')}>
                  <FontAwesomeIcon icon={faUser} style={{ fontSize: 16 }} />
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 14 }} />
                  {t('settings.logout')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link to="/auth?mode=login" className="btn btn-ghost btn-sm">
                  {t('nav.login')}
                </Link>
                <Link to="/auth?mode=signup" className="btn btn-primary btn-sm">
                  {t('nav.signup')}
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* ── Mobile Menu Toggle ── */}
        <button
          className="btn btn-icon btn-ghost mobile-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 20 }} />
          ) : (
            <FontAwesomeIcon icon={faBars} style={{ fontSize: 20 }} />
          )}
        </button>
      </div>

      {/* ── Mobile Menu ── */}
      {menuOpen && (
        <div
          style={{
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
            padding: '1rem 1.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {userRole === 'admin' && (
            <Link
              to="/admin"
              className="btn btn-primary btn-sm"
              onClick={() => setMenuOpen(false)}
              style={{ justifyContent: 'center', gap: '0.5rem' }}
            >
              <FontAwesomeIcon icon={faShieldHalved} />
              <span>{isRtl ? 'لوحة تحكم المشرف (Admin Hub)' : 'Admin Dashboard'}</span>
            </Link>
          )}

          {!user ? (
            <>
              <a href="#features" className="nav-link" onClick={() => setMenuOpen(false)}>
                {isRtl ? 'المميزات' : 'Features'}
              </a>
              <a href="#interviewers" className="nav-link" onClick={() => setMenuOpen(false)}>
                {isRtl ? 'المحاورون الذكيون' : 'Interviewers'}
              </a>
              <a href="#how-it-works" className="nav-link" onClick={() => setMenuOpen(false)}>
                {isRtl ? 'كيف تعمل المنصة' : 'How it works'}
              </a>
              <a href="#faq" className="nav-link" onClick={() => setMenuOpen(false)}>
                {isRtl ? 'الأسئلة الشائعة' : 'FAQ'}
              </a>
              <hr className="divider" style={{ margin: '0.5rem 0' }} />
            </>
          ) : (
            <>
              <Link to="/services" className="nav-link" onClick={() => setMenuOpen(false)} style={{ fontWeight: 700, color: 'var(--c-coral)' }}>
                {isRtl ? 'مركز الخدمات' : 'Services Hub'}
              </Link>
              <Link to="/cv-editor" className="nav-link" onClick={() => setMenuOpen(false)}>
                {isRtl ? 'محرر السيرة الذاتية' : 'CV Editor'}
              </Link>
              <hr className="divider" style={{ margin: '0.5rem 0' }} />
            </>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={toggleLang} style={{ flex: 1 }}>
              <FontAwesomeIcon icon={faGlobe} style={{ fontSize: 14 }} />
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleTheme} style={{ flex: 1 }}>
              <FontAwesomeIcon icon={theme === 'light' ? faMoon : faSun} style={{ fontSize: 14 }} />
              {theme === 'light' ? t('settings.dark') : t('settings.light')}
            </button>
          </div>

          {user ? (
            <>
              <Link to="/settings" className="btn btn-ghost" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faUser} style={{ fontSize: 15 }} />
                {t('settings.title')}
              </Link>
              <button className="btn btn-ghost" onClick={handleLogout}>
                <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 15 }} />
                {t('settings.logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/auth?mode=login" className="btn btn-ghost" onClick={() => setMenuOpen(false)}>
                {t('nav.login')}
              </Link>
              <Link to="/auth?mode=signup" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                {t('nav.signup')}
              </Link>
            </>
          )}
        </div>
      )}

      <style>{`
        .nav-link {
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.9rem;
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .nav-link:hover {
          color: var(--text-primary);
          background: var(--border-subtle);
        }
        .header-inner {
          min-height: 80px;
        }
        .header-logo {
          height: 56px;
          max-height: 56px;
        }
        .desktop-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .mobile-menu-btn {
          display: none;
        }

        @media (max-width: 992px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: inline-flex !important;
          }
          .header-inner {
            min-height: 60px !important;
          }
          .header-logo {
            height: 40px !important;
            max-height: 40px !important;
          }
        }
      `}</style>
    </header>
  );
}
