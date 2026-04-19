import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ShieldCheckIcon, CurrencyDollarIcon, PhotoIcon, BuildingStorefrontIcon,
  ChartBarIcon, BeakerIcon, EnvelopeIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';

const CONTRACTS = [
  { key: 'whitelist', icon: ShieldCheckIcon, addr: '0x513E438f503DDC99c8040df21fEda0b85201AEa0' },
  { key: 'gameToken', icon: CurrencyDollarIcon, addr: '0x04542084507Cf43819Fb28D687976b4517cDD3Fa' },
  { key: 'gameNFTPredefined', icon: PhotoIcon, addr: '0xccc3cB6aC4fa1BD69ff2cE350DF49ff5E7083bcE' },
  { key: 'gameNFTCustom', icon: PhotoIcon, addr: '0x77E092a4Bcd95F3B7f150A33A3D1e795c330BaD7' },
  { key: 'marketplace', icon: BuildingStorefrontIcon, addr: '0x8EEcE7E9F604c89562409702E71CD01094eddFc7' },
  { key: 'tracking', icon: ChartBarIcon, addr: '0x038aa50d5ffF095cf91801c0ede71505F7ad46d4' },
  { key: 'faucet', icon: BeakerIcon, addr: '0xE819230934BbE7886b48f99D2D29b67E0531f4fD' },
];

export default function About() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {t('about.title', 'About EduChain')}
      </h1>
      <p className="text-base max-w-2xl mb-10" style={{ color: 'var(--text-secondary)' }}>
        {t('about.intro', 'EduChain is a learn-by-doing Web3 platform built around 7 audited Solidity contracts on Sepolia: a Whitelist gate, an ERC20 token, two ERC721 NFT collections, a multi-token marketplace, a tracking + leaderboard contract, and an ETH faucet.')}
      </p>

      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {t('about.contractsTitle', 'The 7 contracts')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONTRACTS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.key}
                href={`https://sepolia.etherscan.io/address/${c.addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex items-start gap-3"
              >
                <Icon className="w-5 h-5 mt-0.5" style={{ color: 'var(--text-primary)' }} />
                <div className="min-w-0">
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t(`about.contract.${c.key}.title`, c.key)}
                  </div>
                  <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t(`about.contract.${c.key}.desc`, '')}
                  </div>
                  <code className="text-xs break-all" style={{ color: 'var(--text-tertiary)' }}>{c.addr}</code>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('about.howTitle', 'How it works')}
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>{t('about.howSteps.1', 'An admin adds your address to the whitelist.')}</li>
          <li>{t('about.howSteps.2', 'Grab 0.05 ETH from the faucet (every 24h).')}</li>
          <li>{t('about.howSteps.3', 'Buy GAME tokens or mint NFTs in the shop.')}</li>
          <li>{t('about.howSteps.4', 'List items in the marketplace, or batch-mint custom NFTs with GAME.')}</li>
          <li>{t('about.howSteps.5', 'Climb the leaderboard: tokens × 1 pt, predefined NFTs × 10, custom NFTs × 30.')}</li>
        </ol>
      </section>

      <div className="flex gap-3">
        <Link to={`/${lang}/contact`} className="btn-flat primary">
          <EnvelopeIcon className="w-4 h-4" /> {t('about.cta', 'Contact us')}
        </Link>
        <Link to={`/${lang}`} className="btn-flat">
          {t('about.back', 'Back to home')} <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
