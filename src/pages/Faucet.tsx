import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon, BanknotesIcon, ArrowDownTrayIcon,
  ChartBarIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';
import { FaucetIcon } from '../components/icons';
import { useWeb3 } from '../context/Web3Context';
import { useEthersProvider } from '../lib/ethersAdapter';
import PageGate from '../components/PageGate';
import { useTxToast } from '../hooks/useTxToast';
import { fmtEth, formatCountdown } from '../lib/format';

function FaucetInner() {
  const { t } = useTranslation();
  const { account, contracts } = useWeb3();
  const provider = useEthersProvider();
  const { execute } = useTxToast();

  const [loading, setLoading] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [secondsUntilNext, setSecondsUntilNext] = useState(0);
  const [nextAmount, setNextAmount] = useState<bigint>(0n);
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [faucetStats, setFaucetStats] = useState({
    balance: 0n, claimAmount: 0n, cooldown: 0n, totalDispensed: 0n,
    totalClaims: 0, uniqueClaimers: 0, maxPossibleClaims: 0,
  });
  const [userStats, setUserStats] = useState({
    lastClaim: 0, claimCount: 0, totalClaimed: 0n,
  });

  const loadAll = useCallback(async () => {
    if (!contracts.ethFaucet || !account) return;
    try {
      const [stats, ust, bal] = await Promise.all([
        contracts.ethFaucet.getFaucetStats().catch(() => null),
        contracts.ethFaucet.getUserClaimStats(account).catch(() => null),
        provider ? provider.getBalance(account).catch(() => 0n) : Promise.resolve(0n),
      ]);
      if (stats) {
        setFaucetStats({
          balance: BigInt(stats.balance ?? stats[0] ?? 0n),
          claimAmount: BigInt(stats.claimAmount ?? stats[1] ?? 0n),
          cooldown: BigInt(stats.cooldown ?? stats[2] ?? 0n),
          totalDispensed: BigInt(stats.totalDispensed ?? stats[3] ?? 0n),
          totalClaims: Number(stats.totalClaims ?? stats[4] ?? 0n),
          uniqueClaimers: Number(stats.uniqueClaimers ?? stats[5] ?? 0n),
          maxPossibleClaims: Number(stats.maxPossibleClaims ?? stats[6] ?? 0n),
        });
      }
      if (ust) {
        setUserStats({
          lastClaim: Number(ust.lastClaim ?? ust[0] ?? 0n),
          claimCount: Number(ust.claimCount ?? ust[1] ?? 0n),
          totalClaimed: BigInt(ust.totalClaimed ?? ust[2] ?? 0n),
        });
        setCanClaim(!!(ust.canClaimNow ?? ust[3]));
        setSecondsUntilNext(Number(ust.secondsUntilNextClaim ?? ust[4] ?? 0n));
        setNextAmount(BigInt(ust.nextClaimAmount ?? ust[5] ?? 0n));
      }
      setUserBalance(BigInt(bal));
    } catch (e) {
      console.error('Faucet load error', e);
    }
  }, [contracts.ethFaucet, account, provider]);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 10000);
    return () => clearInterval(id);
  }, [loadAll]);

  useEffect(() => {
    if (secondsUntilNext <= 0) return;
    const id = setInterval(() => {
      setSecondsUntilNext((p) => {
        if (p <= 1) { loadAll(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsUntilNext, loadAll]);

  const isFaucetEmpty = faucetStats.balance < nextAmount && nextAmount > 0n;

  const claim = async () => {
    if (!contracts.ethFaucet) return;
    setLoading(true);
    const receipt = await execute(
      () => contracts.ethFaucet!.claim(),
      {
        pending: t('tx.pending.claim_faucet', 'Claiming ETH...'),
        success: t('tx.success.claim_faucet', 'ETH claimed'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) await loadAll();
    setLoading(false);
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <FaucetIcon size={28} /> {t('faucet.title', 'ETH Faucet')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('faucet.subtitle', 'Free Sepolia ETH for whitelisted users.')}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('faucet.yourBalance', 'Your wallet ETH')}</div>
          <div className="font-display text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {fmtEth(userBalance, 4)} <span className="text-base font-normal" style={{ color: 'var(--text-tertiary)' }}>ETH</span>
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('faucet.youGet', 'You will receive')}</div>
          <div className="font-display text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {fmtEth(nextAmount, 4)} <span className="text-base font-normal" style={{ color: 'var(--text-tertiary)' }}>ETH</span>
          </div>
          <div className="mt-4">
            {isFaucetEmpty ? (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {t('faucet.depleted', 'Faucet depleted — ask admin to refill.')}
              </div>
            ) : canClaim ? (
              <button
                type="button"
                className="btn-flat primary w-full justify-center"
                onClick={claim}
                disabled={loading}
                style={{ background: 'var(--color-accent-faucet)', borderColor: 'var(--color-accent-faucet)', color: '#fff' }}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                {loading ? t('faucet.claiming', 'Claiming…') : t('faucet.claim', 'Claim ETH now')}
              </button>
            ) : (
              <div
                className="rounded-lg p-3 text-sm flex items-center gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--color-accent-faucet) 8%, var(--bg-secondary))',
                  color: 'var(--text-secondary)',
                  border: '1px solid color-mix(in srgb, var(--color-accent-faucet) 25%, transparent)',
                }}
              >
                <ClockIcon className="w-4 h-4" style={{ color: 'var(--color-accent-faucet)' }} />
                {t('faucet.cooldown', 'Next claim in')}{' '}
                <span className="font-mono font-semibold" style={{ color: 'var(--color-accent-faucet)' }}>{formatCountdown(secondsUntilNext)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('faucet.yourStats', 'Your faucet activity')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('faucet.totalClaims', 'Total claims')}</div>
            <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{userStats.claimCount}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('faucet.totalReceived', 'Total received')}</div>
            <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(userStats.totalClaimed, 3)} ETH</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('faucet.lastClaim', 'Last claim')}</div>
            <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {userStats.lastClaim > 0 ? new Date(userStats.lastClaim * 1000).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('faucet.contractStats', 'Faucet status')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-tertiary)' }}>
              <BanknotesIcon className="w-3.5 h-3.5" /> {t('faucet.balance', 'Balance')}
            </div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(faucetStats.balance, 3)} ETH</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-tertiary)' }}>
              <ChartBarIcon className="w-3.5 h-3.5" /> {t('faucet.distributed', 'Distributed')}
            </div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(faucetStats.totalDispensed, 3)} ETH</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-tertiary)' }}>
              <ArrowDownTrayIcon className="w-3.5 h-3.5" /> {t('faucet.requests', 'Claims')}
            </div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{faucetStats.totalClaims}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-tertiary)' }}>
              <UserGroupIcon className="w-3.5 h-3.5" /> {t('faucet.activeUsers', 'Unique claimers')}
            </div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{faucetStats.uniqueClaimers}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Faucet() {
  return (
    <PageGate requires="whitelisted">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <FaucetInner />
      </div>
    </PageGate>
  );
}
