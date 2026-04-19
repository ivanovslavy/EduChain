import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowPathIcon, MagnifyingGlassIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { TrackingIcon } from '../components/icons';
import { useWeb3 } from '../context/Web3Context';
import PageGate from '../components/PageGate';
import { fmtPoints, fmtEth, parseTier, shorten } from '../lib/format';

interface UserRow {
  address: string;
  points: bigint;
  netWorth: bigint;
  tier: number;
  erc20: number;
  nftPre: number;
  nftCus: number;
  active: boolean;
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PAGE_BATCH = 100;

function parseEntry(e: any): UserRow {
  return {
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

function RankingsInner() {
  const { t } = useTranslation();
  const { contracts } = useWeb3();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [minPoints, setMinPoints] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'points' | 'netWorth' | 'erc20' | 'nftPre' | 'nftCus' | 'tier'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    if (!contracts.trackingContract) return;
    setLoading(true);
    try {
      const all: UserRow[] = [];
      let start = 0;
      let total = 0;
      do {
        const res = await contracts.trackingContract.getLeaderboardPaginated(start, PAGE_BATCH);
        const entries: any[] = Array.isArray(res[0]) ? res[0] : [];
        total = Number(res[1] ?? entries.length);
        for (const e of entries) all.push(parseEntry(e));
        start += entries.length;
        if (entries.length === 0) break;
      } while (start < total);
      setUsers(all);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Rankings load error', e);
    } finally { setLoading(false); }
  }, [contracts.trackingContract]);

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load, autoRefresh]);

  const filtered = useMemo(() => {
    let r = [...users];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((u) => u.address.toLowerCase().includes(q));
    }
    if (minPoints && !isNaN(Number(minPoints))) {
      const min = BigInt(Math.floor(Number(minPoints)));
      r = r.filter((u) => u.points >= min);
    }
    if (tierFilter !== 'all') {
      const tNum = Number(tierFilter);
      r = r.filter((u) => u.tier === tNum);
    }
    if (activeOnly) r = r.filter((u) => u.active);

    r.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'points') return a.points === b.points ? 0 : (a.points < b.points ? -1 : 1) * dir;
      if (sortBy === 'netWorth') return a.netWorth === b.netWorth ? 0 : (a.netWorth < b.netWorth ? -1 : 1) * dir;
      const get = (x: UserRow) => sortBy === 'erc20' ? x.erc20
        : sortBy === 'nftPre' ? x.nftPre
        : sortBy === 'nftCus' ? x.nftCus
        : x.tier;
      return (get(a) - get(b)) * dir;
    });
    return r;
  }, [users, search, minPoints, tierFilter, activeOnly, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, minPoints, tierFilter, activeOnly, sortBy, sortOrder, pageSize]);

  const clear = () => {
    setSearch(''); setMinPoints(''); setTierFilter('all'); setActiveOnly(false);
    setSortBy('points'); setSortOrder('desc'); setPage(1);
  };

  const copy = (a: string) => { navigator.clipboard.writeText(a); };

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <TrackingIcon size={28} /> {t('rankings.title', 'Rankings')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('rankings.subtitle', 'Full paginated leaderboard with filters and sort.')}</p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label={t('rankings.stats.total', 'Tracked users')} value={users.length} />
        <Stat label={t('rankings.stats.filtered', 'After filters')} value={filtered.length} />
        <Stat label={t('rankings.stats.shown', 'On this page')} value={paged.length} />
        <Stat label={t('rankings.stats.updated', 'Updated')} value={lastUpdate ? lastUpdate.toLocaleTimeString() : '—'} />
      </section>

      <section className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <MagnifyingGlassIcon className="w-5 h-5" /> {t('rankings.filters.title', 'Filters')}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              {t('rankings.filters.autoRefresh', 'Auto-refresh (30s)')}
            </label>
            <button type="button" className="btn-flat" onClick={load} disabled={loading}>
              <ArrowPathIcon className="w-4 h-4" /> {loading ? t('common.loading', 'Loading…') : t('common.refresh', 'Refresh')}
            </button>
            <button type="button" className="btn-flat" onClick={clear}>{t('rankings.filters.clear', 'Clear')}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={t('rankings.filters.search', 'Search address')}>
            <input className="form-input" placeholder="0x… or partial" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Field label={t('rankings.filters.minPoints', 'Min. points')}>
            <input className="form-input" type="number" placeholder="0" value={minPoints} onChange={(e) => setMinPoints(e.target.value)} />
          </Field>
          <Field label={t('rankings.filters.tier', 'Tier')}>
            <select className="form-input" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
              <option value="all">{t('rankings.filters.opt.all', 'All tiers')}</option>
              <option value="4">{t('rankings.filters.opt.platinum', 'Platinum')}</option>
              <option value="3">{t('rankings.filters.opt.gold', 'Gold')}</option>
              <option value="2">{t('rankings.filters.opt.silver', 'Silver')}</option>
              <option value="1">{t('rankings.filters.opt.bronze', 'Bronze')}</option>
              <option value="0">{t('rankings.filters.opt.unranked', 'Unranked')}</option>
            </select>
          </Field>
          <Field label={t('rankings.filters.activeOnly', 'Whitelist status')}>
            <label className="inline-flex items-center gap-2 text-sm pt-2" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              {t('rankings.filters.activeOnlyLabel', 'Active only')}
            </label>
          </Field>
          <Field label={t('rankings.filters.sortBy', 'Sort by')}>
            <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="points">{t('rankings.filters.opt.points', 'Points')}</option>
              <option value="netWorth">{t('rankings.filters.opt.netWorth', 'Net worth')}</option>
              <option value="tier">{t('rankings.filters.opt.tierSort', 'Tier')}</option>
              <option value="erc20">{t('rankings.filters.opt.erc20', 'ERC20')}</option>
              <option value="nftPre">{t('rankings.filters.opt.nftPre', 'NFT Predefined')}</option>
              <option value="nftCus">{t('rankings.filters.opt.nftCus', 'NFT Custom')}</option>
            </select>
          </Field>
          <Field label={t('rankings.filters.sortOrder', 'Order')}>
            <select className="form-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
              <option value="desc">{t('rankings.filters.opt.desc', 'High to low')}</option>
              <option value="asc">{t('rankings.filters.opt.asc', 'Low to high')}</option>
            </select>
          </Field>
          <Field label={t('rankings.filters.perPage', 'Per page')}>
            <select className="form-input" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card overflow-x-auto mb-4">
        {paged.length === 0 ? (
          <div className="text-sm py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
            {loading ? t('common.loading', 'Loading…') : t('rankings.empty', 'No matching results.')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                <th className="text-left py-2 pr-3">#</th>
                <th className="text-left py-2 pr-3">{t('rankings.table.address', 'Address')}</th>
                <th className="text-left py-2 px-3">{t('rankings.table.tier', 'Tier')}</th>
                <th className="text-right py-2 px-3">ERC20</th>
                <th className="text-right py-2 px-3">{t('rankings.table.nftPre', 'NFT Pre')}</th>
                <th className="text-right py-2 px-3">{t('rankings.table.nftCus', 'NFT Cus')}</th>
                <th className="text-right py-2 px-3">{t('rankings.table.netWorth', 'Net worth')}</th>
                <th className="text-right py-2 px-3">{t('rankings.table.points', 'Points')}</th>
                <th className="text-right py-2 pl-3"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((u) => {
                const rank = filtered.findIndex((x) => x.address === u.address) + 1;
                const tier = parseTier(u.tier);
                return (
                  <tr key={u.address} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-2 pr-3 font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {MEDALS[rank] ? `${MEDALS[rank]} ${rank}` : rank}
                    </td>
                    <td className="py-2 pr-3 font-mono" style={{ color: 'var(--text-secondary)' }} title={u.address}>
                      {shorten(u.address)}
                      {!u.active && <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>•{t('rankings.table.inactive', 'inactive')}</span>}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: tier.color }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: tier.color }} />
                        {tier.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--text-secondary)' }}>{u.erc20}</td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--text-secondary)' }}>{u.nftPre}</td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--text-secondary)' }}>{u.nftCus}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{fmtEth(u.netWorth, 3)}</td>
                    <td className="py-2 px-3 text-right font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtPoints(u.points)}</td>
                    <td className="py-2 pl-3 text-right">
                      <button type="button" className="btn-flat" onClick={() => copy(u.address)} title={t('rankings.copy', 'Copy')}>
                        <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button className="btn-flat" onClick={() => setPage(1)} disabled={page === 1}>{t('rankings.pager.first', '« First')}</button>
          <button className="btn-flat" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>{t('rankings.pager.prev', '‹ Prev')}</button>
          <span className="text-sm px-2" style={{ color: 'var(--text-secondary)' }}>{t('rankings.pager.page', 'Page')} {page} / {totalPages}</span>
          <button className="btn-flat" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{t('rankings.pager.next', 'Next ›')}</button>
          <button className="btn-flat" onClick={() => setPage(totalPages)} disabled={page === totalPages}>{t('rankings.pager.last', 'Last »')}</button>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function Rankings() {
  return (
    <PageGate requires="whitelisted">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <RankingsInner />
      </div>
    </PageGate>
  );
}
