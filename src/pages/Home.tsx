import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadPublicStats } from '../lib/publicReader';
import {
  HomeHeroIcon,
  PartnershipIcon,
  TeachersIcon,
  GalleryIcon,
  TokenIcon,
  MarketplaceIcon,
  TrophyIcon,
  WhitelistIcon,
} from '../components/icons';
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Clock,
  UserX,
  Github,
  CheckCircle2,
  Scale,
  FileText,
} from 'lucide-react';

interface Stats {
  totalUsers: number | null;
  nftsMinted: number | null;
  gameTokensCirculating: number | null;
}

function formatCount(n: number | null): string {
  if (n === null) return '…';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export default function Home() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();
  const [stats, setStats] = useState<Stats>({ totalUsers: null, nftsMinted: null, gameTokensCirculating: null });

  useEffect(() => {
    // Stats come from a module-level cached loader (see `lib/publicReader.ts`).
    // The cache makes stats stable across Home remounts caused by wagmi
    // state changes on wallet connect — without it, stats briefly flash
    // back to `…` every time the wallet connects/disconnects.
    let cancelled = false;
    loadPublicStats().then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-16 animate-fade-up">
        <div
          className="inline-flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          <HomeHeroIcon size={16} />
          <span>{t('home.hero.eyebrow', 'Educational Web3 platform')}</span>
        </div>

        <h1
          className="font-display text-4xl md:text-6xl font-semibold mb-4 leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('home.hero.headline', 'Welcome to EduChain')}
          <br />
          <span style={{ color: 'var(--color-primary)' }}>
            {t('home.hero.headlineAccent', 'Web3 and EVM blockchain education')}
          </span>
        </h1>

        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('home.hero.subtitle', 'A safe testnet environment where students from age 12 create their own digital assets, learn to spot scams, and prepare for the digital economy — with pedagogical support from trained teachers.')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to={`/${lang}/about`} className="btn-flat primary inline-flex items-center gap-2">
            <span>{t('home.hero.ctaPrimary', 'Explore the platform')}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link to={`/${lang}/partnership`} className="btn-outline inline-flex items-center gap-2">
            <PartnershipIcon size={16} />
            <span>{t('home.hero.ctaSecondary', 'For schools and teachers')}</span>
          </Link>
        </div>
      </section>

      {/* MISSION STRIP — non-commercial framing (added 2026-04-22) */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="card text-center">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t(
              'home.mission.body',
              'A non-commercial initiative by GEMBA IT — a technology studio based in Varna, Bulgaria. EduChain is built solely for educational purposes, with no commercial product, no fees, and no financial instruments. Operating costs are covered entirely by GEMBA EOOD, public programmes, and European education funding. Our only goal is to educate the next generation of European students and citizens about Web3 and EVM blockchain.'
            )}
          </p>
        </div>
      </section>

      {/* STATS BAR — live on-chain */}
      <section className="mb-20 animate-fade-up delay-100">
        <div
          className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-5 text-sm border-t border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--color-accent-info)', fontWeight: 600 }}>
              {formatCount(stats.totalUsers)}
            </span>
            <span>{t('home.stats.users', 'Registered users')}</span>
          </div>
          <div className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--color-accent-nft-pre)', fontWeight: 600 }}>
              {formatCount(stats.nftsMinted)}
            </span>
            <span>{t('home.stats.nfts', 'NFTs minted')}</span>
          </div>
          <div className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--color-accent-game)', fontWeight: 600 }}>
              {formatCount(stats.gameTokensCirculating)}
            </span>
            <span>{t('home.stats.tokens', 'GAME tokens in circulation')}</span>
          </div>
          <div className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--color-accent-eth)', fontWeight: 600 }}>8</span>
            <span>{t('home.stats.contracts', 'Verified smart contracts')}</span>
          </div>
        </div>
      </section>

      {/* WHAT IS EDUCHAIN */}
      <section className="mb-16 animate-fade-up delay-100">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-6 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('home.what.title', 'What is EduChain')}
        </h2>
        <div className="card text-center">
          <div
            className="space-y-4 text-base leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            <p>{t('home.what.p1', 'EduChain is a gamified educational Web3 platform built by GEMBA IT, a Bulgarian tech studio. Students explore blockchain technology, digital assets, and decentralized economics in a fully controlled and safe environment.')}</p>
            <p>{t('home.what.p2', 'The platform runs entirely on GembaBlockchain testnet — a test network where real money is never exchanged. Students interact with the same technologies that power real blockchain networks, but without financial risk.')}</p>
          </div>
        </div>
      </section>

      {/* FEATURES — what students do */}
      <section className="mb-20 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('home.features.title', 'What students do')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('home.features.subtitle', 'Practice is the foundation of learning. Every concept is tried, not just explained.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to={`/${lang}/shop`} className="card clickable">
            <div className="flex items-center gap-3 mb-3">
              <TokenIcon size={22} />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.features.shop.title', 'Buy and mint')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.features.shop.body', 'Students buy GAME tokens and mint their own NFTs — predefined first, then with personal content uploaded to IPFS.')}
            </p>
          </Link>

          <Link to={`/${lang}/gallery`} className="card clickable">
            <div className="flex items-center gap-3 mb-3">
              <GalleryIcon size={22} />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.features.gallery.title', 'See ownership')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.features.gallery.body', 'Every created and purchased digital asset appears in a personal gallery — with metadata, attributes, and links to the blockchain.')}
            </p>
          </Link>

          <Link to={`/${lang}/marketplace`} className="card clickable">
            <div className="flex items-center gap-3 mb-3">
              <MarketplaceIcon size={22} />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.features.marketplace.title', 'Trade peer-to-peer')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.features.marketplace.body', 'A decentralized peer-to-peer marketplace where students list, buy, and sell assets among themselves.')}
            </p>
          </Link>

          <Link to={`/${lang}/leaderboard`} className="card clickable">
            <div className="flex items-center gap-3 mb-3">
              <TrophyIcon size={22} />
              <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.features.leaderboard.title', 'Track progress')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.features.leaderboard.body', 'A live on-chain leaderboard with a points system, ranks, and gamification — healthy competition in the classroom.')}
            </p>
          </Link>
        </div>
      </section>

      {/* SAFETY */}
      <section className="mb-20 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('home.safety.title', 'Safe by design')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('home.safety.subtitle', 'Designed so students and parents can feel at ease.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <ShieldCheck
              size={24}
              style={{ color: 'var(--color-accent-eth)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.safety.item1.title', 'Testnet only')}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.safety.item1.body', 'Real money is never exchanged. Tokens and NFTs have no monetary value.')}
            </p>
          </div>

          <div className="card">
            <WhitelistIcon size={24} />
            <h3 className="font-display text-base font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.safety.item2.title', 'Whitelist access')}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.safety.item2.body', 'Only teacher-approved students can interact with the platform. Removal with one click.')}
            </p>
          </div>

          <div className="card">
            <Clock
              size={24}
              style={{ color: 'var(--color-accent-faucet)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.safety.item3.title', 'Daily limits')}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.safety.item3.body', 'Built-in transaction limits — no student can make a large or rushed mistake.')}
            </p>
          </div>

          <div className="card">
            <UserX
              size={24}
              style={{ color: 'var(--color-accent-info)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3 className="font-display text-base font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.safety.item4.title', 'No personal data')}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.safety.item4.body', 'No registration, no user database. Access is through an anonymous Web3 wallet.')}
            </p>
          </div>
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="mb-20 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('home.audiences.title', 'Who EduChain is for')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('home.audiences.subtitle', 'Different people, different needs — everyone finds their path.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to={`/${lang}/partnership`} className="card clickable">
            <PartnershipIcon size={28} />
            <h3 className="font-display text-lg font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.audiences.schools.title', 'For schools')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('home.audiences.schools.body', 'A pathway to European partnership — Erasmus+ KA220 as one possible co-funding programme, with the coordinator role for the school and a substantial budget over a 24-month project.')}
            </p>
            <div
              className="inline-flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              <span>{t('home.audiences.schools.cta', 'Partnership')}</span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </div>
          </Link>

          <Link to={`/${lang}/teachers`} className="card clickable">
            <TeachersIcon size={28} />
            <h3 className="font-display text-lg font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.audiences.teachers.title', 'For teachers')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('home.audiences.teachers.body', 'Certification as a Web3 educator, a 16-hour curriculum, and a classroom admin panel.')}
            </p>
            <div
              className="inline-flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              <span>{t('home.audiences.teachers.cta', 'For teachers')}</span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </div>
          </Link>

          <Link to={`/${lang}/shop`} className="card clickable">
            <TokenIcon size={28} />
            <h3 className="font-display text-lg font-semibold mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('home.audiences.students.title', 'For students')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('home.audiences.students.body', 'Connect a wallet, claim testnet GMB, mint your first NFT. The learn-by-doing path into Web3.')}
            </p>
            <div
              className="inline-flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              <span>{t('home.audiences.students.cta', 'Get started')}</span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </div>
          </Link>
        </div>
      </section>

      {/* TRUST */}
      <section className="mb-20 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('home.trust.title', 'Open and transparent')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('home.trust.subtitle', 'The platform code is public. The regulatory position is clear. Anyone can verify.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Github size={22} style={{ color: 'var(--text-primary)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.trust.opensource.title', 'Open source')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.trust.opensource.body', 'Smart contracts are MIT-licensed. Educational materials are Creative Commons. The code is published on GitHub.')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={22} style={{ color: 'var(--color-accent-eth)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.trust.verified.title', 'Verified contracts')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.trust.verified.body', 'All 8 smart contracts are verified on GembaScan. Every function is publicly inspectable.')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Scale size={22} style={{ color: 'var(--color-accent-nft-cus)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.trust.financial.title', 'Not a financial product')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.trust.financial.body', 'Classified as an educational tool, not a financial product. No exchange value, no investment service.')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Lock size={22} style={{ color: 'var(--color-accent-info)' }} aria-hidden="true" />
              <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('home.trust.gdpr.title', 'GDPR-aligned')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('home.trust.gdpr.body', 'Minimal data collection. No tracking, profiling, or advertising. Full GDPR rights for users.')}
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA — three pathways */}
      <section className="animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('home.cta.title', 'What next')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('home.cta.subtitle', 'Pick the path that is relevant to you.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
              {t('home.cta.schoolsTitle', 'Principal or coordinator?')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('home.cta.schoolsBody', 'See how an Erasmus+ partnership can bring real benefit to your school.')}
            </p>
            <Link
              to={`/${lang}/partnership`}
              className="btn-outline inline-flex items-center gap-2 text-sm w-full justify-center"
            >
              <PartnershipIcon size={14} />
              <span>{t('home.cta.schoolsCta', 'Partnership with EduChain')}</span>
            </Link>
          </div>

          <div className="card">
            <h3 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--color-accent-nft-pre)' }}>
              {t('home.cta.teachersTitle', 'Teacher?')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('home.cta.teachersBody', 'Learn how to become a certified Web3 educator and teach in a safe environment.')}
            </p>
            <Link
              to={`/${lang}/teachers`}
              className="btn-outline inline-flex items-center gap-2 text-sm w-full justify-center"
            >
              <TeachersIcon size={14} />
              <span>{t('home.cta.teachersCta', 'See for teachers')}</span>
            </Link>
          </div>

          <div className="card">
            <h3 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--color-accent)' }}>
              {t('home.cta.exploreTitle', 'Want to see the platform?')}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {t('home.cta.exploreBody', 'Explore the technical architecture, the 8 smart contracts, and how everything works live.')}
            </p>
            <Link
              to={`/${lang}/about`}
              className="btn-outline inline-flex items-center gap-2 text-sm w-full justify-center"
            >
              <FileText size={14} strokeWidth={2} aria-hidden="true" />
              <span>{t('home.cta.exploreCta', 'About EduChain')}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
