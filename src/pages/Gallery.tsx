import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ZeroAddress } from 'ethers';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { useWeb3 } from '../context/Web3Context';
import { useEthersProvider } from '../lib/ethersAdapter';
import { fmtEth, fmtAmount, shorten } from '../lib/format';
import { EXPLORER_URL, ipfsUrl } from '../config/explorer';
import PageGate from '../components/PageGate';
import LoadError from '../components/LoadError';
import {
  WalletIcon, TokenIcon, NFTPredefinedIcon, NFTCustomIcon, TrophyIcon, GalleryIcon,
  type IconProps,
} from '../components/icons';

const ETHERSCAN = EXPLORER_URL;

type NFTKind = 'predefined' | 'custom';

// Attribute shape mirrors the Marketplace's ListingAttribute — same JSON
// schema (`trait_type` + `value`) used by OpenSea / NFT-standard metadata.
interface NFTAttribute { trait_type: string; value: any; display_type?: string }

interface NFT {
  kind: NFTKind;
  tokenId: number;
  tokenURI?: string;
  metadataUrl?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    external_url?: string;
    background_color?: string;
    animation_url?: string;
    attributes?: NFTAttribute[];
  };
}

function ipfsToHttp(uri: string) {
  if (uri.startsWith('ipfs://')) return ipfsUrl(uri);   // our own gateway — see config/explorer.ts
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
  const { account, contracts, addresses } = useWeb3();
  const provider = useEthersProvider();
  const [tab, setTab] = useState<'predefined' | 'custom' | 'tokens'>('predefined');
  const [predefined, setPredefined] = useState<NFT[]>([]);
  const [custom, setCustom] = useState<NFT[]>([]);
  const [tokenBalanceRaw, setTokenBalanceRaw] = useState<bigint>(0n);
  const [ethBalanceRaw, setEthBalanceRaw] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<NFT | null>(null);

  const enumerateNFTs = useCallback(async (kind: NFTKind) => {
    const c = kind === 'predefined' ? contracts.gameNFTPredefined : contracts.gameNFTCustom;
    if (!c || !account) return [] as NFT[];

    // Scan owned tokens by ownerOf over the minted range (ERC721A => contiguous ids).
    // This does NOT use historical Transfer logs (eth_getLogs from block 0), which return
    // nothing on pruned RPC nodes — that was the bug that made the gallery read 0 NFTs while
    // the balance was non-zero. ownerOf is a current-state call that works on any node.
    let total = 0;
    try { total = Number(await c.totalSupply()); } catch { total = 0; }
    if (!total) return [] as NFT[];
    const SCAN_CAP = 2000;
    const upper = Math.min(total, SCAN_CAP);

    const out: NFT[] = [];
    await Promise.all(
      Array.from({ length: upper + 1 }, (_, i) => BigInt(i)).map(async (id) => {
        try {
          const owner: string = await c.ownerOf(id);
          if (!owner || owner === ZeroAddress) return;
          if (owner.toLowerCase() !== account.toLowerCase()) return;
          const uri: string | undefined = await c.tokenURI(id).catch(() => undefined);
          const metadataUrl = uri ? ipfsToHttp(uri) : undefined;
          const meta = uri ? await fetchMetadata(uri) : undefined;
          out.push({ kind, tokenId: Number(id), tokenURI: uri, metadataUrl, metadata: meta });
        } catch { /* non-existent / burned id */ }
      })
    );
    out.sort((a, b) => a.tokenId - b.tokenId);
    return out;
  }, [contracts, account]);

  const load = useCallback(async () => {
    if (!account || !contracts.gameToken) return;
    setLoading(true);
    try {
      // M6: balanceOf is the canary — left UNguarded so a real RPC failure rejects
      // here and is surfaced, instead of silently reading 0 NFTs / 0 balance.
      const [bal, eth, p, c] = await Promise.all([
        contracts.gameToken.balanceOf(account),
        provider ? provider.getBalance(account).catch(() => 0n) : Promise.resolve(0n),
        enumerateNFTs('predefined'),
        enumerateNFTs('custom'),
      ]);
      setTokenBalanceRaw(BigInt(bal));
      setEthBalanceRaw(BigInt(eth));
      setPredefined(p);
      setCustom(c);
      setLoadError(false);
    } catch (e) {
      console.error('Gallery load error', e);
      setLoadError(true);
    } finally { setLoading(false); }
  }, [account, contracts.gameToken, enumerateNFTs, provider]);

  useEffect(() => { load(); }, [load]);

  const tokenCount = Number(tokenBalanceRaw / 10n ** 18n);
  const totalPoints = tokenCount * 1 + predefined.length * 10 + custom.length * 30;

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <GalleryIcon size={28} /> {t('gallery.title', 'My Gallery')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('gallery.subtitle', 'Your tokens and NFTs.')}</p>
      </header>

      {loadError && <LoadError onRetry={load} />}

      <section className="card mb-4" style={{ background: 'linear-gradient(135deg, rgba(29,158,117,0.08), rgba(239,159,39,0.04))' }}>
        <div className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
          {t('gallery.portfolio', 'Portfolio balance')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-accent-eth) 15%, transparent)' }}>
              <WalletIcon size={20} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>GMB</div>
              <div className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {fmtEth(ethBalanceRaw, 4)} <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>GMB</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-accent-game) 15%, transparent)' }}>
              <TokenIcon size={20} />
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
        <Stat Icon={TokenIcon} label={t('gallery.tokens', 'GAME tokens')} value={tokenCount} />
        <Stat Icon={NFTPredefinedIcon} label={t('gallery.predef', 'Predefined NFTs')} value={predefined.length} />
        <Stat Icon={NFTCustomIcon} label={t('gallery.custom', 'Custom NFTs')} value={custom.length} />
        <Stat Icon={TrophyIcon} label={t('gallery.points', 'Total points')} value={totalPoints} highlight />
      </section>

      <div className="flex gap-2 mb-4 justify-center flex-wrap">
        <button type="button" className={tab === 'predefined' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('predefined')}>
          <NFTPredefinedIcon size={16} color={tab === 'predefined' ? 'currentColor' : undefined} /> {t('gallery.tabs.predef', 'Predefined')} ({predefined.length})
        </button>
        <button type="button" className={tab === 'custom' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('custom')}>
          <NFTCustomIcon size={16} color={tab === 'custom' ? 'currentColor' : undefined} /> {t('gallery.tabs.custom', 'Custom')} ({custom.length})
        </button>
        <button type="button" className={tab === 'tokens' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('tokens')}>
          <TokenIcon size={16} color={tab === 'tokens' ? 'currentColor' : undefined} /> {t('gallery.tabs.tokens', 'Tokens')}
        </button>
      </div>

      {tab === 'tokens' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>GMB</div>
            <div className="font-display text-3xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {fmtEth(ethBalanceRaw)}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('gallery.ethNote', 'Used for gas and GMB-priced mints.')}</div>
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

      {open && (
        <NFTLightbox
          nft={open}
          onClose={() => setOpen(null)}
          contractAddress={open.kind === 'predefined' ? addresses.gameNFTPredefined : addresses.gameNFTCustom}
        />
      )}
    </>
  );
}

