import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CurriculumIcon,
  TeachersIcon,
  PartnershipIcon,
  ContactIcon,
  TrophyIcon,
} from '../components/icons';
import {
  Clock,
  ArrowRight,
  Wrench,
  Brain,
  Package,
  Rocket,
  Calendar,
  Zap,
  Layers3,
  UsersRound,
  Award,
  CheckCircle2,
  Info,
  Target,
  Sparkles,
} from 'lucide-react';

export default function Curriculum() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const modules = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];

  const skillCategories = [
    { key: 'technical', Icon: Wrench, color: 'var(--color-accent-info)' },
    { key: 'critical', Icon: Brain, color: 'var(--color-accent-nft-pre)' },
    { key: 'practical', Icon: Package, color: 'var(--color-accent-eth)' },
    { key: 'future', Icon: Rocket, color: 'var(--color-accent-game)' },
  ];

  const formats = [
    { key: 'weekly', Icon: Calendar, color: 'var(--color-accent-info)' },
    { key: 'intensive', Icon: Zap, color: 'var(--color-accent-faucet)' },
    { key: 'integrated', Icon: Layers3, color: 'var(--color-accent-nft-pre)' },
    { key: 'extracurricular', Icon: UsersRound, color: 'var(--color-accent-game)' },
  ];

  const stats = ['hours', 'modules', 'age', 'cost'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-16 animate-fade-up">
        <div
          className="inline-flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          <CurriculumIcon size={16} />
          <span>{t('curriculum.hero.eyebrow', '16 hours, 7 modules')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('curriculum.hero.title', 'What students learn in EduChain')}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('curriculum.hero.subtitle', '...')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to={`/${lang}/about`} className="btn-flat primary inline-flex items-center gap-2">
            <span>{t('curriculum.hero.ctaPrimary', 'Explore the platform')}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link to={`/${lang}/teachers`} className="btn-outline inline-flex items-center gap-2">
            <TeachersIcon size={16} />
            <span>{t('curriculum.hero.ctaSecondary', 'For teachers')}</span>
          </Link>
        </div>
      </section>

      {/* PHILOSOPHY — single emphasis block */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="card" style={{ padding: '32px' }}>
          <h2
            className="font-display text-2xl font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('curriculum.philosophy.title', 'Learning by doing')}
          </h2>
          <div
            className="max-w-[720px] space-y-4 text-base leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            <p>{t('curriculum.philosophy.p1', '...')}</p>
            <p>{t('curriculum.philosophy.p2', '...')}</p>
          </div>
        </div>
      </section>

      {/* OVERVIEW — numeric stats */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('curriculum.overview.title', 'The programme in numbers')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('curriculum.overview.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat} className="card text-center" style={{ padding: '24px 16px' }}>
              <div
                className="font-display text-4xl md:text-5xl font-semibold mb-2"
                style={{ color: 'var(--color-primary)' }}
              >
                {t(`curriculum.overview.${stat}.value`, '')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t(`curriculum.overview.${stat}.label`, '')}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODULES — 7 detailed cards */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('curriculum.modules.title', 'Seven modules — from intro to project')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('curriculum.modules.subtitle', '...')}
          </p>
        </div>

        <div className="space-y-4">
          {modules.map((m, idx) => (
            <div key={m} className="card">
              <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                {/* Left column: number + hours */}
                <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-2 md:min-w-[120px] mb-3 md:mb-0">
                  <div
                    className="font-display text-4xl font-semibold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Clock size={12} strokeWidth={2} aria-hidden="true" />
                    <span>{t(`curriculum.modules.${m}.hours`, '')}</span>
                  </div>
                </div>

                {/* Right column: title + tagline + description + outcome */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-3 mb-2">
                    <h3
                      className="font-display text-lg font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t(`curriculum.modules.${m}.title`, '')}
                    </h3>
                    <span
                      className="text-sm italic"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {t(`curriculum.modules.${m}.tagline`, '')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {t(`curriculum.modules.${m}.description`, '')}
                  </p>
                  <div
                    className="flex items-start gap-2 pt-3 text-sm"
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Target
                      size={14}
                      style={{ color: 'var(--color-accent-eth)', marginTop: '2px', flexShrink: 0 }}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span>
                      <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {t('common.outcome', 'Резултат:')}
                      </strong>{' '}
                      {t(`curriculum.modules.${m}.outcome`, '')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SKILLS — 4 category cards */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('curriculum.skills.title', 'What students leave with')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('curriculum.skills.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skillCategories.map(({ key, Icon, color }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={22} style={{ color }} aria-hidden="true" />
                <h3
                  className="font-display text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`curriculum.skills.${key}.title`, '')}
                </h3>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(`curriculum.skills.${key}.items`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FORMATS — how to deliver */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('curriculum.formats.title', 'How the programme is delivered')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('curriculum.formats.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formats.map(({ key, Icon, color }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={22} style={{ color }} aria-hidden="true" />
                <h3
                  className="font-display text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`curriculum.formats.${key}.title`, '')}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t(`curriculum.formats.${key}.body`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CERTIFICATE */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('curriculum.certificate.title', 'Web3 literacy certificate')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('curriculum.certificate.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <Award
              size={28}
              style={{ color: 'var(--color-accent-points)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3
              className="font-display text-base font-semibold mt-3 mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('curriculum.certificate.what.title', '')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('curriculum.certificate.what.body', '')}
            </p>
          </div>

          <div className="card">
            <CheckCircle2
              size={28}
              style={{ color: 'var(--color-accent-eth)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3
              className="font-display text-base font-semibold mt-3 mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('curriculum.certificate.why.title', '')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('curriculum.certificate.why.body', '')}
            </p>
          </div>

          <div className="card">
            <Info
              size={28}
              style={{ color: 'var(--color-accent-info)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3
              className="font-display text-base font-semibold mt-3 mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('curriculum.certificate.criteria.title', '')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('curriculum.certificate.criteria.body', '')}
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="animate-fade-up delay-300">
        <div className="mb-8 text-center">
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
            {t('curriculum.cta.title', 'How to bring EduChain to your students')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('curriculum.cta.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3
              className="font-display text-base font-semibold mb-2"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('curriculum.cta.schoolsTitle', '')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('curriculum.cta.schoolsBody', '')}
            </p>
            <Link
              to={`/${lang}/partnership`}
              className="btn-outline inline-flex items-center gap-2 text-sm w-full justify-center"
            >
              <PartnershipIcon size={14} />
              <span>{t('curriculum.cta.schoolsCta', '')}</span>
            </Link>
          </div>

          <div className="card">
            <h3
              className="font-display text-base font-semibold mb-2"
              style={{ color: 'var(--color-accent-nft-pre)' }}
            >
              {t('curriculum.cta.teachersTitle', '')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('curriculum.cta.teachersBody', '')}
            </p>
            <Link
              to={`/${lang}/teachers`}
              className="btn-outline inline-flex items-center gap-2 text-sm w-full justify-center"
            >
              <TeachersIcon size={14} />
              <span>{t('curriculum.cta.teachersCta', '')}</span>
            </Link>
          </div>

          <div className="card">
            <h3
              className="font-display text-base font-semibold mb-2"
              style={{ color: 'var(--color-accent)' }}
            >
              {t('curriculum.cta.exploreTitle', '')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('curriculum.cta.exploreBody', '')}
            </p>
            <Link
              to={`/${lang}/about`}
              className="btn-outline inline-flex items-center gap-2 text-sm w-full justify-center"
            >
              <TrophyIcon size={14} />
              <span>{t('curriculum.cta.exploreCta', '')}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
