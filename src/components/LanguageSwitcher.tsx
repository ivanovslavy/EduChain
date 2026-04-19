import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { FlagEN, FlagBG, FlagES } from './icons';

interface LangOpt {
  code: 'en' | 'bg' | 'es';
  label: string;
  short: string;
  Flag: typeof FlagEN;
}

const LANGS: LangOpt[] = [
  { code: 'en', label: 'English',    short: 'EN', Flag: FlagEN },
  { code: 'bg', label: 'Български',  short: 'BG', Flag: FlagBG },
  { code: 'es', label: 'Español',    short: 'ES', Flag: FlagES },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0];

  const switchTo = (code: LangOpt['code']) => {
    i18n.changeLanguage(code);
    if (lang) {
      navigate(location.pathname.replace(`/${lang}`, `/${code}`));
    } else {
      navigate(`/${code}`);
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % LANGS.length); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => (i - 1 + LANGS.length) % LANGS.length); }
      if (e.key === 'Enter')     { e.preventDefault(); switchTo(LANGS[activeIdx].code); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, activeIdx]);

  useEffect(() => {
    if (open) setActiveIdx(LANGS.findIndex((l) => l.code === current.code));
  }, [open, current.code]);

  const CurrentFlag = current.Flag;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs"
        style={{
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${current.label}`}
      >
        <CurrentFlag size={18} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{current.short}</span>
        <ChevronDownIcon className="w-3 h-3" style={{ transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 mt-2 z-50 min-w-[180px] rounded-lg py-1"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            {LANGS.map((l, idx) => {
              const isActive = l.code === current.code;
              const isHovered = idx === activeIdx;
              const Flag = l.Flag;
              return (
                <li key={l.code} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => switchTo(l.code)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className="w-full inline-flex items-center gap-3 px-3 py-2 text-sm text-left"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--color-accent-info) 10%, transparent)'
                        : isHovered
                        ? 'var(--bg-secondary)'
                        : 'transparent',
                      color: 'var(--text-primary)',
                      borderRadius: 0,
                      transition: 'background 120ms',
                    }}
                  >
                    <Flag size={20} />
                    <span className="flex-1">{l.label}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{l.short}</span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
