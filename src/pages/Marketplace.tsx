import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Contract, formatEther, parseEther, ZeroAddress, isAddress } from 'ethers';
import toast from 'react-hot-toast';
import { XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { Search, Plus, List } from 'lucide-react';
import { MarketplaceIcon, TrophyIcon, WalletIcon, type IconProps } from '../components/icons';
import { useWeb3 } from '../context/Web3Context';
import { useEthersSigner } from '../lib/ethersAdapter';
import PageGate from '../components/PageGate';
import { useTxToast } from '../hooks/useTxToast';
import { shorten, ipfsToHttp } from '../lib/format';

const ETHERSCAN = 'https://sepolia.etherscan.io';

type Tab = 'browse' | 'create' | 'mine';
type ListingType = 'erc20' | 'erc721';

interface ListingAttribute { trait_type: string; value: any; }

interface Listing {
  id: number;
  seller: string;
  tokenContract: string;
  tokenId: bigint;
  amount: bigint;
  price: bigint;
  allowedBuyer: string;
  tokenType: number; // 0=ERC20, 1=ERC721 (v2 has no ERC1155)
  isActive: boolean;
  createdAt: number;
  name?: string;
  image?: string;
  description?: string;
  attributes?: ListingAttribute[];
  metadataUrl?: string;
}

const typeLabel = (t: number) => (t === 0 ? 'ERC20' : t === 1 ? 'ERC721' : '—');

function MarketplaceInner() {
  const { t } = useTranslation();
  const { account, contracts, addresses, isWhitelisted } = useWeb3();
  const signer = useEthersSigner();
  const { execute } = useTxToast();

  const [tab, setTab] = useState<Tab>('browse');
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [stats, setStats] = useState({
    activeListingsCount: 0, totalListingsEverCreated: 0, totalTransactions: 0,
    totalSalesETH: 0n, salesERC20: 0, salesERC721: 0,
  });
  const [filter, setFilter] = useState<'all' | 'erc20' | 'erc721'>('all');
  const [openListing, setOpenListing] = useState<Listing | null>(null);

  // Create form
  const [listingType, setListingType] = useState<ListingType>('erc721');
  const [tokenContract, setTokenContract] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [amount, setAmount] = useState('1');
  const [price, setPrice] = useState('');
  const [allowedBuyer, setAllowedBuyer] = useState('');

  const parseListing = (id: number, raw: any): Listing => ({
    id,
    seller: raw.seller ?? raw[0],
    tokenContract: raw.tokenContract ?? raw[1],
    tokenId: BigInt(raw.tokenId ?? raw[2] ?? 0),
    amount: BigInt(raw.amount ?? raw[3] ?? 0),
    price: BigInt(raw.price ?? raw[4] ?? 0),
    allowedBuyer: raw.allowedBuyer ?? raw[5] ?? ZeroAddress,
    tokenType: Number(raw.tokenType ?? raw[6] ?? 0),
    isActive: !!(raw.isActive ?? raw[7]),
    createdAt: Number(raw.createdAt ?? raw[8] ?? 0),
  });

  const enrichNFT = useCallback(async (l: Listing): Promise<Listing> => {
    if (l.tokenType !== 1) return l;
    try {
      const addr = l.tokenContract.toLowerCase();
      const isPredefined = addr === addresses.gameNFTPredefined.toLowerCase();
      const nftContract = isPredefined ? contracts.gameNFTPredefined : contracts.gameNFTCustom;
      if (!nftContract) return l;
      const tokenURI: string = await nftContract.tokenURI(l.tokenId);
      if (!tokenURI) return l;
      const metadataUrl = ipfsToHttp(tokenURI);
      try {
        const res = await fetch(metadataUrl);
        if (!res.ok) return { ...l, metadataUrl };
        const metadata = await res.json();
        return {
          ...l,
          metadataUrl,
          name: metadata?.name,
          image: metadata?.image ? ipfsToHttp(metadata.image) : undefined,
          description: metadata?.description,
          attributes: metadata?.attributes,
        };
      } catch {
        return { ...l, metadataUrl };
      }
    } catch {
      return l;
    }
  }, [contracts.gameNFTPredefined, contracts.gameNFTCustom, addresses]);

  const load = useCallback(async () => {
    if (!contracts.marketplace || !account) return;
    setLoading(true);
    try {
      // Active listings (paginated)
      const allActive: Listing[] = [];
      let start = 0;
      const pageSize = 100;
      while (true) {
        const page = await contracts.marketplace.getActiveListingsPaginated(start, pageSize).catch(() => null);
        if (!page) break;
        const entries: any[] = page.listings ?? page[0] ?? [];
        const total = Number(page.total ?? page[1] ?? 0);
        // getActiveListingsPaginated returns Listing[] without ids; we need to query by IDs
        // Alternate: call getActiveListingIds to know IDs, then getListings to get data
        // But the paginated struct variant is preferred. We'll derive IDs via getActiveListingIds.
        if (entries.length === 0) break;
        // Since we have listings-only, we need IDs separately for buy/cancel
        // Fetch IDs for this page
        const idsPage = await contracts.marketplace.getActiveListingIds(start, pageSize).catch(() => null);
        const ids: bigint[] = idsPage ? (idsPage.ids ?? idsPage[0] ?? []) : [];
        for (let i = 0; i < entries.length; i++) {
          const id = Number(ids[i] ?? 0);
          allActive.push(parseListing(id, entries[i]));
        }
        start += pageSize;
        if (start >= total) break;
      }

      // Enrich metadata
      const enriched = await Promise.all(allActive.map(enrichNFT));
      setListings(enriched);

      // My listings (all IDs by seller, then filter active)
      const mineIds: bigint[] = await contracts.marketplace.getSellerListingIds(account).catch(() => []);
      if (mineIds.length > 0) {
        const mineRaw = await contracts.marketplace.getListings(mineIds).catch(() => []);
        const mineList: Listing[] = mineRaw
          .map((raw: any, i: number) => parseListing(Number(mineIds[i]), raw))
          .filter((l: Listing) => l.isActive);
        const mineEnriched = await Promise.all(mineList.map(enrichNFT));
        setMine(mineEnriched);
      } else {
        setMine([]);
      }

      // Stats
      const statsRaw = await contracts.marketplace.getMarketplaceStats().catch(() => null);
      if (statsRaw) {
        setStats({
          activeListingsCount: Number(statsRaw.activeListingsCount ?? statsRaw[0] ?? 0n),
          totalListingsEverCreated: Number(statsRaw.totalListingsEverCreated ?? statsRaw[1] ?? 0n),
          totalTransactions: Number(statsRaw.totalTransactions ?? statsRaw[2] ?? 0n),
          totalSalesETH: BigInt(statsRaw.totalSalesETH ?? statsRaw[3] ?? 0n),
          salesERC20: Number(statsRaw.salesERC20 ?? statsRaw[4] ?? 0n),
          salesERC721: Number(statsRaw.salesERC721 ?? statsRaw[5] ?? 0n),
        });
      }
    } catch (e) {
      console.error('Marketplace load error', e);
    } finally { setLoading(false); }
  }, [contracts.marketplace, account, enrichNFT]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const createListing = async () => {
    if (!contracts.marketplace || !signer) return;
    if (!tokenContract || !price) { toast.error(t('marketplace.errors.fields', 'Fill all required fields')); return; }
    if (!isAddress(tokenContract)) { toast.error(t('marketplace.errors.contract', 'Invalid contract address')); return; }
    if (allowedBuyer && !isAddress(allowedBuyer)) { toast.error(t('marketplace.errors.buyer', 'Invalid buyer address')); return; }
    setLoading(true);
    const buyer = allowedBuyer.trim() || ZeroAddress;
    const priceWei = parseEther(price);
    try {
      if (listingType === 'erc721') {
        if (!tokenId) { toast.error(t('marketplace.errors.tokenId', 'Token ID required')); setLoading(false); return; }
        const nft = new Contract(tokenContract, ['function approve(address to, uint256 tokenId)'], signer as any);
        const apOk = await execute(
          () => nft.approve(addresses.marketplace, tokenId),
          {
            pending: t('tx.pending.approve_tokens', 'Approving NFT transfer...'),
            success: t('tx.success.approve_tokens', 'Approval granted'),
            errorPrefix: t('tx.error.prefix', 'Transaction failed'),
          }
        );
        if (!apOk) { setLoading(false); return; }
        const createOk = await execute(
          () => contracts.marketplace!.createERC721Listing(tokenContract, tokenId, priceWei, buyer),
          {
            pending: t('tx.pending.create_listing', 'Creating marketplace listing...'),
            success: t('tx.success.create_listing', 'Listing created'),
            errorPrefix: t('tx.error.prefix', 'Transaction failed'),
          }
        );
        if (!createOk) { setLoading(false); return; }
      } else {
        const erc20 = new Contract(tokenContract, ['function approve(address spender, uint256 amount)'], signer as any);
        const amountWei = parseEther(amount);
        const apOk = await execute(
          () => erc20.approve(addresses.marketplace, amountWei),
          {
            pending: t('tx.pending.approve_tokens', 'Approving token spending...'),
            success: t('tx.success.approve_tokens', 'Approval granted'),
            errorPrefix: t('tx.error.prefix', 'Transaction failed'),
          }
        );
        if (!apOk) { setLoading(false); return; }
        const createOk = await execute(
          () => contracts.marketplace!.createERC20Listing(tokenContract, amountWei, priceWei, buyer),
          {
            pending: t('tx.pending.create_listing', 'Creating marketplace listing...'),
            success: t('tx.success.create_listing', 'Listing created'),
            errorPrefix: t('tx.error.prefix', 'Transaction failed'),
          }
        );
        if (!createOk) { setLoading(false); return; }
      }
      setTokenContract(''); setTokenId(''); setAmount('1'); setPrice(''); setAllowedBuyer('');
      setTab('browse');
      load();
    } finally { setLoading(false); }
  };

  const purchase = async (l: Listing) => {
    if (!contracts.marketplace) return;
    setLoading(true);
    const receipt = await execute(
      () => contracts.marketplace!.purchaseListing(l.id, { value: l.price }),
      {
        pending: t('tx.pending.purchase', 'Purchasing listing...'),
        success: t('tx.success.purchase', 'Purchase complete'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) { setOpenListing(null); load(); }
    setLoading(false);
  };

  const cancel = async (l: Listing) => {
    if (!contracts.marketplace) return;
    if (!confirm(t('marketplace.cancelConfirm', 'Cancel this listing?'))) return;
    setLoading(true);
    const receipt = await execute(
      () => contracts.marketplace!.cancelListing(l.id),
      {
        pending: t('tx.pending.cancel_listing', 'Cancelling listing...'),
        success: t('tx.success.cancel_listing', 'Listing cancelled'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) load();
    setLoading(false);
  };

  const filtered = listings.filter((l) =>
    filter === 'all' ? true : filter === 'erc20' ? l.tokenType === 0 : l.tokenType === 1,
  );

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <MarketplaceIcon size={28} /> {t('marketplace.title', 'Marketplace')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('marketplace.subtitle', 'Trade GAME tokens and NFTs.')}</p>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-6">
        <Stat Icon={WalletIcon} label={t('marketplace.stats.sales', 'Total sales')} value={`${parseFloat(formatEther(stats.totalSalesETH)).toFixed(3)} ETH`} />
        <Stat Icon={TrophyIcon} label={t('marketplace.stats.txs', 'Transactions')} value={stats.totalTransactions} />
        <Stat Icon={MarketplaceIcon} label={t('marketplace.stats.active', 'Active listings')} value={stats.activeListingsCount} />
      </section>

      <div className="flex gap-2 mb-4 flex-wrap justify-center">
        <button type="button" className={tab === 'browse' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('browse')}>
          <Search size={16} color={tab === 'browse' ? 'currentColor' : 'var(--color-accent-eth)'} /> {t('marketplace.tabs.browse', 'Browse')}
        </button>
        <button type="button" className={tab === 'create' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('create')}>
          <Plus size={16} color={tab === 'create' ? 'currentColor' : 'var(--color-accent-success)'} /> {t('marketplace.tabs.create', 'Create')}
        </button>
        <button type="button" className={tab === 'mine' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setTab('mine')}>
          <List size={16} color={tab === 'mine' ? 'currentColor' : 'var(--color-accent-nft-pre)'} /> {t('marketplace.tabs.mine', 'My listings')} ({mine.length})
        </button>
      </div>

      {tab === 'browse' && (
        <>
          <div className="card flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('marketplace.filter', 'Filter')}:</span>
            {(['all', 'erc721', 'erc20'] as const).map((f) => (
              <button key={f} type="button" className={filter === f ? 'btn-flat primary' : 'btn-flat'} onClick={() => setFilter(f)}>
                {f === 'all' ? t('marketplace.filters.all', 'All') : f.toUpperCase()}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="card text-center text-sm py-6" style={{ color: 'var(--text-tertiary)' }}>
              {loading ? t('common.loading', 'Loading…') : t('marketplace.empty', 'No listings yet.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((l) => (
                <button key={l.id} type="button" className="card clickable text-left" onClick={() => setOpenListing(l)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="status-pill">{typeLabel(l.tokenType)}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>#{l.id}</span>
                  </div>
                  {l.image ? (
                    <div className="rounded-lg overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
                      <img
                        src={l.image}
                        alt={l.name || `Token #${l.tokenId}`}
                        className="w-full h-40 object-cover"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  ) : l.tokenType === 0 && (
                    <div className="rounded-lg mb-3 flex items-center justify-center" style={{ background: 'var(--bg-secondary)', height: 160 }}>
                      <span className="font-display text-4xl font-semibold" style={{ color: 'var(--text-tertiary)' }}>GAME</span>
                    </div>
                  )}
                  {l.tokenType === 1 && (
                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {l.name || `Token #${l.tokenId.toString()}`}
                    </div>
                  )}
                  <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('marketplace.seller', 'Seller')}</div>
                  <div className="font-mono text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{shorten(l.seller)}</div>
                  {l.tokenType === 0 && (
                    <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{formatEther(l.amount)} GAME</div>
                  )}
                  <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{formatEther(l.price)} ETH</div>
                  {l.allowedBuyer !== ZeroAddress && (
                    <div className="status-pill warn mt-2 inline-flex"><LockClosedIcon className="w-3 h-3 mr-1" /> {t('marketplace.private', 'Private sale')}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'create' && (
        <section className="card">
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('marketplace.create.title', 'Create new listing')}</h2>
          <div className="flex gap-2 mb-4">
            <button type="button" className={listingType === 'erc721' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setListingType('erc721')}>ERC721 NFT</button>
            <button type="button" className={listingType === 'erc20' ? 'btn-flat primary' : 'btn-flat'} onClick={() => setListingType('erc20')}>ERC20 Token</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="form-label">{t('marketplace.create.contract', 'Token contract address')}</label>
              <input className="form-input" type="text" placeholder="0x…" value={tokenContract} onChange={(e) => setTokenContract(e.target.value)} />
              <div className="flex gap-2 mt-2 flex-wrap">
                {listingType === 'erc721' && (
                  <>
                    <button type="button" className="btn-flat" onClick={() => setTokenContract(addresses.gameNFTPredefined)}>Predefined NFTs</button>
                    <button type="button" className="btn-flat" onClick={() => setTokenContract(addresses.gameNFTCustom)}>Custom NFTs</button>
                  </>
                )}
                {listingType === 'erc20' && (
                  <button type="button" className="btn-flat" onClick={() => setTokenContract(addresses.gameToken)}>GAME token</button>
                )}
              </div>
            </div>
            {listingType === 'erc721' ? (
              <div>
                <label className="form-label">{t('marketplace.create.tokenId', 'Token ID')}</label>
                <input className="form-input" type="number" placeholder="0" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="form-label">{t('marketplace.create.amount', 'Amount')}</label>
                <input className="form-input" type="number" step="0.1" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}
            <div>
              <label className="form-label">{t('marketplace.create.price', 'Price (ETH)')}</label>
              <input className="form-input" type="number" step="0.001" placeholder="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">{t('marketplace.create.buyer', 'Allowed buyer (optional)')}</label>
              <input className="form-input" type="text" placeholder={t('marketplace.create.buyerPlaceholder', 'Leave empty for public sale')} value={allowedBuyer} onChange={(e) => setAllowedBuyer(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="btn-flat primary"
              onClick={createListing}
              disabled={loading}
              style={{ background: 'var(--color-accent-eth)', borderColor: 'var(--color-accent-eth)', color: '#fff' }}
            >
              <Plus size={16} color="currentColor" />
              {loading ? t('marketplace.create.busy', 'Creating…') : t('marketplace.create.cta', 'Create listing')}
            </button>
          </div>
        </section>
      )}

      {tab === 'mine' && (
        <>
          {mine.length === 0 ? (
            <div className="card text-center text-sm py-6" style={{ color: 'var(--text-tertiary)' }}>{t('marketplace.mine.empty', 'You have no active listings.')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mine.map((l) => (
                <div key={l.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="status-pill">{typeLabel(l.tokenType)}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>#{l.id}</span>
                  </div>
                  {l.image && (
                    <div className="rounded-lg overflow-hidden mb-3" style={{ background: 'var(--bg-secondary)' }}>
                      <img src={l.image} alt={l.name || ''} className="w-full h-40 object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                  {l.tokenType === 1 ? (
                    <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{l.name || `Token #${l.tokenId.toString()}`}</div>
                  ) : (
                    <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{formatEther(l.amount)} GAME</div>
                  )}
                  <div className="font-display text-xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{formatEther(l.price)} ETH</div>
                  <button type="button" className="btn-flat" onClick={() => cancel(l)} disabled={loading} style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}>
                    <XMarkIcon className="w-4 h-4" /> {t('marketplace.cancel', 'Cancel listing')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {openListing && (
        <ListingLightbox
          listing={openListing}
          onClose={() => setOpenListing(null)}
          onBuy={purchase}
          loading={loading}
          account={account}
          isWhitelisted={isWhitelisted}
        />
      )}
    </>
  );
}

function Stat({ Icon, label, value }: { Icon: (p: IconProps) => React.ReactElement; label: string; value: any }) {
  return (
    <div className="card">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <Icon size={14} /> {label}
      </div>
      <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function ListingLightbox({ listing, onClose, onBuy, loading, account, isWhitelisted }: {
  listing: Listing; onClose: () => void; onBuy: (l: Listing) => void; loading: boolean; account: string | undefined; isWhitelisted: boolean;
}) {
  const { t } = useTranslation();
  const isOwner = listing.seller.toLowerCase() === account?.toLowerCase();
  const restricted = listing.allowedBuyer !== ZeroAddress && listing.allowedBuyer.toLowerCase() !== account?.toLowerCase();
  const canBuy = !isOwner && !restricted && isWhitelisted;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-panel-header">
          <div className="min-w-0">
            <div className="modal-section-label">{typeLabel(listing.tokenType)} · #{listing.id}</div>
            <h3 className="font-display text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {listing.name || `${formatEther(listing.price)} ETH`}
            </h3>
            {listing.name && (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatEther(listing.price)} ETH</div>
            )}
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="modal-panel-body text-sm" style={{ color: 'var(--text-secondary)' }}>
          {listing.image && (
            <img src={listing.image} alt={listing.name || ''} className="w-full rounded-xl mb-4" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div className="mb-2"><span className="modal-section-label">{t('marketplace.seller', 'Seller')}</span><span className="font-mono">{listing.seller}</span></div>
          {listing.tokenType === 1 ? (
            <div className="mb-2"><span className="modal-section-label">{t('marketplace.tokenId', 'Token ID')}</span>{listing.tokenId.toString()}</div>
          ) : (
            <div className="mb-2"><span className="modal-section-label">{t('marketplace.amount', 'Amount')}</span>{formatEther(listing.amount)}</div>
          )}
          {listing.allowedBuyer !== ZeroAddress && (
            <div className="mb-2"><span className="modal-section-label">{t('marketplace.allowedBuyer', 'Private buyer')}</span><span className="font-mono">{listing.allowedBuyer}</span></div>
          )}

          {listing.description && (
            <>
              <hr className="modal-divider" />
              <div>
                <div className="modal-section-label">{t('marketplace.description', 'Description')}</div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{listing.description}</p>
              </div>
            </>
          )}

          {listing.attributes && listing.attributes.length > 0 && (
            <>
              <hr className="modal-divider" />
              <div>
                <div className="modal-section-label">{t('marketplace.attributes', 'Attributes')}</div>
                <div className="grid grid-cols-2 gap-3">
                  {listing.attributes.map((attr, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{attr.trait_type}</div>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{String(attr.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="modal-divider" />
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-tertiary)' }}>{t('marketplace.contract', 'Contract')}</span>
              <a href={`${ETHERSCAN}/address/${listing.tokenContract}`} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 font-mono text-xs"
                 style={{ color: 'var(--text-primary)' }}>
                {shorten(listing.tokenContract)}
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
            {listing.metadataUrl && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-tertiary)' }}>{t('marketplace.metadataJson', 'Metadata JSON')}</span>
                <a href={listing.metadataUrl} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 font-mono text-xs"
                   style={{ color: 'var(--text-primary)' }}>
                  {t('marketplace.viewRaw', 'View raw')}
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          <hr className="modal-divider" />
          {isOwner ? (
            <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>{t('marketplace.ownListing', 'This is your listing')}</div>
          ) : restricted ? (
            <div className="text-center" style={{ color: '#f59e0b' }}>{t('marketplace.notAllowed', 'This listing is restricted to a specific buyer.')}</div>
          ) : !isWhitelisted ? (
            <div className="text-center text-sm" style={{ color: '#f59e0b' }}>
              {t('marketplace.notWhitelisted', 'This address must be on the whitelist to purchase. Admin or owner status alone is not enough — add the address via Admin → Whitelist → addToWhitelist.')}
            </div>
          ) : (
            <button type="button" className="btn-flat primary w-full justify-center" onClick={() => onBuy(listing)} disabled={loading}>
              {loading ? t('marketplace.buying', 'Buying…') : t('marketplace.buyNow', 'Buy now')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Marketplace() {
  return (
    <PageGate requires="whitelisted">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <MarketplaceInner />
      </div>
    </PageGate>
  );
}
