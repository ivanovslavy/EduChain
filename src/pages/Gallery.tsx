import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ZeroAddress } from 'ethers';
import { PhotoIcon, CurrencyDollarIcon, SparklesIcon, XMarkIcon, TrophyIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';
import { useEthersProvider } from '../lib/ethersAdapter';
import { fmtEth, fmtAmount } from '../lib/format';
import PageGate from '../components/PageGate';

type NFTKind = 'predefined' | 'custom';

interface NFT {
  kind: NFTKind;
  tokenId: number;
  tokenURI?: string;
  metadata?: { name?: string; description?: string; image?: string };
}

function ipfsToHttp(uri: string) {
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return uri;
}

async function fetchMetadata(uri: string): Promise<NFT['metadata']> {
  try {
    const url = ipfsToHttp(uri);
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return await res.json();
  } catch { return undefined; }
}

function GalleryInner() {
  const { t } = useTranslation();
  const { account, contracts } = useWeb3();
  const provider = useEthersProvider();
  const [tab, setTab] = useState<'predefined' | 'custom' | 'tokens'>('predefined');
  const [predefined, setPredefined] = useState<NFT[]>([]);
  const [custom, setCustom] = useState<NFT[]>([]);
  const [tokenBalanceRaw, setTokenBalanceRaw] = useState<bigint>(0n);
  const [ethBalanceRaw, setEthBalanceRaw] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<NFT | null>(null);

  const enumerateNFTs = useCallback(async (kind: NFTKind) => {
    const c = kind === 'predefined' ? contracts.gameNFTPredefined : contracts.gameNFTCustom;
    if (!c || !account) return [] as NFT[];
    const candidateIds = new Set<bigint>();

    try {
      const incomingFilter = c.filters.Transfer(null, account);
      const incoming = await c.queryFilter(incomingFilter, 0, 'latest');
      for (const ev of incoming) {
        const id = (ev as any).args?.tokenId ?? (ev as any).args?.[2];
        if (id !== undefined) candidateIds.add(BigInt(id));
      }
    } catch (e) { console.warn('Transfer query (incoming) failed', e); }

    try {
      const outgoingFilter = c.filters.Transfer(account, null);
      const outgoing = await c.queryFilter(outgoingFilter, 0, 'latest');
      for (const ev of outgoing) {
        const id = (ev as any).args?.tokenId ?? (ev as any).args?.[2];
        if (id !== undefined) candidateIds.add(BigInt(id));
      }
    } catch { /* ignore */ }

    const out: NFT[] = [];
    await Promise.all(Array.from(candidateIds).map(async (id) => {
      try {
        const owner: string = await c.ownerOf(id);
        if (owner.toLowerCase() !== account.toLowerCase()) return;
        if (owner === ZeroAddress) return;
        const uri = await c.tokenURI(id).catch(() => undefined);
        const meta = uri ? await fetchMetadata(uri) : undefined;
        out.push({ kind, tokenId: Number(id), tokenURI: uri, metadata: meta });
      } catch { /* token burned or missing */ }
    }));

    out.sort((a, b) => a.tokenId - b.tokenId);
    return out;
  }, [contracts, account]);

  const load = useCallback(async () => {
    if (!account || !contracts.gameToken) return;
    setLoading(true);
    try {
      const [bal, eth, p, c] = await Promise.all([
        contracts.gameToken.balanceOf(account).catch(() => 0n),
        provider ? provider.getBalance(account).catch(() => 0n) : Promise.resolve(0n),
        enumerateNFTs('predefined'),
        enumerateNFTs('custom'),
      ]);
      setTokenBalanceRaw(BigInt(bal));
      setEthBalanceRaw(BigInt(eth));
      setPredefined(p);
      setCustom(c);
    } finally { setLoading(false); }
  }, [account, contracts.gameToken, enumerateNFTs, provider]);

  useEffect(() => { load(); }, [load]);

  const tokenCount = Number(tokenBalanceRaw / 10n ** 18n);
  const totalPoints = tokenCount * 1 + predefined.length * 10 + custom.length * 30;

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <PhotoIcon className="w-7 h-7" /> {t('gallery.title', 'My Gallery')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('gallery.subtitle', 'Your tokens and NFTs.')}</p>
      </header>

      <section className="card mb-4" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(16,185,129,0.04))' }}>
        <div className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {t('gallery.portfolio', 'Portfolio balance')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.15)' }}>
              <BanknotesIcon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>ETH</div>
              <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {fmtEth(ethBalanceRaw)} <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>ETH</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <CurrencyDollarIcon className="w-5 h-5" style={{ color: '#10b981' }} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>GAME</div>
              <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {fmtAmount(tokenBalanceRaw)} <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>GAME</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat icon={CurrencyDollarIcon} label={t('gallery.tokens', 'GAME tokens')} value={tokenCount} />
        <Stat icon={PhotoIcon} label={t('gallery.predef', 'Predefined NFTs')} value={predefined.length} />
        <Stat icon={SparklesIcon} label={t('gallery.custom', 'Custom NFTs')} value={custom.length} />
        <Stat icon={TrophyIcon} label={t('gallery.points', 'Total points')} value={totalPoints} highlight />
      </section>

      <div className="flex gap-2 mb-4">
        <button type="button" className={tab === 'predefined' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('predefined')}>
          <PhotoIcon className="w-4 h-4" /> {t('gallery.tabs.predef', 'Predefined')} ({predefined.length})
        </button>
        <button type="button" className={tab === 'custom' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('custom')}>
          <SparklesIcon className="w-4 h-4" /> {t('gallery.tabs.custom', 'Custom')} ({custom.length})
        </button>
        <button type="button" className={tab === 'tokens' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('tokens')}>
          <CurrencyDollarIcon className="w-4 h-4" /> {t('gallery.tabs.tokens', 'Tokens')}
        </button>
      </div>

      {tab === 'tokens' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Sepolia ETH</div>
            <div className="font-display text-3xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {fmtEth(ethBalanceRaw)}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('gallery.ethNote', 'Used for gas and ETH-priced mints.')}</div>
          </div>
          <div className="card">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>GAME (ERC20)</div>
            <div className="font-display text-3xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{fmtAmount(tokenBalanceRaw)}</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {tokenCount} × 1 = {tokenCount} {t('gallery.pts', 'pts')}
            </div>
          </div>
        </div>
      ) : (
        <NFTGrid items={tab === 'predefined' ? predefined : custom} loading={loading} onOpen={setOpen} emptyText={t('gallery.empty', 'No NFTs yet — head to the shop.')} />
      )}

      {open && <NFTLightbox nft={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: any; highlight?: boolean }) {
  return (
    <div className="card" style={highlight ? { borderColor: 'var(--color-primary)' } : undefined}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function NFTGrid({ items, loading, onOpen, emptyText }: { items: NFT[]; loading: boolean; onOpen: (n: NFT) => void; emptyText: string }) {
  if (loading && items.length === 0) return <div className="card text-sm py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (items.length === 0) return <div className="card text-sm py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((n) => (
        <button key={`${n.kind}-${n.tokenId}`} type="button" className="card clickable text-left p-3" onClick={() => onOpen(n)}>
          <div className="aspect-square rounded-lg mb-3 overflow-hidden flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
            {n.metadata?.image ? (
              <img src={ipfsToHttp(n.metadata.image)} alt={n.metadata.name || `#${n.tokenId}`} className="w-full h-full object-cover" />
            ) : (
              <PhotoIcon className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>#{n.tokenId}</div>
          <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{n.metadata?.name || (n.kind === 'predefined' ? 'Predefined NFT' : 'Custom NFT')}</div>
        </button>
      ))}
    </div>
  );
}

function NFTLightbox({ nft, onClose }: { nft: NFT; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-panel-header">
          <div className="min-w-0">
            <div className="modal-section-label">{nft.kind === 'predefined' ? 'Predefined NFT' : 'Custom NFT'} · #{nft.tokenId}</div>
            <h3 className="font-display text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{nft.metadata?.name || `Token #${nft.tokenId}`}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="modal-panel-body">
          {nft.metadata?.image && (
            <div className="rounded-lg overflow-hidden mb-4" style={{ background: 'var(--bg-secondary)' }}>
              <img src={ipfsToHttp(nft.metadata.image)} alt={nft.metadata.name || ''} className="w-full" />
            </div>
          )}
          {nft.metadata?.description && (
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{nft.metadata.description}</p>
          )}
          {nft.tokenURI && (
            <>
              <div className="modal-section-label">{t('gallery.tokenUri', 'Token URI')}</div>
              <code className="text-xs break-all block mb-3" style={{ color: 'var(--text-tertiary)' }}>{nft.tokenURI}</code>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Gallery() {
  return (
    <PageGate requires="whitelisted">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <GalleryInner />
      </div>
    </PageGate>
  );
}
