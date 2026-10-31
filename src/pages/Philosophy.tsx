import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PhilosophyIcon,
  ContactIcon,
  ArchitectureIcon,
  LayersIcon,
  StackIcon,
} from '../components/icons';
import {
  ArrowRight,
  Github,
  Scale,
  BookOpen,
  Coins,
  HeartHandshake,
  Hexagon,
  CheckCircle2,
  Network,
  ShieldCheck,
} from 'lucide-react';

export default function Philosophy() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-16 animate-fade-up">
        <div
          className="inline-flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          <PhilosophyIcon size={16} />
          <span>{t('philosophy.hero.eyebrow', 'Principles and vision')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('philosophy.hero.title', 'Philosophy and principles')}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t(
            'philosophy.hero.subtitle',
            'Why EduChain is built the way it is — for teachers, for students, for the Web3 community, and for the long-term sustainability of the digital economy.'
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to={`/${lang}/about`} className="btn-flat primary inline-flex items-center gap-2">
            <span>{t('philosophy.hero.ctaPrimary', 'Explore the platform')}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <a
            href="https://github.com/ivanovslavy/EduChain"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline inline-flex items-center gap-2"
          >
            <Github size={18} strokeWidth={2} aria-hidden="true" />
            <span>{t('philosophy.hero.ctaSecondary', 'View on GitHub')}</span>
          </a>
        </div>
      </section>

      {/* INFRASTRUCTURE — education is core infrastructure */}
      <section className="mb-16 animate-fade-up delay-100 text-center">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('philosophy.infrastructure.title', 'Education is core infrastructure')}
        </h2>
        <div
          className="max-w-[720px] mx-auto space-y-4 text-base leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p>
            {t(
              'philosophy.infrastructure.body1',
              'The digital economy is only as strong as the people who use, build, and understand it. Every long-term goal — safe asset stewardship, resilient public goods, critical thinking in decentralised systems — depends on a steady pipeline of educated users.'
            )}
          </p>
          <p>
            {t(
              'philosophy.infrastructure.body2',
              'EduChain closes a structural gap. Most European school curricula still treat Web3 as a niche topic, if they treat it at all. EduChain delivers a complete, classroom-ready programme: production-grade smart contracts on GembaBlockchain, a 16-hour student curriculum, a teacher-training pathway, and a polished, multilingual web application.'
            )}
          </p>
          <p>
            {t(
              'philosophy.infrastructure.body3',
              'Non-commercial, vendor-neutral, open to fork. EduChain does not extract value — it turns every cohort of trained teachers into a multiplier that reaches hundreds of students over time.'
            )}
          </p>
        </div>
      </section>

      {/* PUBLIC GOOD — 4 cards */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('philosophy.publicGood.title', 'Public-good principles')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t(
              'philosophy.publicGood.subtitle',
              'Every design decision in EduChain reflects the values of genuine open-source principle.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Scale size={22} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.publicGood.mit.title', 'MIT licence for the code')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.publicGood.mit.body',
                'Smart contracts are MIT-licensed — free to copy, modify, and use commercially. Any school, university, or community can fork EduChain for its own country, language, or context.'
              )}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen size={22} style={{ color: 'var(--color-accent-nft-pre)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.publicGood.cc.title', 'Creative Commons for learning materials')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.publicGood.cc.body',
                'The 16-hour curriculum, teacher training, and all pedagogical resources are under Creative Commons Attribution-ShareAlike 4.0. Adaptations preserve the same licence — knowledge stays open.'
              )}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Coins size={22} style={{ color: 'var(--color-accent-game)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.publicGood.noToken.title', 'No token, no fees')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.publicGood.noToken.body',
                'EduChain has no token for sale, no paid tiers, no premium features. The GAME tokens inside the platform have no monetary value — they are a pedagogical instrument.'
              )}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <HeartHandshake size={22} style={{ color: 'var(--color-accent-eth)' }} aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.publicGood.nonExtractive.title', 'Non-extractive design')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.publicGood.nonExtractive.body',
                'GEMBA EOOD operates as project steward, not rent-seeker. All funding goes directly into development, training, and ecosystem growth — never to dividends or expansion outside the mission.'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* CANONICAL STANDARDS — 4 cards */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('philosophy.canonical.title', 'Canonical Web3 standards')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t(
              'philosophy.canonical.subtitle',
              'EduChain uses only established, portable technologies. Nothing patented, nothing proprietary.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Hexagon size={22} style={{ color: 'var(--color-accent-eth)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.canonical.standards.title', 'Ethereum standards')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.canonical.standards.body',
                'ERC-20 for fungible tokens, ERC-721 and ERC-721A for NFTs, EIP-1559 gas mechanics, OpenZeppelin v5 security primitives. Students learn standards that work everywhere — not the features of a specific commercial product.'
              )}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <LayersIcon size={22} />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.canonical.portable.title', 'Portable skills')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.canonical.portable.body',
                'What students learn in EduChain applies directly to mainnet Ethereum, any EVM-compatible Layer 2 (Arbitrum, Optimism, Base, zkSync), or an enterprise consortium chain. Nothing is locked to a specific platform.'
              )}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={22} style={{ color: 'var(--color-accent-success)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.canonical.verified.title', 'Verified on GembaScan')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.canonical.verified.body',
                'All seven smart contracts are verified on GembaScan. Students, teachers, auditors, and evaluators can read the exact code that runs on-chain — no trusted frontend required. Full public transparency.'
              )}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Network size={22} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('philosophy.canonical.modernStack.title', 'Modern frontend stack')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'philosophy.canonical.modernStack.body',
                'React 19, TypeScript, wagmi, viem, i18next. Multilingual (BG/EN/ES), keyboard-accessible, mobile-optimised. Designed to be the first Web3 application a 12-year-old student ever uses.'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* TESTNET FIRST — single block */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('philosophy.testnetFirst.title', 'Testnet realism')}
          </h2>
        </div>

        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <ShieldCheck size={28} style={{ color: 'var(--color-accent-eth)' }} aria-hidden="true" />
            <div
              className="space-y-4 text-base leading-relaxed flex-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <p>
                {t(
                  'philosophy.testnetFirst.body1',
                  'EduChain runs entirely on the GembaBlockchain testnet. No exceptions, no mainnet bridges, no mixing with real funds. This is a deliberate choice — students interact with exactly the technology that powers real blockchain networks, but without financial exposure.'
                )}
              </p>
              <p>
                {t(
                  'philosophy.testnetFirst.body2',
                  'Every transaction is a real GembaBlockchain transaction. Real gas, real mempool, real GembaScan visibility. The only difference: the value is notional — test GMB has no monetary value outside the experimental environment.'
                )}
              </p>
              <p>
                {t(
                  'philosophy.testnetFirst.body3',
                  'This makes EduChain safer than ordinary internet access in a computing class. Whitelist-based access, transaction rate limits, and the ability for a teacher to remove a student instantly — every layer is designed for a controlled educational setting.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP — 4 phases stacked */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('philosophy.roadmap.title', 'Phased, realistic growth')}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t(
              'philosophy.roadmap.subtitle',
              'EduChain does not promise a revolution. It promises sustained, measurable, step-by-step growth.'
            )}
          </p>
        </div>

        <div className="space-y-4">
          {(['phase0', 'phase1', 'phase2', 'phase3'] as const).map((p, idx) => {
            const colors = [
              'var(--color-accent-info)',
              'var(--color-primary)',
              'var(--color-accent-nft-pre)',
              'var(--color-accent-points)',
            ];
            return (
              <div key={p} className="card">
                <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                  <div className="md:w-56 shrink-0">
                    <h3
                      className="font-display text-base font-semibold mb-1"
                      style={{ color: colors[idx] }}
                    >
                      {t(`philosophy.roadmap.${p}.label`, '')}
                    </h3>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {t(`philosophy.roadmap.${p}.period`, '')}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {t(`philosophy.roadmap.${p}.body`, '')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SUSTAINABILITY */}
      <section className="mb-16 animate-fade-up delay-300 text-center">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('philosophy.sustainability.title', 'Sustainability beyond any single funder')}
        </h2>
        <div className="card">
          <div className="flex items-start gap-4">
            <ArchitectureIcon size={28} />
            <div
              className="space-y-4 text-base leading-relaxed text-left flex-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <p>
                {t(
                  'philosophy.sustainability.body1',
                  'EduChain is designed so that no single source of funding or organisation is a single point of failure. If GEMBA EOOD steps back, the project continues — the open code and learning materials allow any organisation to take on stewardship.'
                )}
              </p>
              <p>
                {t(
                  'philosophy.sustainability.body2',
                  'Funding is non-dilutive — grants from European programmes, public-goods funding, institutional partnerships. No token sale, no equity investors, no pressure for a commercial pivot.'
                )}
              </p>
              <p>
                {t(
                  'philosophy.sustainability.body3',
                  'The long-term vision is a network of institutions — schools, universities, ministries, community organisations — mutually supporting Web3 education in Europe. EduChain is just one instrument, not the centre of that network.'
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="text-center animate-fade-up delay-300">
        <div className="card" style={{ padding: '40px 24px' }}>
          <StackIcon size={32} />
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mt-4 mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('philosophy.cta.title', 'Open to conversation')}
          </h2>
          <p
            className="text-base max-w-xl mx-auto mb-6 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t(
              'philosophy.cta.subtitle',
              'EduChain is ready to be evaluated, piloted, forked, or integrated into a broader educational initiative. Whether you are a school, a funder, a researcher, or a developer — we look forward to connecting.'
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={`/${lang}/contact`} className="btn-flat primary inline-flex items-center gap-2">
              <ContactIcon size={18} />
              <span>{t('philosophy.cta.primary', 'Contact us')}</span>
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
            <a
              href="https://github.com/ivanovslavy/EduChain"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2"
            >
              <Github size={18} strokeWidth={2} aria-hidden="true" />
              <span>{t('philosophy.cta.secondary', 'View on GitHub')}</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
