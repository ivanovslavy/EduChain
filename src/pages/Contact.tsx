import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  AcademicCapIcon, BookOpenIcon, ClockIcon,
  CheckCircleIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { ContactIcon } from '../components/icons';
import { useTheme } from '../context/ThemeContext';

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;
const CONTACT_EMAIL = 'contacts@gembait.com';

export default function Contact() {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData((d) => ({ ...d, [e.target.name]: e.target.value }));
  };

  const isValid = data.name.trim() && data.email.includes('@') && data.subject.trim() && data.message.trim().length >= 20 && token;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setStatus({ type: 'loading', text: t('contact.status.sending', 'Sending…') });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim(),
          subject: data.subject.trim(),
          message: data.message.trim(),
          website: data.website,
          turnstileToken: token,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setStatus({ type: 'success', text: t('contact.status.sent', 'Message sent. We respond within 48 hours.') });
        setData({ name: '', email: '', subject: '', message: '', website: '' });
        setToken(null);
      } else {
        throw new Error(body.error || 'send_failed');
      }
    } catch {
      setStatus({ type: 'error', text: t('contact.status.error', `Failed to send. Try again or email ${CONTACT_EMAIL}.`) });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold mb-2 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ContactIcon size={28} /> {t('contact.title', 'Contact EduChain')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('contact.subtitle', 'Partnerships, pilot programs, or platform questions.')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <InfoCard icon={AcademicCapIcon} title={t('contact.info.participate.title', 'Participate')}
            body={t('contact.info.participate.body', 'Schools and educators can run a pilot — we onboard your students and provide training.')} />
          <InfoCard icon={BookOpenIcon} title={t('contact.info.courses.title', 'Courses')}
            body={t('contact.info.courses.body', 'Web3 fundamentals, smart contract security, and live on-chain exercises tailored to your curriculum.')} />
          <InfoCard icon={ClockIcon} title={t('contact.info.response.title', 'Response time')}
            body={t('contact.info.response.body', 'We reply within 48 hours on weekdays.')} />
          <InfoCard icon={ContactIcon} title={t('contact.info.email.title', 'Email')}
            body={CONTACT_EMAIL} />
        </div>

        <form onSubmit={submit} className="card">
          {status.type === 'success' && (
            <div className="rounded-lg p-3 mb-4 flex items-start gap-2 text-sm" style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircleIcon className="w-5 h-5" /> <span>{status.text}</span>
            </div>
          )}
          {status.type === 'error' && (
            <div className="rounded-lg p-3 mb-4 flex items-start gap-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }}>
              <ExclamationTriangleIcon className="w-5 h-5" /> <span>{status.text}</span>
            </div>
          )}

          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={data.website}
            onChange={onChange}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />

          <Field label={t('contact.form.name', 'Full name')} required>
            <input name="name" type="text" className="form-input" value={data.name} onChange={onChange} required />
          </Field>
          <Field label={t('contact.form.email', 'Email')} required>
            <input name="email" type="email" className="form-input" value={data.email} onChange={onChange} required />
          </Field>
          <Field label={t('contact.form.subject', 'Subject')} required>
            <input name="subject" type="text" className="form-input" value={data.subject} onChange={onChange} required />
          </Field>
          <Field label={t('contact.form.message', 'Message')} required>
            <textarea name="message" className="form-input" rows={6} value={data.message} onChange={onChange} required minLength={20} />
            <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{data.message.length} / 20 min</div>
          </Field>

          <div className="flex justify-center my-4" ref={turnstileRef}>
            {TURNSTILE_KEY ? (
              <Turnstile siteKey={TURNSTILE_KEY} onSuccess={setToken} onError={() => setToken(null)} onExpire={() => setToken(null)} options={{ theme: dark ? 'dark' : 'light' }} />
            ) : (
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('contact.form.turnstileMissing', 'Turnstile not configured')}</div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              className="btn-flat primary"
              disabled={!isValid || status.type === 'loading'}
              style={{
                background: 'var(--color-accent-eth)',
                borderColor: 'var(--color-accent-eth)',
                color: '#fff',
              }}
            >
              {status.type === 'loading' ? t('contact.form.sending', 'Sending…') : t('contact.form.send', 'Send message')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="card flex items-start gap-3">
      <Icon className="w-5 h-5 mt-0.5" style={{ color: 'var(--text-primary)' }} />
      <div>
        <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{body}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="form-label">{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
    </div>
  );
}
