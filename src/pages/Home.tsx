import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PhotoIcon, ShoppingBagIcon, BuildingStorefrontIcon, TrophyIcon,
  BeakerIcon, UserGroupIcon, SparklesIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';

interface Stats {
  totalUsers: number | null;
  predefinedSupply: number | null;
  yourPoints: number | null;
}

export default function Home() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();
  const { account, contracts, isConnected, isWhitelisted, isOwner, isAdmin } = useWeb3();
  const [stats, setStats] = useState<Stats>({ totalUsers: null, predefinedSupply: null, yourPoints: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!contracts.trackingContract || !contracts.gameNFTPredefined) return;
      try {
        const [eco, sales] = await Promise.all([
          contracts.trackingContract.getEcosystemStats().catch(() => null),
          contracts.gameNFTPredefined.getSalesStats().catch(() => null),
        ]);
        let yp: number | null = null;
        if (account) {
          try {
            const me = await contracts.trackingContract.getUserEntry(account);
            yp = Number(me.totalPoints ?? me[5] ?? 0);
          } catch { /* ignore */ }
        }
        if (cancelled) return;
        setStats({
          totalUsers: eco ? Number(eco.totalTrackedUsers ?? eco[0] ?? 0) : null,
          predefinedSupply: sales ? Number(sales.totalMinted ?? sales[1] ?? 0) : null,
          yourPoints: yp,
        });
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [contracts.trackingContract, contracts.gameNFTPredefined, account]);

  const features = [
    { to: `/${lang}/faucet`, icon: BeakerIcon, title: t('home.features.faucet.title', 'ETH Faucet'), body: t('home.features.faucet.body', 'Grab free Sepolia ETH to start.') },
    { to: `/${lang}/shop`, icon: ShoppingBagIcon, title: t('home.features.shop.title', 'Token & NFT Shop'), body: t('home.features.shop.body', 'Buy GAME tokens, mint NFTs.') },
    { to: `/${lang}/marketplace`, icon: BuildingStorefrontIcon, title: t('home.features.marketplace.title', 'Marketplace'), body: t('home.features.marketplace.body', 'List and trade your assets.') },
    { to: `/${lang}/gallery`, icon: PhotoIcon, title: t('home.features.gallery.title', 'My Gallery'), body: t('home.features.gallery.body', 'See your portfolio at a glance.') },
    { to: `/${lang}/leaderboard`, icon: TrophyIcon, title: t('home.features.leaderboard.title', 'Leaderboard'), body: t('home.features.leaderboard.body', 'Compete on the on-chain ranks.') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <section className="mb-10 animate-fade-up">
        <h1 className="font-display text-4xl md:text-5xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('home.title', 'EduChain')}
        </h1>
        <p className="text-lg max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          {t('home.subtitle', 'A hands-on Web3 platform: tokens, NFTs, marketplace, and an on-chain leaderboard.')}
        </p>

        {!isConnected && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('home.connectHint', 'Connect your wallet (top-right) to start.')}
          </p>
        )}

        {isConnected && !isWhitelisted && !isOwner && !isAdmin && (
          <div className="mt-6 card flex items-start gap-3" style={{ borderColor: 'rgba(217,119,6,0.3)' }}>
            <SparklesIcon className="w-5 h-5 mt-0.5" style={{ color: '#D97706' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{t('home.notWhitelisted.title', 'You are not whitelisted yet')}</strong>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('home.notWhitelisted.body', 'Ask an admin to add your address to the whitelist before you can mint or trade.')}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <Link key={f.to} to={f.to} className="card clickable">
              <Icon className="w-6 h-6 mb-3" style={{ color: 'var(--text-primary)' }} />
              <h3 className="font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.body}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <div className="card">
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-tertiary)' }}>
            <UserGroupIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider">{t('home.stats.users', 'Tracked users')}</span>
          </div>
          <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.totalUsers ?? '—'}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-tertiary)' }}>
            <PhotoIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider">{t('home.stats.predefined', 'Predefined NFTs minted')}</span>
          </div>
          <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.predefinedSupply ?? '—'} <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>/ 50</span>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-tertiary)' }}>
            <TrophyIcon className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider">{t('home.stats.yourPoints', 'Your points')}</span>
          </div>
          <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.yourPoints ?? (isConnected ? '0' : '—')}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {t('home.scoring.title', 'Points system')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('home.scoring.erc20', 'ERC20 token')}</div>
            <div className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>1 pt</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('home.scoring.predefined', 'Predefined NFT')}</div>
            <div className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>10 pts</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('home.scoring.custom', 'Custom NFT')}</div>
            <div className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>30 pts</div>
          </div>
        </div>
        <div className="mt-4">
          <Link to={`/${lang}/leaderboard`} className="btn-flat">
            {t('home.scoring.cta', 'See leaderboard')} <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
