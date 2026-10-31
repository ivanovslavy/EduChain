import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PartnershipIcon,
  ContactIcon,
  TrophyIcon,
} from '../components/icons';
import {
  Users,
  Building2,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Lock,
  Scale,
  Eye,
} from 'lucide-react';

export default function Partnership() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-16 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <PartnershipIcon size={16} />
          <span>{t('partnership.hero.eyebrow', 'For schools and institutions')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('partnership.hero.title', 'Partnership for Web3 education in Europe')}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('partnership.hero.subtitle', '...')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to={`/${lang}/contact`} className="btn-flat primary inline-flex items-center gap-2">
            <ContactIcon size={18} />
            <span>{t('partnership.hero.ctaPrimary', 'Contact us')}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link to={`/${lang}`} className="btn-outline inline-flex items-center gap-2">
            <span>{t('partnership.hero.ctaSecondary', 'Explore the platform')}</span>
          </Link>
        </div>
      </section>

      {/* INTRO — Why Web3 literacy is inevitable */}
      <section className="mb-16 animate-fade-up delay-100 text-center">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('partnership.intro.title', 'Why Web3 literacy is inevitable')}
        </h2>
        <div className="max-w-[720px] mx-auto space-y-4 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>{t('partnership.intro.p1', '...')}</p>
          <p>{t('partnership.intro.p2', '...')}</p>
          <p>{t('partnership.intro.p3', '...')}</p>
        </div>
      </section>

      {/* BENEFITS — 4 cards */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('partnership.benefits.title', 'What partnership brings to your school')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('partnership.benefits.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <TrophyIcon size={22} />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.benefits.director.title', 'For the director')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.benefits.director.body', '...')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Building2 size={22} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.benefits.school.title', 'For the school')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.benefits.school.body', '...')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <GraduationCap size={22} style={{ color: 'var(--color-accent-nft-pre)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.benefits.teachers.title', 'For teachers')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.benefits.teachers.body', '...')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Users size={22} style={{ color: 'var(--color-accent-game)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.benefits.students.title', 'For students')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.benefits.students.body', '...')}
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 3 numbered steps */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('partnership.howItWorks.title', 'How the partnership works')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('partnership.howItWorks.subtitle', '...')}
          </p>
        </div>

        <div className="space-y-4">
          {['step1', 'step2', 'step3'].map((step) => (
            <div key={step} className="card">
              <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                <div
                  className="font-display text-3xl font-semibold mb-2 md:mb-0 md:min-w-[80px]"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t(`partnership.howItWorks.${step}.number`, '')}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-3 mb-2">
                    <h3
                      className="font-display text-lg font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t(`partnership.howItWorks.${step}.title`, '')}
                    </h3>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t(`partnership.howItWorks.${step}.period`, '')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(`partnership.howItWorks.${step}.body`, '')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EU PROGRAMMES — compact grid */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('partnership.programmes.title', 'Alignment with EU programmes')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('partnership.programmes.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['erasmus', 'digital', 'horizon', 'national'].map((prog) => (
            <div key={prog} className="card">
              <h3 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {t(`partnership.programmes.${prog}.title`, '')}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t(`partnership.programmes.${prog}.body`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SAFETY */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('partnership.safety.title', 'Safety and compliance')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('partnership.safety.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={22} style={{ color: 'var(--color-accent-eth)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.safety.testnet.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.safety.testnet.body', '')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Lock size={22} style={{ color: 'var(--color-accent-info)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.safety.gdpr.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.safety.gdpr.body', '')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Scale size={22} style={{ color: 'var(--color-accent-nft-cus)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.safety.financial.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.safety.financial.body', '')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Eye size={22} style={{ color: 'var(--color-accent-points)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnership.safety.supervision.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('partnership.safety.supervision.body', '')}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-16 animate-fade-up delay-300">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-8 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('partnership.faq.title', 'Frequently asked questions')}
        </h2>

        <div className="space-y-3">
          {['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map((q) => (
            <details key={q} className="card cursor-pointer">
              <summary
                className="font-display text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t(`partnership.faq.${q}.q`, '')}
              </summary>
              <p
                className="text-sm leading-relaxed mt-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(`partnership.faq.${q}.a`, '')}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="text-center animate-fade-up delay-300">
        <div className="card" style={{ padding: '40px 24px' }}>
          <Sparkles
            size={32}
            style={{ color: 'var(--color-primary)', margin: '0 auto 16px' }}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('partnership.cta.title', 'Ready for a conversation?')}
          </h2>
          <p
            className="text-base max-w-xl mx-auto mb-6 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('partnership.cta.subtitle', '...')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={`/${lang}/contact`} className="btn-flat primary inline-flex items-center gap-2">
              <ContactIcon size={18} />
              <span>{t('partnership.cta.primary', 'Request a meeting')}</span>
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
