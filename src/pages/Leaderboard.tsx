import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TrophyIcon, ArrowRightIcon, UserCircleIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';
import PageGate from '../components/PageGate';
import { fmtPoints, fmtEth, parseTier, shorten } from '../lib/format';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface Row {
  rank: number;
  address: string;
  points: bigint;
  netWorth: bigint;
  tier: number;
  erc20: number;
  nftPre: number;
  nftCus: number;
  active: boolean;
}

function parseEntry(e: any, rank: number): Row {
  return {
    rank,
    address: e.user ?? e[0],
    points: BigInt(e.totalPoints ?? e[5] ?? 0n),
    netWorth: BigInt(e.netWorthWei ?? e[6] ?? 0n),
    tier: Number(e.tier ?? e[7] ?? 0),
    erc20: Number(e.erc20Whole ?? e[2] ?? 0n),
    nftPre: Number(e.predefinedCount ?? e[3] ?? 0n),
    nftCus: Number(e.customCount ?? e[4] ?? 0n),
    active: !!(e.isCurrentlyWhitelisted ?? e[8]),
  };
}

function LeaderboardInner() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();
  const { account, contracts } = useWeb3();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myEntry, setMyEntry] = useState<Row | null>(null);

  const load = useCallback(async () => {
    if (!contracts.trackingContract) return;
    setLoading(true);
    try {
      const all: Row[] = [];
      let start = 0;
      let total = 0;
      const PAGE = 100;
      do {
        const res = await contracts.trackingContract.getLeaderboardPaginated(start, PAGE);
        const entries: any[] = Array.isArray(res[0]) ? res[0] : [];
        total = Number(res[1] ?? entries.length);
        for (const e of entries) all.push(parseEntry(e, 0));
        start += entries.length;
        if (entries.length === 0) break;
      } while (start < total);

      all.sort((a, b) => {
        if (b.points > a.points) return 1;
        if (b.points < a.points) return -1;
        return 0;
      });
      const ranked: Row[] = all.map((r, i) => ({ ...r, rank: i + 1 }));
      const top10 = ranked.slice(0, 10);
      setRows(top10);

      if (account) {
        const me = ranked.find((r) => r.address.toLowerCase() === account.toLowerCase());
        if (me) {
          setMyRank(me.rank);
          setMyEntry(me);
        } else {
          setMyRank(null);
          try {
            const raw = await contracts.trackingContract.getUserEntry(account);
            setMyEntry(parseEntry(raw, 0));
          } catch { setMyEntry(null); }
        }
      }
    } catch (e) {
      console.error('Leaderboard load error', e);
    } finally {
      setLoading(false);
    }
  }, [contracts.trackingContract, account]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const myTier = parseTier(myEntry?.tier ?? 0);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <TrophyIcon className="w-7 h-7" /> {t('leaderboard.title', 'Leaderboard')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('leaderboard.subtitle', 'Top 10 players, live from on-chain points.')}</p>
      </header>

      <section className="card mb-6 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <UserCircleIcon className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.you', 'You')}</div>
            <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {myRank ? `#${myRank} ${MEDALS[myRank] ?? ''}` : t('leaderboard.notRanked', 'Not in top 10')}
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.points', 'Points')}</div>
          <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtPoints(myEntry?.points ?? 0n)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.tier', 'Tier')}</div>
          <div className="font-display text-xl font-semibold inline-flex items-center gap-2" style={{ color: myTier.color }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: myTier.color }} />
            {myTier.label}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.netWorth', 'Net worth')}</div>
          <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(myEntry?.netWorth ?? 0n, 4)} ETH</div>
        </div>
      </section>

      {podium.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[2, 1, 3].map((rank) => {
            const r = podium.find((x) => x.rank === rank);
            if (!r) return <div key={rank} className="card" />;
            const isMe = r.address.toLowerCase() === account?.toLowerCase();
            const tier = parseTier(r.tier);
            return (
              <div key={r.address} className="card text-center" style={isMe ? { borderColor: 'var(--color-primary)' } : undefined}>
                <div className="text-3xl mb-1">{MEDALS[r.rank]}</div>
                <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>#{r.rank}</div>
                <div className="font-mono text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{shorten(r.address)}</div>
                <div className="font-display text-xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{fmtPoints(r.points)} pts</div>
                <div className="inline-flex items-center gap-1.5 text-xs mt-1" style={{ color: tier.color }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: tier.color }} /> {tier.label}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="card mb-6">
        <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('leaderboard.fullTop10', 'Top 10')}</h2>
        {loading && rows.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('common.loading', 'Loading…')}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.empty', 'No players yet.')}</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {(rest.length === 0 ? podium : rows).map((r) => (
              <RowView key={r.address} r={r} isMe={r.address.toLowerCase() === account?.toLowerCase()} />
            ))}
          </div>
        )}
      </section>

      <section className="card mb-6">
        <h2 className="font-display text-lg font-semibold mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <SparklesIcon className="w-5 h-5" /> {t('leaderboard.scoring.title', 'How points work')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-3">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.scoring.erc20', 'ERC20 token')}</div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>× 1 pt</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.scoring.predefined', 'Predefined NFT')}</div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>× 10 pts</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div style={{ color: 'var(--text-tertiary)' }}>{t('leaderboard.scoring.custom', 'Custom NFT')}</div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>× 30 pts</div>
          </div>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('leaderboard.scoring.example', 'Example: 5 tokens + 2 predefined + 1 custom = 5 + 20 + 30 = 55 pts.')}
        </div>
      </section>

      <Link to={`/${lang}/rankings`} className="btn-flat">
        {t('leaderboard.viewFull', 'View full rankings')} <ArrowRightIcon className="w-4 h-4" />
      </Link>
    </>
  );
}

function RowView({ r, isMe }: { r: Row; isMe: boolean }) {
  const tier = parseTier(r.tier);
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={isMe ? { background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' } : undefined}
    >
      <div className="w-10 text-center font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
        {MEDALS[r.rank] ?? `#${r.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{shorten(r.address)}</div>
        <div className="inline-flex items-center gap-1.5 text-xs mt-0.5" style={{ color: tier.color }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: tier.color }} /> {tier.label}
        </div>
      </div>
      {isMe && <span className="status-pill success">YOU</span>}
      <div className="text-right">
        <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtPoints(r.points)} pts</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtEth(r.netWorth, 3)} ETH</div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  return (
    <PageGate requires="whitelisted">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <LeaderboardInner />
      </div>
    </PageGate>
  );
}
