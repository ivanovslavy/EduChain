import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Contract } from 'ethers';
import {
  BookOpenIcon, PencilSquareIcon,
  ArrowTopRightOnSquareIcon, UserGroupIcon, CurrencyDollarIcon,
  PhotoIcon, SparklesIcon, BuildingStorefrontIcon, ChartBarIcon, BanknotesIcon,
} from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';
import PageGate from '../components/PageGate';
import { AdminIcon } from '../components/icons';
import FunctionForm, { AbiFragment, isReadFn } from '../components/FunctionForm';

import WhitelistABI from '../contracts/abis/Whitelist.json';
import GameTokenABI from '../contracts/abis/GameToken.json';
import GameNFTPredefinedABI from '../contracts/abis/GameNFTPredefined.json';
import GameNFTCustomABI from '../contracts/abis/GameNFTCustom.json';
import TokenMarketplaceABI from '../contracts/abis/TokenMarketplace.json';
import TrackingContractABI from '../contracts/abis/TrackingContract.json';
import ETHFaucetABI from '../contracts/abis/ETHFaucet.json';

const ETHERSCAN = 'https://sepolia.etherscan.io/address/';

type ContractKey =
  | 'whitelist' | 'gameToken' | 'gameNFTPredefined' | 'gameNFTCustom'
  | 'marketplace' | 'trackingContract' | 'ethFaucet';

interface ContractDef {
  key: ContractKey;
  label: string;
  abi: any;
  icon: any;
  descKey: string;
  descFallback: string;
}

const CONTRACT_DEFS: ContractDef[] = [
  { key: 'whitelist', label: 'Whitelist', abi: WhitelistABI, icon: UserGroupIcon,
    descKey: 'admin.desc.whitelist', descFallback: 'Access gate. Add, remove, and check whitelisted users and admins.' },
  { key: 'gameToken', label: 'GameToken (ERC20)', abi: GameTokenABI, icon: CurrencyDollarIcon,
    descKey: 'admin.desc.gameToken', descFallback: 'GAME ERC20 token. Transfers, balances, and supply operations.' },
  { key: 'gameNFTPredefined', label: 'GameNFTPredefined (ERC721)', abi: GameNFTPredefinedABI, icon: PhotoIcon,
    descKey: 'admin.desc.gameNFTPredefined', descFallback: 'Curated NFT collection with fixed tokenURIs. Worth 10 points each.' },
  { key: 'gameNFTCustom', label: 'GameNFTCustom (ERC721)', abi: GameNFTCustomABI, icon: SparklesIcon,
    descKey: 'admin.desc.gameNFTCustom', descFallback: 'User-created NFTs with custom metadata. Worth 30 points each.' },
  { key: 'marketplace', label: 'TokenMarketplace', abi: TokenMarketplaceABI, icon: BuildingStorefrontIcon,
    descKey: 'admin.desc.marketplace', descFallback: 'Peer-to-peer marketplace for tokens and NFTs between whitelisted users.' },
  { key: 'trackingContract', label: 'TrackingContract', abi: TrackingContractABI, icon: ChartBarIcon,
    descKey: 'admin.desc.trackingContract', descFallback: 'Leaderboard, points, and tier tracking for all users.' },
  { key: 'ethFaucet', label: 'ETHFaucet', abi: ETHFaucetABI, icon: BanknotesIcon,
    descKey: 'admin.desc.ethFaucet', descFallback: 'Dispenses 0.05 Sepolia ETH every 24h to whitelisted users.' },
];

const READ_CATEGORIES: Array<{ key: string; labelKey: string; labelFallback: string; match: (name: string) => boolean }> = [
  { key: 'roles', labelKey: 'admin.cat.roles', labelFallback: 'Roles & access',
    match: (n) => /owner|admin|whitelist|role|allow|buyer/i.test(n) },
  { key: 'balances', labelKey: 'admin.cat.balances', labelFallback: 'Balances & supply',
    match: (n) => /balance|supply|totalSupply|allowance/i.test(n) },
  { key: 'stats', labelKey: 'admin.cat.stats', labelFallback: 'Stats & leaderboard',
    match: (n) => /stat|leaderboard|rank|points|tier|ecosystem|top/i.test(n) },
  { key: 'metadata', labelKey: 'admin.cat.metadata', labelFallback: 'Token metadata',
    match: (n) => /uri|name|symbol|decimals|image|description/i.test(n) },
  { key: 'listings', labelKey: 'admin.cat.listings', labelFallback: 'Listings',
    match: (n) => /listing|market|order|sale/i.test(n) },
  { key: 'limits', labelKey: 'admin.cat.limits', labelFallback: 'Limits & config',
    match: (n) => /price|cooldown|max|min|limit|fee|rate|duration|config/i.test(n) },
];

const WRITE_CATEGORIES: Array<{ key: string; labelKey: string; labelFallback: string; match: (name: string) => boolean }> = [
  { key: 'governance', labelKey: 'admin.cat.governance', labelFallback: 'Governance & ownership',
    match: (n) => /owner|admin|whitelist|renounce|transferOwnership|grant|revoke|pause|unpause/i.test(n) },
  { key: 'configure', labelKey: 'admin.cat.configure', labelFallback: 'Configuration',
    match: (n) => /setPrice|setFee|setCooldown|setMax|setMin|setLimit|setBase|setURI|setConfig|update|fund/i.test(n) },
  { key: 'mint_burn', labelKey: 'admin.cat.mint_burn', labelFallback: 'Mint & burn',
    match: (n) => /mint|burn|withdraw/i.test(n) },
  { key: 'user_actions', labelKey: 'admin.cat.user_actions', labelFallback: 'User actions',
    match: (n) => /buy|claim|list|cancel|purchase|approve|transfer|send/i.test(n) },
];