function Stat({ Icon, label, value, highlight }: { Icon: (p: IconProps) => React.ReactElement; label: string; value: any; highlight?: boolean }) {
  return (
    <div className="card" style={highlight ? { borderColor: 'var(--color-accent-points)' } : undefined}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <Icon size={14} /> {label}
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

function NFTLightbox({ nft, onClose, contractAddress }: { nft: NFT; onClose: () => void; contractAddress: string }) {
  const { t } = useTranslation();
  const metadataUrl = nft.metadataUrl || (nft.tokenURI ? ipfsToHttp(nft.tokenURI) : undefined);
  const meta = nft.metadata;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-panel-header">
          <div className="min-w-0">
            <div className="modal-section-label">{nft.kind === 'predefined' ? 'Predefined NFT' : 'Custom NFT'} · #{nft.tokenId}</div>
            <h3 className="font-display text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{meta?.name || `Token #${nft.tokenId}`}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="modal-panel-body">
          {meta?.image && (
            <div
              className="rounded-lg overflow-hidden mb-4"
              style={{ background: meta.background_color ? `#${meta.background_color}` : 'var(--bg-secondary)' }}
            >
              <img src={ipfsToHttp(meta.image)} alt={meta.name || ''} className="w-full" />
            </div>
          )}

          {meta?.description && (
            <>
              <div className="modal-section-label">{t('gallery.description', 'Description')}</div>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{meta.description}</p>
            </>
          )}

          {/* Attributes grid — same shape as Marketplace's modal. Renders any
              `attributes: [{trait_type, value, display_type?}]` array from the
              token's metadata JSON (OpenSea-standard). */}
          {meta?.attributes && meta.attributes.length > 0 && (
            <>
              <hr className="modal-divider" />
              <div>
                <div className="modal-section-label">{t('gallery.attributes', 'Attributes')}</div>
                <div className="grid grid-cols-2 gap-3">
                  {meta.attributes.map((attr, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{attr.trait_type}</div>
                      <div className="font-medium break-words" style={{ color: 'var(--text-primary)' }}>{String(attr.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="modal-divider" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-tertiary)' }}>{t('gallery.tokenId', 'Token ID')}</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>#{nft.tokenId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-tertiary)' }}>{t('gallery.contract', 'Contract')}</span>
              <a
                href={`${ETHERSCAN}/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs"
                style={{ color: 'var(--text-primary)' }}
              >
                {shorten(contractAddress)}
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-tertiary)' }}>{t('gallery.onEtherscan', 'Token on GembaScan')}</span>
              <a
                href={`${ETHERSCAN}/token/${contractAddress}?a=${nft.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('gallery.viewToken', 'View token')}
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
            {meta?.external_url && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-tertiary)' }}>{t('gallery.externalUrl', 'External URL')}</span>
                <a
                  href={meta.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs truncate max-w-[60%]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {meta.external_url.replace(/^https?:\/\//, '')}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0" />
                </a>
              </div>
            )}
            {meta?.animation_url && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-tertiary)' }}>{t('gallery.animationUrl', 'Animation')}</span>
                <a
                  href={ipfsToHttp(meta.animation_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('gallery.viewMedia', 'View')}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            )}
            {metadataUrl && (
              <div className="flex justify-between items-center gap-3">
                <span style={{ color: 'var(--text-tertiary)' }}>{t('gallery.metadataJson', 'Metadata JSON')}</span>
                <a
                  href={metadataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('gallery.viewRaw', 'View raw')}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            )}
            {nft.tokenURI && nft.tokenURI !== metadataUrl && (
              <code className="text-xs break-all block pt-1" style={{ color: 'var(--text-tertiary)' }}>{nft.tokenURI}</code>
            )}
          </div>
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
