import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import logoImg from '../../assets/logo.png';

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        padding: '1.75rem 1.5rem',
        marginTop: 'auto',
      }}
    >
      <div
        className="footer-inner"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        {/* Real Logo Image */}
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          title="Prova"
        >
          <img
            src={logoImg}
            alt="Prova Logo"
            style={{
              height: 48,
              width: 'auto',
              maxHeight: 48,
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.06))',
              transition: 'transform 0.2s ease',
            }}
          />
        </Link>

        {/* Attribution & Copyright */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', textAlign: 'center' }}>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.88rem',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              fontWeight: 600,
              flexWrap: 'wrap',
            }}
          >
            <span>Crafted & Developed with</span>
            <FontAwesomeIcon icon={faHeart} style={{ fontSize: 13, color: 'var(--c-coral)' }} />
            <span>by <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>Eng. Mohamed Saad</strong></span>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
            © {year} Prova. All rights reserved.
          </p>
        </div>

        {/* Legal Links */}
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <a
            href="#"
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.84rem',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            }}
          >
            {t('auth.terms')}
          </a>
          <a
            href="#"
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.84rem',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            }}
          >
            {t('auth.privacy')}
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .footer-inner {
            flex-direction: column !important;
            justify-content: center !important;
            text-align: center !important;
            gap: 1.1rem !important;
          }
        }
      `}</style>
    </footer>
  );
}
