import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EXPLORER_URL } from '../config/explorer';
import addresses from '../contracts/addresses.json';
import {
  ArchitectureIcon,
  StackIcon,
  LayersIcon,
  PartnershipIcon,
  TeachersIcon,
  ContactIcon,
  WhitelistIcon,
  TokenIcon,
  NFTPredefinedIcon,
  NFTCustomIcon,
  MarketplaceIcon,
  TrackingIcon,
  FaucetIcon,
  type IconProps,
} from '../components/icons';
import {
  ArrowRight,
  ExternalLink,
  Github,
  ShieldCheck,
  Server,
  Users,
  Code2,
  Scale,
  Lock,
  Baby,
} from 'lucide-react';

type IconCmp = (p: IconProps) => React.ReactElement;

interface ContractRow {
  key: string;
  Icon: IconCmp;
  address: string;
}

const CONTRACTS: ContractRow[] = [
  { key: 'whitelist',         Icon: WhitelistIcon,     address: addresses.whitelist },
  { key: 'gameToken',         Icon: TokenIcon,         address: addresses.gameToken },
  { key: 'gameNFTPredefined', Icon: NFTPredefinedIcon, address: addresses.gameNFTPredefined },
  { key: 'gameNFTCustom',     Icon: NFTCustomIcon,     address: addresses.gameNFTCustom },
  { key: 'marketplace',       Icon: MarketplaceIcon,   address: addresses.marketplace },
  { key: 'tracking',          Icon: TrackingIcon,      address: addresses.trackingContract },
  { key: 'faucet',            Icon: FaucetIcon,        address: addresses.ethFaucet },
];

