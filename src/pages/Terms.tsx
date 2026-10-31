import { useTranslation } from 'react-i18next';
import { TermsIcon } from '../components/icons';

export default function Terms() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-12 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <TermsIcon size={16} />
          <span>{t('terms.hero.lastUpdated', 'Last updated: 24 April 2026')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('terms.hero.title', 'Terms of Use')}
        </h1>
        <p
          className="text-base max-w-2xl mx-auto leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('terms.hero.subtitle', '...')}
        </p>
      </section>

      {/* SUMMARY */}
      <section className="mb-12 animate-fade-up delay-100">
        <div className="card" style={{ borderColor: 'var(--color-accent)', borderWidth: '1px' }}>
          <h2
            className="font-display text-lg font-semibold mb-3"
            style={{ color: 'var(--color-accent)' }}
          >
            {t('terms.summary.title', 'Summary')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.summary.body', '...')}
          </p>
        </div>
      </section>

      <article className="space-y-10 animate-fade-up delay-200">
        {/* Section 1 — simple */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section1.title', '')}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section1.body', '')}
          </p>
        </section>

        {/* Section 2 — what EduChain is NOT */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section2.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section2.intro', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i} style={{ paddingLeft: '16px', position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '0.5em',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-nft-cus)',
                  }}
                />
                {t(`terms.section2.item${i}`, '')}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3 — who can use */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section3.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section3.body', '')}
          </p>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section3.minorsTitle', '')}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section3.minorsBody', '')}
          </p>
        </section>

        {/* Section 4 — obligations */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section4.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section4.intro', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
                {t(`terms.section4.item${i}`, '')}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 5 — IP */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section5.title', '')}
          </h2>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('terms.section5.ours', '')}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('terms.section5.yours', '')}
            </p>
          </div>
        </section>

        {/* Section 6 — termination */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section6.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section6.intro', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
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
                    background: 'var(--color-accent-eth)',
                  }}
                />
                {t(`terms.section6.item${i}`, '')}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section6.note', '')}
          </p>
        </section>

        {/* Section 7 — liability */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section7.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section7.body', '')}
          </p>
          <ul className="space-y-2 text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} style={{ paddingLeft: '16px', position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '0.5em',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-accent-info)',
                  }}
                />
                {t(`terms.section7.item${i}`, '')}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section7.note', '')}
          </p>
        </section>

        {/* Section 8 — blockchain */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section8.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section8.intro', '')}
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
                    background: 'var(--color-accent-points)',
                  }}
                />
                {t(`terms.section8.item${i}`, '')}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 9-10 */}
        {['section9', 'section10'].map((s) => (
          <section key={s}>
            <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t(`terms.${s}.title`, '')}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(`terms.${s}.body`, '')}
            </p>
          </section>
        ))}

        {/* Section 11 — contact */}
        <section>
          <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('terms.section11.title', '')}
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('terms.section11.body', '')}
          </p>
          <div className="card" style={{ padding: '20px' }}>
            <div className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {t('terms.section11.company', 'GEMBA EOOD')}
              </div>
              <div>{t('terms.section11.eik', 'EIK: 208656371')}</div>
              <div>{t('terms.section11.city', 'Varna, Bulgaria')}</div>
              <div>
                <a href="mailto:contacts@gembait.com" style={{ color: 'var(--color-primary)' }}>
                  {t('terms.section11.email', 'Email: contacts@gembait.com')}
                </a>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
