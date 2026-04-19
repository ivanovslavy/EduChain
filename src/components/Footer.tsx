import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import GembaLogo from './GembaLogo';

export default function Footer() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t" style={{ borderColor: 'var(--border-color)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <GembaLogo className="w-6 h-6" />
          <span className="text-sm">EduChain — {t('footer.tagline', 'by GEMBA IT')}</span>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to={`/${lang}/about`} style={{ color: 'var(--text-secondary)' }}>{t('nav.about', 'About')}</Link>
          <Link to={`/${lang}/contact`} style={{ color: 'var(--text-secondary)' }}>{t('nav.contact', 'Contact')}</Link>
          <a href="https://gembait.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>gembait.com</a>
        </nav>

        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>© {year} GEMBA IT</span>
      </div>
    </footer>
  );
}
