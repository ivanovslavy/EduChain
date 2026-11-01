import { useTranslation } from 'react-i18next';
import { PrivacyIcon } from '../components/icons';

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-12 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <PrivacyIcon size={16} />
          <span>{t('privacy.hero.lastUpdated', 'Last updated: 24 April 2026')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('privacy.hero.title', 'Privacy Policy')}
        </h1>
        <p
          className="text-base max-w-2xl mx-auto leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('privacy.hero.subtitle', '...')}
        </p>
      </section>

      {/* SUMMARY — highlighted */}
      <section className="mb-12 animate-fade-up delay-100">
        <div className="card" style={{ borderColor: 'var(--color-primary)', borderWidth: '1px' }}>
          <h2
            className="font-display text-lg font-semibold mb-3"
            style={{ color: 'var(--color-primary)' }}
          >
            {t('privacy.summary.title', 'Summary')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.summary.body', '...')}
          </p>
        </div>
      </section>

      <article className="space-y-10 animate-fade-up delay-200">
        {/* Section 1 — simple */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section1.title', '')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section1.body', '')}
          </p>
        </section>

        {/* Section 2 — what we DON'T collect — highlighted with accent green dot */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section2.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section2.intro', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i} style={{ paddingLeft: '20px', position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '0.45em',
                    width: '12px',
                    height: '12px',
                    color: 'var(--color-accent-eth)',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </span>
                {t(`privacy.section2.item${i}`, '')}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3 — what actually happens */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section3.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section3.intro', '')}
          </p>
          <div className="space-y-4">
            {/* 2026-10-31: 'certificates' is the one place with personal data — see the policy text. */}
            {['wallet', 'contact', 'browser', 'blockchain', 'certificates'].map((sub) => (
              <div key={sub}>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t(`privacy.section3.${sub}Title`, '')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(`privacy.section3.${sub}Body`, '')}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4 — server/CDN logs */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section4.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section4.intro', '')}
          </p>
          <div className="space-y-3">
            {['cloudflare', 'apache', 'turnstile', 'mail', 'walletconnect', 'rpc'].map((sub) => (
              <div key={sub} className="card" style={{ padding: '16px' }}>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t(`privacy.section4.${sub}Title`, '')}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(`privacy.section4.${sub}Body`, '')}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5 — legal basis */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section5.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section5.intro', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {[1, 2, 3, 4].map((i) => (
              <li key={i} style={{ paddingLeft: '16px', position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '0.5em',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                  }}
                />
                {t(`privacy.section5.item${i}`, '')}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 6 — GDPR rights */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section6.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section6.intro', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <li key={i} style={{ paddingLeft: '16px', position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '0.5em',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-eth)',
                  }}
                />
                {t(`privacy.section6.right${i}`, '')}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section6.contact', '')}
          </p>
          <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section6.blockchainNote', '')}
          </p>
        </section>

        {/* Sections 7, 8, 9 — simple */}
        {['section7', 'section8', 'section9'].map((s) => (
          <section key={s}>
            <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t(`privacy.${s}.title`, '')}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(`privacy.${s}.body`, '')}
            </p>
          </section>
        ))}

        {/* Section 10 — contact */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('privacy.section10.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy.section10.body', '')}
          </p>
          <div className="card" style={{ padding: '20px' }}>
            <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {t('privacy.section10.company', 'GEMBA EOOD')}
              </div>
              <div>{t('privacy.section10.eik', 'EIK: 208656371')}</div>
              <div>{t('privacy.section10.city', 'Varna, Bulgaria')}</div>
              <div>
                <a href="mailto:contacts@gembait.com" style={{ color: 'var(--color-primary)' }}>
                  {t('privacy.section10.email', 'Email: contacts@gembait.com')}
                </a>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
