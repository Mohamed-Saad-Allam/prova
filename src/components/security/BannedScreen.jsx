import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faEnvelope, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../../lib/supabaseClient';

export default function BannedScreen({ user, banReason }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
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
        maxWidth: 520,
        width: '100%',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#EF4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8rem', margin: '0 auto 1.25rem',
        }}>
          <FontAwesomeIcon icon={faBan} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: '#EF4444' }}>
          {isRtl ? 'تم تعليق هذا الحساب مؤقتاً' : 'Account Temporarily Suspended'}
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {isRtl
            ? 'تم إيقاف صلاحية الوصول لخدمات المنصة وإجراء المقابلات لهذا الحساب بناءً على تقرير الإدارة.'
            : 'Access to mock interview services has been suspended for this account by platform administration.'}
        </p>

        <div style={{
          background: 'var(--bg-subtle)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          textAlign: isRtl ? 'right' : 'left',
          marginBottom: '1.75rem',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            {isRtl ? 'سبب التعليق المحدد:' : 'Suspension Reason:'}
          </div>
          <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            {banReason || (isRtl ? 'مخالفة شروط الاستخدام أو الإساءة في المقابلات' : 'Violation of platform terms')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontFamily: 'monospace' }}>
            User ID: {user?.id}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <a
            href="mailto:support@prova.ai"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
          >
            <FontAwesomeIcon icon={faEnvelope} />
            <span>{isRtl ? 'التواصل مع الدعم الفني لتقديم التماس' : 'Contact Support / Appeal'}</span>
          </a>

          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>{isRtl ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
