import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TeachersIcon,
  CurriculumIcon,
  ContactIcon,
  PartnershipIcon,
} from '../components/icons';
import {
  Code2,
  ShoppingBag,
  TrendingUp,
  Palette,
  CalendarDays,
  Monitor,
  BadgeCheck,
  Users,
  LifeBuoy,
  Sparkles,
  ArrowRight,
  Clock,
  Settings,
  Shield,
  Activity,
  FileText,
} from 'lucide-react';

export default function Teachers() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const audience = [
    { key: 'it', Icon: Code2, color: 'var(--color-accent-info)' },
    { key: 'ecommerce', Icon: ShoppingBag, color: 'var(--color-accent-game)' },
    { key: 'economics', Icon: TrendingUp, color: 'var(--color-accent-eth)' },
    { key: 'design', Icon: Palette, color: 'var(--color-accent-nft-cus)' },
  ];

  const certification = [
    { key: 'cert', Icon: BadgeCheck, color: 'var(--color-accent-points)' },
    { key: 'community', Icon: Users, color: 'var(--color-accent-info)' },
    { key: 'support', Icon: LifeBuoy, color: 'var(--color-accent-eth)' },
    { key: 'development', Icon: TrendingUp, color: 'var(--color-accent-nft-pre)' },
  ];

  const tools = [
    { key: 'admin', Icon: Settings, color: 'var(--color-accent-info)' },
    { key: 'limits', Icon: Shield, color: 'var(--color-accent-eth)' },
    { key: 'monitoring', Icon: Activity, color: 'var(--color-accent-points)' },
    { key: 'materials', Icon: FileText, color: 'var(--color-accent-nft-pre)' },
  ];

  const modules = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-16 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <TeachersIcon size={16} />
          <span>{t('teachers.hero.eyebrow', 'For educators')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('teachers.hero.title', 'EduChain in the classroom')}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('teachers.hero.subtitle', '...')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to={`/${lang}/teachers#curriculum`}
            className="btn-flat primary inline-flex items-center gap-2"
          >
            <CurriculumIcon size={18} />
            <span>{t('teachers.hero.ctaPrimary', 'See curriculum')}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link to={`/${lang}/contact`} className="btn-outline inline-flex items-center gap-2">
            <ContactIcon size={16} />
            <span>{t('teachers.hero.ctaSecondary', 'Request training')}</span>
          </Link>
        </div>
      </section>

      {/* PHILOSOPHY — single emphasis block */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="card text-center" style={{ padding: '32px' }}>
          <h2
            className="font-display text-2xl font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('teachers.philosophy.title', 'Teachers are trained first')}
          </h2>
          <p className="text-base leading-relaxed max-w-[720px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('teachers.philosophy.body', '...')}
          </p>
        </div>
      </section>

      {/* WHO IS THIS FOR — 4 discipline cards */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('teachers.whoFor.title', 'Who this programme is for')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('teachers.whoFor.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audience.map(({ key, Icon, color }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={22} style={{ color }} aria-hidden="true" />
                <h3
                  className="font-display text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`teachers.whoFor.${key}.title`, '')}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t(`teachers.whoFor.${key}.body`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* TRAINING — two formats side by side */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('teachers.training.title', 'Teacher training')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('teachers.training.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* In-person */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={18} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                {t('teachers.training.inPerson.badge', 'Recommended')}
              </span>
            </div>
            <h3
              className="font-display text-lg font-semibold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('teachers.training.inPerson.title', 'In-person intensive — 3 days')}
            </h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
              {t('teachers.training.inPerson.body', '')}
            </p>

            <div className="space-y-3">
              {['day1', 'day2', 'day3'].map((day) => (
                <div key={day}>
                  <h4
                    className="text-sm font-semibold mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t(`teachers.training.inPerson.${day}Title`, '')}
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(`teachers.training.inPerson.${day}Body`, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Online */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={18} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-accent)' }}
              >
                {t('teachers.training.online.badge', 'For busy schedules')}
              </span>
            </div>
            <h3
              className="font-display text-lg font-semibold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('teachers.training.online.title', 'Online self-paced course')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('teachers.training.online.body', '')}
            </p>
          </div>
        </div>
      </section>

      {/* CERTIFICATION — what you receive */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('teachers.certification.title', 'What you receive')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('teachers.certification.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certification.map(({ key, Icon, color }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={22} style={{ color }} aria-hidden="true" />
                <h3
                  className="font-display text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`teachers.certification.${key}.title`, '')}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t(`teachers.certification.${key}.body`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CURRICULUM — 7 modules */}
      <section id="curriculum" className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('teachers.curriculum.title', 'What you teach students')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('teachers.curriculum.subtitle', '...')}
          </p>
        </div>

        <div className="space-y-3">
          {modules.map((m, idx) => (
            <div key={m} className="card">
              <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                <div className="flex items-center gap-3 md:min-w-[120px] mb-2 md:mb-0">
                  <div
                    className="font-display text-2xl font-semibold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Clock size={12} strokeWidth={2} aria-hidden="true" />
                    <span>{t(`teachers.curriculum.modules.${m}.hours`, '')}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3
                    className="font-display text-base font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t(`teachers.curriculum.modules.${m}.title`, '')}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(`teachers.curriculum.modules.${m}.body`, '')}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Outcome highlighted */}
          <div className="card" style={{ borderColor: 'var(--color-primary)', borderWidth: '1px' }}>
            <h3
              className="font-display text-base font-semibold mb-2"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('teachers.curriculum.outcome.title', 'Learning outcomes')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('teachers.curriculum.outcome.body', '')}
            </p>
          </div>
        </div>
      </section>

      {/* TOOLS — support in the classroom */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('teachers.tools.title', 'The tools you have')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('teachers.tools.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map(({ key, Icon, color }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={22} style={{ color }} aria-hidden="true" />
                <h3
                  className="font-display text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`teachers.tools.${key}.title`, '')}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t(`teachers.tools.${key}.body`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-16 animate-fade-up delay-300">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-8 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('teachers.faq.title', 'Frequently asked questions')}
        </h2>

        <div className="space-y-3">
          {['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map((q) => (
            <details key={q} className="card cursor-pointer">
              <summary
                className="font-display text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t(`teachers.faq.${q}.q`, '')}
              </summary>
              <p
                className="text-sm leading-relaxed mt-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(`teachers.faq.${q}.a`, '')}
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
            {t('teachers.cta.title', 'Ready for the first step?')}
          </h2>
          <p
            className="text-base max-w-xl mx-auto mb-6 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('teachers.cta.subtitle', '...')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={`/${lang}/contact`} className="btn-flat primary inline-flex items-center gap-2">
              <ContactIcon size={18} />
              <span>{t('teachers.cta.primary', 'Request materials')}</span>
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link to={`/${lang}/partnership`} className="btn-outline inline-flex items-center gap-2">
              <PartnershipIcon size={16} />
              <span>{t('teachers.cta.secondary', 'See partnership')}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
