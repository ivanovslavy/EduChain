import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import addresses from '../contracts/addresses.json';
import {
  WhitelistIcon, TokenIcon, NFTPredefinedIcon, NFTCustomIcon,
  MarketplaceIcon, TrackingIcon, FaucetIcon, ContactIcon,
  type IconProps,
} from '../components/icons';

type IconCmp = (p: IconProps) => React.ReactElement;

interface ContractRow {
  key: string;
  Icon: IconCmp;
  addr: string;
}

const CONTRACTS: ContractRow[] = [
  { key: 'whitelist',         Icon: WhitelistIcon,      addr: addresses.whitelist },
  { key: 'gameToken',         Icon: TokenIcon,          addr: addresses.gameToken },
  { key: 'gameNFTPredefined', Icon: NFTPredefinedIcon,  addr: addresses.gameNFTPredefined },
  { key: 'gameNFTCustom',     Icon: NFTCustomIcon,      addr: addresses.gameNFTCustom },
  { key: 'marketplace',       Icon: MarketplaceIcon,    addr: addresses.marketplace },
  { key: 'tracking',          Icon: TrackingIcon,       addr: addresses.trackingContract },
  { key: 'faucet',            Icon: FaucetIcon,         addr: addresses.ethFaucet },
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
          {CONTRACTS.map(({ key, Icon, addr }) => (
            <a
              key={key}
              href={`https://sepolia.etherscan.io/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-start gap-3"
            >
              <Icon size={22} />
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t(`about.contract.${key}.title`, key)}
                </div>
                <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {t(`about.contract.${key}.desc`, '')}
                </div>
                <code className="text-xs break-all" style={{ color: 'var(--text-tertiary)' }}>{addr}</code>
              </div>
            </a>
          ))}
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
          <ContactIcon size={16} color="currentColor" /> {t('about.cta', 'Contact us')}
        </Link>
        <Link to={`/${lang}`} className="btn-flat">
          {t('about.back', 'Back to home')} <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
