import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';
import { WalletIcon, GalleryIcon, TrophyIcon, NFTPredefinedIcon } from '../components/icons';

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

  const hasMemberAccess = isConnected && (isWhitelisted || isOwner || isAdmin);
  const ctaTo = hasMemberAccess ? `/${lang}/gallery` : `/${lang}`;
  const ctaLabel = hasMemberAccess
    ? t('home.ctaGetStarted', 'Get started')
    : t('home.ctaConnect', 'Connect wallet');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <section className="mb-8 text-center animate-fade-up">
        <h1 className="font-display text-4xl md:text-5xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('home.title', 'EduChain')}
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {t('home.subtitle', 'A hands-on Web3 platform: tokens, NFTs, marketplace, and an on-chain leaderboard.')}
        </p>
      </section>

      <section className="mb-8 animate-fade-up delay-100">
        <div className="max-w-[720px] mx-auto space-y-4 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>{t('home.description.p1', 'EduChain is an educational Web3 platform on the Sepolia testnet that turns smart contracts into a game. Connect MetaMask, claim free testnet ETH from the faucet, buy GAME tokens, and mint your own NFTs. Earn points from every transaction and compete with other students on the on-chain leaderboard.')}</p>
          <p>{t('home.description.p2', 'The project is built on 7 audited Solidity contracts — whitelist access, ERC20 tokens, two ERC721 NFT collections, a multi-token marketplace, and a tracking/leaderboard contract. Everything is transparent, verifiable, and free to experiment with.')}</p>
        </div>
      </section>

      <section className="mb-10 flex justify-center animate-fade-up delay-200">
        {hasMemberAccess ? (
          <Link to={ctaTo} className="btn-flat primary">
            <GalleryIcon size={16} color="currentColor" /> {ctaLabel} <ArrowRightIcon className="w-4 h-4" />
          </Link>
        ) : (
          <Link to={ctaTo} className="btn-flat primary">
            <WalletIcon size={16} color="currentColor" /> {ctaLabel}
          </Link>
        )}
      </section>

      {isConnected && !isWhitelisted && !isOwner && !isAdmin && (
        <section className="mb-10 max-w-[720px] mx-auto">
          <div className="card flex items-start gap-3" style={{ borderColor: 'color-mix(in srgb, var(--color-accent-faucet) 40%, transparent)' }}>
            <SparklesIcon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent-faucet)' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{t('home.notWhitelisted.title', 'You are not whitelisted yet')}</strong>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t('home.notWhitelisted.body', 'Ask an admin to add your address to the whitelist before you can mint or trade.')}
              </p>
            </div>
          </div>
        </section>
      )}

      <section
        className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 text-sm border-t border-b"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
        aria-label={t('home.stats.aria', 'Live on-chain stats')}
      >
        <div className="inline-flex items-center gap-2">
          <WalletIcon size={14} />
          <span style={{ color: 'var(--text-tertiary)' }}>{t('home.stats.users', 'Tracked users')}</span>
          <span className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{stats.totalUsers ?? '—'}</span>
        </div>
        <div className="inline-flex items-center gap-2">
          <NFTPredefinedIcon size={14} />
          <span style={{ color: 'var(--text-tertiary)' }}>{t('home.stats.predefined', 'Predefined NFTs minted')}</span>
          <span className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.predefinedSupply ?? '—'}<span className="font-normal" style={{ color: 'var(--text-tertiary)' }}> / 50</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2">
          <TrophyIcon size={14} />
          <span style={{ color: 'var(--text-tertiary)' }}>{t('home.stats.yourPoints', 'Your points')}</span>
          <span className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.yourPoints ?? (isConnected ? '0' : '—')}
          </span>
        </div>
      </section>
    </div>
  );
}
