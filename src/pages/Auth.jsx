import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEye,
  faEyeSlash,
  faEnvelope,
  faLock,
  faUser,
  faArrowRight,
  faArrowLeft,
  faCheckCircle,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';
import logoImg from '../assets/logo.png';
import toast from 'react-hot-toast';

export default function Auth() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') || 'login';
  const isRtl = i18n.language === 'ar';
  const ArrowIcon = isRtl ? faArrowLeft : faArrowRight;

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectParam = params.get('redirect');
  const targetRedirect = (redirectParam && redirectParam.startsWith('/')) ? redirectParam : null;

  // Listen for OAuth error in URL hash or query params
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : '');
    const searchParams = new URLSearchParams(search);

    const errCode = hashParams.get('error') || searchParams.get('error');
    const errDesc = hashParams.get('error_description') || searchParams.get('error_description');

    if (errDesc || errCode) {
      const decoded = decodeURIComponent((errDesc || errCode).replace(/\+/g, ' '));
      if (decoded.includes('provider is not enabled') || decoded.includes('unsupported_provider') || decoded.includes('validation_failed')) {
        setError(
          isRtl
            ? 'تنبيه: تسجيل الدخول عبر Google يتطلب تفعيل Google Provider في لوحة تحكم Supabase Dashboard.'
            : 'Google sign-in requires enabling Google Provider in your Supabase Dashboard.'
        );
      } else {
        setError(decoded);
      }
    }
  }, [isRtl]);

  const setMode = (newMode) => {
    setError('');
    const newParams = new URLSearchParams(params);
    newParams.set('mode', newMode);
    setParams(newParams);
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { full_name: form.name.trim() } },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Initialize user profile
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: form.name.trim(),
            email: form.email.trim(),
            role: 'user',
            preferred_lang: i18n.language,
          }, { onConflict: 'id' }).catch(() => {});
        }

        toast.success(
          isRtl
            ? 'مرحباً بك في Prova! تم إنشاء حسابك بنجاح، جاري تحضير مسار المقابلات...'
            : 'Welcome to Prova! Account created, setting up your career path...'
        );

        // Smooth journey routing: if targetRedirect exists use it, otherwise take them directly to services
        setTimeout(() => {
          window.location.href = targetRedirect || '/services';
        }, 300);

      } else {
        // ── Sign In ──
        const emailLower = form.email.toLowerCase().trim();

        const authRes = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });

        if (authRes.error) {
          throw authRes.error;
        }

        // Check user role
        if (authRes.data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_banned, ban_reason')
            .eq('id', authRes.data.user.id)
            .single();

          if (profile?.is_banned) {
            toast.error(
              isRtl
                ? `الحساب معلق: ${profile.ban_reason || 'يرجى مراجعة إدارة المنصة'}`
                : `Account suspended: ${profile.ban_reason || 'Contact admin'}`
            );
            setLoading(false);
            return;
          }

          const isOwner = emailLower === 'mohamed.saad.allam777@gmail.com' || emailLower === 'admin@prova.ai';
          if (profile?.role === 'admin' || isOwner) {
            toast.success(isRtl ? 'مرحباً بك يا مدير المنصة! جارٍ التوجيه للوحة الإدارة...' : 'Welcome Admin! Opening Admin Hub...');
            window.location.href = targetRedirect || '/admin';
            return;
          } else {
            localStorage.removeItem('prova_super_admin');
          }
        }

        toast.success(isRtl ? 'تم تسجيل الدخول بنجاح! مرحباً بعودتك' : 'Signed in successfully! Welcome back');
        setTimeout(() => {
          window.location.href = targetRedirect || '/services';
        }, 200);
      }
    } catch (err) {
      setError(err.message || (isRtl ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const destination = targetRedirect || '/services';
      const redirectUrl = `${window.location.origin}${destination}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
          setError(
            isRtl
              ? 'تنبيه: مزود Google يتطلب إدخال Client ID و Client Secret في لوحة Supabase وتفعيله.'
              : 'Google sign-in requires enabling Google Provider with Client ID & Secret in Supabase Dashboard.'
          );
        } else {
          setError(error.message);
        }
        toast.error(error.message);
      }
    } catch (err) {
      setError(err.message || (isRtl ? 'حدث خطأ في الاتصال بجوجل' : 'Google sign-in connection failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(232,130,90,0.08) 0%, var(--bg-base) 75%)',
        position: 'relative',
      }}
    >

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ width: '100%', maxWidth: '450px' }}
      >
        <div
          className="card card-elevated"
          style={{
            padding: '2.5rem 2rem',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Logo & Headline */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <Link to="/" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
              <img
                src={logoImg}
                alt="Prova"
                style={{
                  width: 76,
                  height: 76,
                  objectFit: 'contain',
                }}
              />
            </Link>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
              {mode === 'login' ? (isRtl ? 'تسجيل الدخول إلى Prova' : 'Sign in to Prova') : (isRtl ? 'إنشاء حساب جديد' : 'Create your account')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              {mode === 'login'
                ? (isRtl ? 'ادخل لمتابعة مسارك المهني والتدرب على المقابلات' : 'Access your AI career hub and interview practice')
                : (isRtl ? 'ابدأ رحلتك لتطوير مسارك المهني والمحاكاة الذكية' : 'Start your journey to interview mastery')}
            </p>
          </div>

          {/* Interactive Mode Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.3rem',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setMode('login')}
              style={{
                flex: 1,
                padding: '0.6rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: mode === 'login' ? 'var(--bg-surface)' : 'transparent',
                color: mode === 'login' ? 'var(--c-coral-dark)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: mode === 'login' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              style={{
                flex: 1,
                padding: '0.6rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: mode === 'signup' ? 'var(--bg-surface)' : 'transparent',
                color: mode === 'signup' ? 'var(--c-coral-dark)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: mode === 'signup' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isRtl ? 'حساب جديد' : 'New Account'}
            </button>
          </div>

          {/* Google OAuth */}
          <button
            className="btn"
            style={{
              width: '100%',
              marginBottom: '1.25rem',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.75rem',
              border: '1.5px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: (googleLoading || loading) ? 'not-allowed' : 'pointer',
              opacity: (googleLoading || loading) ? 0.75 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            type="button"
          >
            {googleLoading ? (
              <div
                style={{
                  width: 18,
                  height: 18,
                  border: '2px solid var(--border-subtle)',
                  borderTopColor: 'var(--c-coral)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>
              {googleLoading
                ? (isRtl ? 'جارٍ الاتصال بـ Google...' : 'Connecting to Google...')
                : mode === 'signup'
                ? (isRtl ? 'التسجيل بواسطة Google' : 'Sign up with Google')
                : (isRtl ? 'الدخول بواسطة Google' : 'Sign in with Google')}
            </span>
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <hr className="divider" style={{ flex: 1, margin: 0 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>{t('auth.orWith')}</span>
            <hr className="divider" style={{ flex: 1, margin: 0 }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('auth.nameLabel')}</label>
                  <div style={{ position: 'relative' }}>
                    <FontAwesomeIcon
                      icon={faUser}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        insetInlineStart: '0.9rem',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                        fontSize: 14,
                      }}
                    />
                    <input
                      className="input"
                      style={{ paddingInlineStart: '2.5rem', borderRadius: 'var(--radius-md)' }}
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder={t('auth.namePlaceholder')}
                      required
                      autoComplete="name"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="label" style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('auth.emailLabel')}</label>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon
                  icon={faEnvelope}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    insetInlineStart: '0.9rem',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                    fontSize: 14,
                  }}
                />
                <input
                  className="input"
                  style={{ paddingInlineStart: '2.5rem', borderRadius: 'var(--radius-md)' }}
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="label" style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{t('auth.passwordLabel')}</label>
                {mode === 'login' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--c-coral)', cursor: 'pointer', fontWeight: 600 }}>
                    {t('auth.forgotPassword')}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon
                  icon={faLock}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    insetInlineStart: '0.9rem',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                    fontSize: 14,
                  }}
                />
                <input
                  className="input"
                  style={{ paddingInlineStart: '2.5rem', paddingInlineEnd: '2.8rem', borderRadius: 'var(--radius-md)' }}
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    insetInlineEnd: '0.85rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '0.2rem',
                  }}
                >
                  <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} style={{ fontSize: 14 }} />
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  color: '#EB5757',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  padding: '0.5rem 0',
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                justifyContent: 'center',
                gap: '0.6rem',
                padding: '0.8rem',
                borderRadius: 'var(--radius-lg)',
                fontWeight: 800,
                fontSize: '1rem',
              }}
            >
              {loading
                ? (isRtl ? 'جارٍ المعالجة والتوجيه...' : 'Processing...')
                : mode === 'login'
                ? t('auth.loginBtn')
                : t('auth.signupBtn')}
              {!loading && <FontAwesomeIcon icon={ArrowIcon} style={{ fontSize: 14 }} />}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