const GITHUB_URL = 'https://github.com/ivanovslavy/EduChain';
const ETHERSCAN_BASE = `${EXPLORER_URL}/address`;

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function About() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();

  const journey = ['step1', 'step2', 'step3', 'step4', 'step5'];
  const securityLayers: Array<{ key: string; Icon: typeof Code2; color: string; itemCount: number }> = [
    { key: 'contractLayer',  Icon: Code2,  color: 'var(--color-accent-info)',    itemCount: 5 },
    { key: 'platformLayer',  Icon: Server, color: 'var(--color-accent-nft-cus)', itemCount: 5 },
    { key: 'classroomLayer', Icon: Users,  color: 'var(--color-accent-game)',    itemCount: 4 },
  ];
  const stackCategories: Array<{ key: string; Icon: IconCmp }> = [
    { key: 'contracts',      Icon: StackIcon },
    { key: 'frontend',       Icon: LayersIcon },
    { key: 'infrastructure', Icon: StackIcon },
    { key: 'integrations',   Icon: LayersIcon },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-16 animate-fade-up">
        <div
          className="inline-flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArchitectureIcon size={16} />
          <span>{t('about.hero.eyebrow', 'Technical documentation')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('about.hero.title', 'About EduChain')}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('about.hero.subtitle', 'The platform in detail — architecture, smart contracts, security mechanisms, and technology stack. Everything is publicly verifiable and runs on GembaBlockchain testnet.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={`${ETHERSCAN_BASE}/${CONTRACTS[0].address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-flat primary inline-flex items-center gap-2"
          >
            <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
            <span>{t('about.hero.ctaExplorer', 'View on GembaScan')}</span>
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline inline-flex items-center gap-2"
          >
            <Github size={16} strokeWidth={2} aria-hidden="true" />
            <span>{t('about.hero.ctaGithub', 'GitHub repository')}</span>
          </a>
        </div>
      </section>

      {/* OVERVIEW */}
      <section className="mb-16 animate-fade-up delay-100">
        <h2
          className="font-display text-2xl md:text-3xl font-semibold mb-6 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('about.overview.title', 'Overview')}
        </h2>
        <div
          className="max-w-[720px] mx-auto space-y-4 text-base leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p>{t('about.overview.p1', '')}</p>
          <p>{t('about.overview.p2', '')}</p>
          <p>{t('about.overview.p3', '')}</p>
        </div>
      </section>

      {/* USER JOURNEY — 5 numbered steps */}
      <section className="mb-16 animate-fade-up delay-100">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.journey.title', 'How the platform is used')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('about.journey.subtitle', '')}
          </p>
        </div>

        <div className="space-y-3">
          {journey.map((step) => (
            <div key={step} className="card">
              <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                <div
                  className="font-display text-3xl font-semibold mb-2 md:mb-0 md:min-w-[80px]"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t(`about.journey.${step}.number`, '')}
                </div>
                <div className="flex-1">
                  <h3
                    className="font-display text-lg font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t(`about.journey.${step}.title`, '')}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(`about.journey.${step}.body`, '')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SMART CONTRACTS — 8 deployed */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.contracts.title', 'Eight smart contracts')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('about.contracts.subtitle', '')}
          </p>
        </div>

        <div className="space-y-3">
          {CONTRACTS.map(({ key, Icon, address }) => (
            <div key={key} className="card">
              <div className="flex flex-col md:flex-row md:items-start md:gap-5">
                <div className="flex items-center gap-3 mb-2 md:mb-0 md:min-w-[180px]">
                  <Icon size={24} />
                  <div>
                    <div
                      className="font-display text-base font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t(`about.contracts.${key}.title`, '')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {t(`about.contracts.${key}.role`, '')}
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {t(`about.contracts.${key}.body`, '')}
                  </p>
                  <a
                    href={`${ETHERSCAN_BASE}/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <code style={{ fontFamily: 'monospace' }}>{shortAddress(address)}</code>
                    <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                    <span>{t('about.contracts.viewOnEtherscan', 'View on GembaScan')}</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY — 3 layers */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.security.title', 'Security')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('about.security.subtitle', '')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {securityLayers.map(({ key, Icon: LayerIcon, color, itemCount }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-4">
                <LayerIcon size={22} style={{ color }} aria-hidden="true" />
                <h3
                  className="font-display text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`about.security.${key}.title`, '')}
                </h3>
              </div>
              <ul
                className="space-y-2 text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {Array.from({ length: itemCount }, (_, i) => i + 1).map((i) => (
                  <li key={i} style={{ paddingLeft: '16px', position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '0.5em',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: color,
                      }}
                    />
                    {t(`about.security.${key}.item${i}`, '')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* TECH STACK — 4 categories */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.stack.title', 'Technology stack')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('about.stack.subtitle', '')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stackCategories.map(({ key, Icon: CatIcon }) => (
            <div key={key} className="card">
              <div className="flex items-center gap-3 mb-3">
                <CatIcon size={22} />
                <h3
                  className="font-display text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(`about.stack.${key}.title`, '')}
                </h3>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(`about.stack.${key}.items`, '')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* OPEN SOURCE */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.openSource.title', 'Open source and licensing')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('about.openSource.subtitle', '')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Github size={22} style={{ color: 'var(--text-primary)' }} aria-hidden="true" />
              <h3
                className="font-display text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('about.openSource.code.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('about.openSource.code.body', '')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Scale size={22} style={{ color: 'var(--color-accent-nft-pre)' }} aria-hidden="true" />
              <h3
                className="font-display text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('about.openSource.curriculum.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('about.openSource.curriculum.body', '')}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={22} style={{ color: 'var(--color-accent-eth)' }} aria-hidden="true" />
              <h3
                className="font-display text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('about.openSource.verification.title', '')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('about.openSource.verification.body', '')}
            </p>
          </div>
        </div>

        <div className="text-center">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline inline-flex items-center gap-2"
          >
            <Github size={16} strokeWidth={2} aria-hidden="true" />
            <span>{t('about.openSource.githubCta', 'Open in GitHub')}</span>
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* REGULATORY POSITION */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.regulatory.title', 'Regulatory position')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('about.regulatory.subtitle', '')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <Scale
              size={24}
              style={{ color: 'var(--color-accent-nft-cus)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3
              className="font-display text-base font-semibold mt-3 mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('about.regulatory.financial.title', '')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('about.regulatory.financial.body', '')}
            </p>
          </div>

          <div className="card">
            <Lock
              size={24}
              style={{ color: 'var(--color-accent-info)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3
              className="font-display text-base font-semibold mt-3 mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('about.regulatory.gdpr.title', '')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('about.regulatory.gdpr.body', '')}
            </p>
          </div>

          <div className="card">
            <Baby
              size={24}
              style={{ color: 'var(--color-accent-points)' }}
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3
              className="font-display text-base font-semibold mt-3 mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('about.regulatory.minors.title', '')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('about.regulatory.minors.body', '')}
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="text-center animate-fade-up delay-300">
        <div className="card" style={{ padding: '40px 24px' }}>
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('about.cta.title', 'Want to learn more?')}
          </h2>
          <p
            className="text-base max-w-xl mx-auto mb-6 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('about.cta.subtitle', '')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/${lang}/partnership`}
              className="btn-flat primary inline-flex items-center gap-2"
            >
              <PartnershipIcon size={16} />
              <span>{t('about.cta.partnership', 'For schools')}</span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              to={`/${lang}/teachers`}
              className="btn-outline inline-flex items-center gap-2"
            >
              <TeachersIcon size={16} />
              <span>{t('about.cta.teachers', 'For teachers')}</span>
            </Link>
            <Link
              to={`/${lang}/contact`}
              className="btn-outline inline-flex items-center gap-2"
            >
              <ContactIcon size={16} />
              <span>{t('about.cta.contact', 'Contact')}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