function extractFunctions(abiJson: any): AbiFragment[] {
  const abi = abiJson?.abi ?? abiJson ?? [];
  return (abi as any[]).filter((f) => f.type === 'function') as AbiFragment[];
}

function categorize(fns: AbiFragment[], cats: typeof READ_CATEGORIES) {
  const groups = new Map<string, { labelKey: string; labelFallback: string; items: AbiFragment[] }>();
  const other: AbiFragment[] = [];
  for (const f of fns) {
    const cat = cats.find((c) => c.match(f.name));
    if (!cat) { other.push(f); continue; }
    if (!groups.has(cat.key)) groups.set(cat.key, { labelKey: cat.labelKey, labelFallback: cat.labelFallback, items: [] });
    groups.get(cat.key)!.items.push(f);
  }
  const ordered = cats
    .filter((c) => groups.has(c.key))
    .map((c) => ({ key: c.key, labelKey: c.labelKey, labelFallback: c.labelFallback, items: groups.get(c.key)!.items.sort((a, b) => a.name.localeCompare(b.name)) }));
  if (other.length) {
    ordered.push({ key: 'other', labelKey: 'admin.cat.other', labelFallback: 'Other', items: other.sort((a, b) => a.name.localeCompare(b.name)) });
  }
  return ordered;
}

const OWNER_ONLY_WRITE = /^(transferOwnership|renounceOwnership|addAdmin|removeAdmin|setOwner)$/;

function AdminInner() {
  const { t } = useTranslation();
  const { account, contracts, isOwner } = useWeb3();
  const [activeKey, setActiveKey] = useState<ContractKey>('whitelist');
  const [mode, setMode] = useState<'read' | 'write'>('read');
  const [filter, setFilter] = useState('');

  const activeDef = CONTRACT_DEFS.find((c) => c.key === activeKey)!;
  const activeContract = contracts[activeKey] as Contract | null;
  const address = (contracts as any)[activeKey]?.target as string | undefined;

  const functions = useMemo(() => extractFunctions(activeDef.abi), [activeDef]);
  const visibleFunctions = useMemo(
    () => (isOwner ? functions : functions.filter((f) => !OWNER_ONLY_WRITE.test(f.name))),
    [functions, isOwner],
  );
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return visibleFunctions
      .filter((f) => (mode === 'read' ? isReadFn(f) : !isReadFn(f)))
      .filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [visibleFunctions, mode, filter]);

  const grouped = useMemo(
    () => categorize(filtered, mode === 'read' ? READ_CATEGORIES : WRITE_CATEGORIES),
    [filtered, mode],
  );

  const readCount = visibleFunctions.filter(isReadFn).length;
  const writeCount = visibleFunctions.length - readCount;

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <AdminIcon size={28} /> {t('admin.title', 'Admin Panel')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('admin.subtitle', 'Call any function on any deployed contract.')}
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {CONTRACT_DEFS.map((d) => {
          const Icon = d.icon;
          const isActive = d.key === activeKey;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveKey(d.key)}
              className="card clickable text-left p-3"
              style={isActive ? { borderColor: 'var(--color-primary)', background: 'rgba(37,99,235,0.06)' } : undefined}
            >
              <Icon className="w-5 h-5 mb-1.5" style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.label}</div>
            </button>
          );
        })}
      </section>

      <section className="card mb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.12)' }}>
            <activeDef.icon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{activeDef.label}</div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t(activeDef.descKey, activeDef.descFallback)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span className="font-mono break-all">{address ?? '—'}</span>
          {address && (
            <a
              href={`${ETHERSCAN}${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('admin.viewOnEtherscan', 'View on Etherscan')}
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
          )}
          <span>· {readCount} {t('admin.readFns', 'read')}</span>
          <span>· {writeCount} {t('admin.writeFns', 'write')}</span>
        </div>
      </section>

      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          type="button"
          className={mode === 'read' ? 'btn-flat primary' : 'btn-flat'}
          onClick={() => setMode('read')}
        >
          <BookOpenIcon className="w-4 h-4" /> {t('admin.read', 'Read')} ({readCount})
        </button>
        <button
          type="button"
          className={mode === 'write' ? 'btn-flat primary' : 'btn-flat'}
          onClick={() => setMode('write')}
        >
          <PencilSquareIcon className="w-4 h-4" /> {t('admin.write', 'Write')} ({writeCount})
        </button>
        <input
          className="form-input flex-1 min-w-[160px]"
          type="text"
          placeholder={t('admin.filter', 'Filter functions…')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {!activeContract ? (
        <div className="card text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('admin.noContract', 'Contract not available on this network.')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('admin.noFunctions', 'No matching functions.')}
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.key} className="mb-5">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {t(g.labelKey, g.labelFallback)} <span style={{ color: 'var(--text-tertiary)' }}>· {g.items.length}</span>
            </div>
            {g.items.map((f) => (
              <FunctionForm
                key={`${activeKey}:${f.name}:${f.inputs.map((i) => i.type).join(',')}`}
                contract={activeContract}
                fragment={f}
              />
            ))}
          </section>
        ))
      )}

      <p className="text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
        {t('admin.signedAs', 'Signed in as')}{' '}
        <span className="font-mono">{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '—'}</span>
      </p>
    </>
  );
}

export default function AdminPanel() {
  return (
    <PageGate requires="admin">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <AdminInner />
      </div>
    </PageGate>
  );
}
