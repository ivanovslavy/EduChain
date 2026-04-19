import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'bg', label: 'BG' },
  { code: 'es', label: 'ES' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();

  const switchTo = (code: string) => {
    i18n.changeLanguage(code);
    if (lang) {
      const newPath = location.pathname.replace(`/${lang}`, `/${code}`);
      navigate(newPath);
    } else {
      navigate(`/${code}`);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => switchTo(l.code)}
          className="px-2 py-1 text-xs rounded"
          style={{
            background: i18n.language === l.code ? 'var(--bg-tertiary)' : 'transparent',
            color: i18n.language === l.code ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
