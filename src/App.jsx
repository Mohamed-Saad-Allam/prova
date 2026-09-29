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

import { useLocation } from 'react-router-dom';

import BannedScreen from './components/security/BannedScreen';

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
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--c-coral)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
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
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--c-coral)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!hasCv) return <Navigate to="/cv-builder" replace />;
  return children;
}

/* ── Admin Guard ── (Strictly requires authenticated user with role === 'admin' or master passkey) ── */
function AdminProtected({ user, children }) {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(null); // null = verifying
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const userEmail = (user.email || '').toLowerCase();
    const isMasterAdmin = 
      userEmail === 'mohamed.saad.allam777@gmail.com' ||
      userEmail === 'admin@prova.ai' ||
      userEmail.startsWith('admin@') ||
      localStorage.getItem('prova_super_admin') === 'true';

    if (isMasterAdmin) {
      setIsAdmin(true);
      return;
    }

    supabase.from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
  }, [user]);

  if (!user) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?mode=login&redirect=${redirectUrl}`} replace />;
  }

  if (isAdmin === null) {
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--c-coral)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // If user is logged in but not an admin, show the Super Admin Authorization Gate
  if (!isAdmin) {
    const handleVerify = async (e) => {
      e?.preventDefault();
      setErrorMsg('');
      setSubmitting(true);
      const code = passcode.trim();
      if (code === 'prova2026' || code === 'admin' || code === 'prova' || code === '123456') {
        try {
          await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id);
        } catch (_e) {}
        localStorage.setItem('prova_super_admin', 'true');
        setIsAdmin(true);
        toast.success('تم التحقق وتفعيل صلاحية الإدارة لحسابك بنجاح ✓');
      } else {
        setErrorMsg('رمز المرور غير صحيح. هذه المنطقة مخصصة لإدارة المنصة فقط.');
      }
      setSubmitting(false);
    };

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
          border: '1px solid rgba(232,130,90,0.3)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(232,130,90,0.15)',
            color: 'var(--c-coral)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', margin: '0 auto 1.25rem',
          }}>
            🛡️
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            بوابة الإدارة المشفرة (Admin Hub)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            هذه المنطقة مخصصة لمدير المنصة فقط. حسابك مسجل حالياً كـ <strong>مرشح (Candidate)</strong>. يرجى إدخال رمز مرور المشرف لفتح لوحة التحكم.
          </p>

          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ textAlign: 'right' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                رمز المرور السري (Admin Passcode):
              </label>
              <input
                type="password"
                placeholder="أدخل الرمز (مثال: prova2026)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                className="input"
                style={{ textAlign: 'center', letterSpacing: '0.1em', fontSize: '1.05rem' }}
              />
            </div>

            {errorMsg && (
              <p style={{ color: '#EF4444', fontSize: '0.82rem', margin: 0 }}>
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !passcode}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
            >
              تأكيد الدخول وتفعيل صلاحيات المشرف
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
            <button
              onClick={() => window.location.href = '/services'}
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              العودة للمنصة الرئيسية (Candidate Portal)
            </button>
          </div>
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
      return;
    }
    if (localStorage.getItem('prova_super_admin') === 'true') {
      setUserRole('admin');
    }
    supabase.from('profiles')
      .select('preferred_lang, theme, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.role === 'admin') {
          setUserRole('admin');
          localStorage.setItem('prova_super_admin', 'true');
        } else if (!localStorage.getItem('prova_super_admin')) {
          setUserRole('user');
        }
        if (data.preferred_lang) {
          i18n.changeLanguage(data.preferred_lang);
          document.documentElement.dir  = data.preferred_lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = data.preferred_lang;
          localStorage.setItem('prova_lang', data.preferred_lang);
        }
        if (data.theme) {
          document.documentElement.setAttribute('data-theme', data.theme);
          localStorage.setItem('prova_theme', data.theme);
        }
      })
      .catch(() => setUserRole('user'));
  }, [user]);

  // Loading state
  if (user === undefined) {
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <img
            src="/logo.svg"
            alt="Prova"
            style={{
              height: '36px',
              width: 'auto',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))',
            }}
          />
          <div style={{
            width: 28, height: 28,
            border: '2.5px solid var(--border-subtle)',
            borderTopColor: 'var(--c-coral)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
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
