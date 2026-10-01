import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast, { Toaster } from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import './i18n/index.js';

// Pages
import Landing      from './pages/Landing';
import Auth         from './pages/Auth';
import CvBuilder    from './pages/CvBuilder';
import CvEditor     from './pages/CvEditor';
import ServicesHub  from './pages/ServicesHub';
import InterviewRoom from './pages/InterviewRoom';
import Report       from './pages/Report';
import Settings     from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AtsScore     from './pages/AtsScore';

import { useLocation } from 'react-router-dom';
import logoImg from './assets/logo.png';

import BannedScreen from './components/security/BannedScreen';

/* ── Reusable Full Page Brand Loader ── */
function FullPageLoader({ message }) {
  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
      }}>
        <img
          src={logoImg}
          alt="Prova"
          onError={(e) => { e.currentTarget.src = '/logo.png'; }}
          style={{
            height: '42px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))',
          }}
        />
        <div style={{
          width: 28,
          height: 28,
          border: '2.5px solid var(--border-subtle)',
          borderTopColor: 'var(--c-coral)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        {message && (
          <p style={{
            fontSize: '0.88rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
            margin: 0,
          }}>
            {message}
          </p>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Auth & Security Guard ── */
function Protected({ user, children }) {
  const location = useLocation();
  const [profileStatus, setProfileStatus] = useState({ loading: true, isBanned: false, banReason: '' });

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_banned, ban_reason')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfileStatus({
          loading: false,
          isBanned: !!data?.is_banned,
          banReason: data?.ban_reason || '',
        });
      })
      .catch(() => {
        setProfileStatus({ loading: false, isBanned: false, banReason: '' });
      });
  }, [user]);

  if (!user) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?mode=login&redirect=${redirectUrl}`} replace />;
  }

  if (profileStatus.loading) {
    return <FullPageLoader />;
  }

  if (profileStatus.isBanned) {
    return <BannedScreen user={user} banReason={profileStatus.banReason} />;
  }

  return children;
}

/* ── CV Gate ── (redirect to cv-builder if no CV) ── */
function CvGate({ user, children }) {
  const [hasCv, setHasCv] = useState(null);
  useEffect(() => {
    if (!user) return;
    supabase.from('cvs').select('id').eq('user_id', user.id).limit(1)
      .then(({ data }) => setHasCv(!!(data && data.length > 0)))
      .catch(() => setHasCv(true)); // fallback if query fails
  }, [user]);

  if (hasCv === null) {
    return <FullPageLoader />;
  }

  if (!hasCv) return <Navigate to="/cv-builder" replace />;
  return children;
}

/* ── Admin Guard ── (Strictly requires authenticated user with role === 'admin' in database) ── */
function AdminProtected({ user, children }) {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(null); // null = verifying

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const userEmail = (user.email || '').toLowerCase();
    const isOwner = 
      userEmail === 'mohamed.saad.allam777@gmail.com' ||
      userEmail === 'admin@prova.ai';

    supabase.from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && (data?.role === 'admin' || isOwner)) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          localStorage.removeItem('prova_super_admin');
        }
      })
      .catch(() => {
        setIsAdmin(isOwner);
        if (!isOwner) localStorage.removeItem('prova_super_admin');
      });
  }, [user]);

  if (!user) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?mode=login&redirect=${redirectUrl}`} replace />;
  }

  if (isAdmin === null) {
    return <FullPageLoader />;
  }

  // Strict 403 Forbidden: No backdoor or passcodes
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        padding: '1.5rem',
      }}>
        <div className="card card-elevated" style={{
          maxWidth: 440,
          width: '100%',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', margin: '0 auto 1.25rem',
          }}>
            🚫
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            403 — غير مصرح بالدخول
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
            هذه المنطقة مخصصة لإدارة منصة Prova فقط. حسابك الحالي لا يمتلك صلاحيات المشرف.
          </p>
          <button
            onClick={() => window.location.href = '/services'}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          >
            العودة للمنصة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(undefined); // undefined = loading
  const [userRole, setUserRole] = useState(null);

  // ── Init: apply saved theme & lang ──
  useEffect(() => {
    const savedTheme = localStorage.getItem('prova_theme') || 'light';
    const savedLang  = localStorage.getItem('prova_lang')  || 'ar';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.dir  = savedLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = savedLang;
    i18n.changeLanguage(savedLang);
  }, []);

  // ── Sync global platform API keys from Supabase ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('platform_settings')
      .select('*')
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          data.forEach((item) => {
            if (item.key === 'cartesia_api_key' && item.value) {
              localStorage.setItem('prova_cartesia_api_key', item.value);
            } else if (item.key === 'groq_api_key' && item.value) {
              localStorage.setItem('prova_groq_api_key', item.value);
            } else if (item.key === 'gemini_api_key' && item.value) {
              localStorage.setItem('prova_gemini_api_key', item.value);
            }
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── Auth listener ──
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null);
      return;
    }

    // 1. Immediately restore session from localStorage (works across all tabs)
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.warn('Auth getSession error:', error);
      setUser(data?.session?.user ?? null);
    });

    // 2. Listen for auth state changes across this tab AND other tabs
    //    (storage events from other tabs will trigger SIGNED_IN / SIGNED_OUT here)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          setUser(session?.user ?? null);
          break;
        case 'SIGNED_OUT':
          setUser(null);
          break;
        case 'INITIAL_SESSION':
          // Fired on mount with the persisted session — keeps new tabs in sync
          setUser(session?.user ?? null);
          break;
        default:
          if (session?.user) setUser(session.user);
          else if (!session) setUser(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Sync profile settings & role after login ──
  useEffect(() => {
    if (!user) {
      setUserRole(null);
      localStorage.removeItem('prova_super_admin');
      return;
    }
    const userEmail = (user.email || '').toLowerCase();
    const isOwner = 
      userEmail === 'mohamed.saad.allam777@gmail.com' ||
      userEmail === 'admin@prova.ai';

    supabase.from('profiles')
      .select('preferred_lang, theme, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const isAdmin = data?.role === 'admin' || isOwner;
        const role = isAdmin ? 'admin' : 'user';
        setUserRole(role);
        if (!isAdmin) {
          localStorage.removeItem('prova_super_admin');
        }
        if (data?.preferred_lang) {
          i18n.changeLanguage(data.preferred_lang);
          document.documentElement.dir  = data.preferred_lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = data.preferred_lang;
          localStorage.setItem('prova_lang', data.preferred_lang);
        }
        if (data?.theme) {
          document.documentElement.setAttribute('data-theme', data.theme);
          localStorage.setItem('prova_theme', data.theme);
        }
      })
      .catch(() => {
        setUserRole(isOwner ? 'admin' : 'user');
        if (!isOwner) localStorage.removeItem('prova_super_admin');
      });
  }, [user]);

  // Loading state
  if (user === undefined) {
    return <FullPageLoader />;
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            boxShadow: 'var(--shadow-md)',
          },
          success: {
            iconTheme: { primary: 'var(--c-coral)', secondary: '#fff' },
          },
        }}
      />

      <Routes>
        {/* Public Landing (Adaptive for both guests and authenticated users) */}
        <Route path="/" element={<Landing user={user} userRole={userRole} />} />
        <Route path="/landing" element={<Landing user={user} userRole={userRole} />} />
        <Route path="/home" element={<Landing user={user} userRole={userRole} />} />
        <Route path="/auth" element={
          user ? (userRole === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/services" replace />) : <Auth />
        } />

        {/* Protected - no CV required */}
        <Route path="/cv-builder" element={
          <Protected user={user}>
            <CvBuilder user={user} />
          </Protected>
        } />

        {/* Protected - requires CV */}
        <Route path="/services" element={
          <Protected user={user}>
            <CvGate user={user}>
              <ServicesHub user={user} />
            </CvGate>
          </Protected>
        } />

        <Route path="/cv-editor" element={
          <Protected user={user}>
            <CvEditor user={user} />
          </Protected>
        } />

        <Route path="/ats-score" element={
          <Protected user={user}>
            <CvGate user={user}>
              <AtsScore user={user} />
            </CvGate>
          </Protected>
        } />

        <Route path="/interview" element={
          <Protected user={user}>
            <InterviewRoom user={user} />
          </Protected>
        } />

        <Route path="/report/:id" element={
          <Protected user={user}>
            <Report user={user} />
          </Protected>
        } />

        <Route path="/reports" element={
          <Protected user={user}>
            <Report user={user} />
          </Protected>
        } />

        <Route path="/settings" element={
          <Protected user={user}>
            <Settings user={user} />
          </Protected>
        } />

        <Route path="/admin" element={
          <AdminProtected user={user}>
            <AdminDashboard user={user} />
          </AdminProtected>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
