import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatEther } from 'ethers';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon, PhotoIcon, SparklesIcon, ShoppingBagIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';
import { useEthersProvider } from '../lib/ethersAdapter';
import PageGate from '../components/PageGate';
import { useTxToast } from '../hooks/useTxToast';
import { fmtEth } from '../lib/format';

type Tab = 'erc20' | 'predef' | 'custom';
type CustomMode = 'creative' | 'batch';

function ShopInner() {
  const { t } = useTranslation();
  const { account, contracts, addresses } = useWeb3();
  const provider = useEthersProvider();
  const { execute } = useTxToast();
  const [tab, setTab] = useState<Tab>('erc20');
  const [customMode, setCustomMode] = useState<CustomMode>('creative');
  const [loading, setLoading] = useState(false);
  const [ethBalance, setEthBalance] = useState<bigint>(0n);

  // GameToken
  const [tokenAmount, setTokenAmount] = useState('1');
  const [tokenPrice, setTokenPrice] = useState<bigint>(0n);
  const [tokenStats, setTokenStats] = useState({
    maxPerPurchase: 0, maxPer24h: 0, buysPer24h: 0, userTokenBalance: 0n,
  });
  const [tokenUserStats, setTokenUserStats] = useState({
    buysThisWindow: 0, tokensThisWindow: 0, remainingBuys: 0, remainingTokens: 0,
  });

  // Predefined NFT
  const [prePrice, setPrePrice] = useState<bigint>(0n);
  const [prePredefQuantity, setPrePredefQuantity] = useState('1');
  const [preStats, setPreStats] = useState({
    totalMinted: 0, remainingSupply: 0, maxSupplyLimit: 0,
    maxBatchSize: 0, userBalance: 0, nextTokenId: 0,
  });
  const [preUserStats, setPreUserStats] = useState({ mintsThisWindow: 0, remainingMints: 0 });

  // Custom NFT
  const [customTokenURI, setCustomTokenURI] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [cusEthPrice, setCusEthPrice] = useState<bigint>(0n);
  const [cusTokenPrice, setCusTokenPrice] = useState<bigint>(0n);
  const [cusStats, setCusStats] = useState({
    maxBatchSize: 0, userBalance: 0, remainingSupply: 0, totalMinted: 0, nextTokenId: 0,
  });
  const [cusUserStats, setCusUserStats] = useState({ mintsThisWindow: 0, remainingMints: 0 });
  const [currentAllowance, setCurrentAllowance] = useState<bigint>(0n);

  const loadAll = useCallback(async () => {
    if (!contracts.gameToken || !contracts.gameNFTPredefined || !contracts.gameNFTCustom || !account) return;
    try {
      if (provider) setEthBalance(await provider.getBalance(account).catch(() => 0n));

      // --- GameToken ---
      const [price, maxPp, maxP24, buysP24, userBal, userPS] = await Promise.all([
        contracts.gameToken.tokenPrice().catch(() => 0n),
        contracts.gameToken.maxTokensPerPurchase().catch(() => 0n),
        contracts.gameToken.maxTokensPer24Hours().catch(() => 0n),
        contracts.gameToken.buysPer24Hours().catch(() => 0n),
        contracts.gameToken.balanceOf(account).catch(() => 0n),
        contracts.gameToken.getUserPurchaseStats(account).catch(() => null),
      ]);
      setTokenPrice(BigInt(price));
      setTokenStats({
        maxPerPurchase: Number(maxPp),
        maxPer24h: Number(maxP24),
        buysPer24h: Number(buysP24),
        userTokenBalance: BigInt(userBal),
      });
      if (userPS) {
        setTokenUserStats({
          buysThisWindow: Number(userPS.buysThisWindow ?? userPS[0] ?? 0n),
          tokensThisWindow: Number(userPS.tokensThisWindow ?? userPS[1] ?? 0n),
          remainingBuys: Number(userPS.remainingBuys ?? userPS[2] ?? 0n),
          remainingTokens: Number(userPS.remainingTokens ?? userPS[3] ?? 0n),
        });
      }

      // --- Predefined NFT ---
      const [preP, preSales, preMaxBatch, preBal, preUS, preNext] = await Promise.all([
        contracts.gameNFTPredefined.mintPrice().catch(() => 0n),
        contracts.gameNFTPredefined.getSalesStats().catch(() => null),
        contracts.gameNFTPredefined.maxBatchSize().catch(() => 0n),
        contracts.gameNFTPredefined.balanceOf(account).catch(() => 0n),
        contracts.gameNFTPredefined.getUserMintStats(account).catch(() => null),
        contracts.gameNFTPredefined.nextTokenId().catch(() => 0n),
      ]);
      setPrePrice(BigInt(preP));
      if (preSales) {
        setPreStats({
          totalMinted: Number(preSales.totalMinted ?? preSales[1] ?? 0n),
          remainingSupply: Number(preSales.remainingSupply ?? preSales[2] ?? 0n),
          maxSupplyLimit: Number(preSales.maxSupplyLimit ?? preSales[3] ?? 0n),
          maxBatchSize: Number(preMaxBatch),
          userBalance: Number(preBal),
          nextTokenId: Number(preNext),
        });
      }
      if (preUS) {
        setPreUserStats({
          mintsThisWindow: Number(preUS.mintsThisWindow ?? preUS[0] ?? 0n),
          remainingMints: Number(preUS.remainingMints ?? preUS[1] ?? 0n),
        });
      }

      // --- Custom NFT ---
      const [cusEth, cusTok, cusMaxBatch, cusBal, cusSales, cusUS, cusNext, allowance] = await Promise.all([
        contracts.gameNFTCustom.ethMintPrice().catch(() => 0n),
        contracts.gameNFTCustom.tokenMintPrice().catch(() => 0n),
        contracts.gameNFTCustom.maxBatchSize().catch(() => 0n),
        contracts.gameNFTCustom.balanceOf(account).catch(() => 0n),
        contracts.gameNFTCustom.getSalesStats().catch(() => null),
        contracts.gameNFTCustom.getUserMintStats(account).catch(() => null),
        contracts.gameNFTCustom.nextTokenId().catch(() => 0n),
        contracts.gameToken.allowance(account, addresses.gameNFTCustom).catch(() => 0n),
      ]);
      setCusEthPrice(BigInt(cusEth));
      setCusTokenPrice(BigInt(cusTok));
      setCurrentAllowance(BigInt(allowance));
      setCusStats({
        maxBatchSize: Number(cusMaxBatch),
        userBalance: Number(cusBal),
        remainingSupply: cusSales ? Number(cusSales.remainingSupply ?? cusSales[7] ?? 0n) : 0,
        totalMinted: cusSales ? Number(cusSales.totalMinted ?? cusSales[4] ?? 0n) : 0,
        nextTokenId: Number(cusNext),
      });
      if (cusUS) {
        setCusUserStats({
          mintsThisWindow: Number(cusUS.mintsThisWindow ?? cusUS[0] ?? 0n),
          remainingMints: Number(cusUS.remainingMints ?? cusUS[1] ?? 0n),
        });
      }
    } catch (e) {
      console.error('Shop load error', e);
    }
  }, [contracts.gameToken, contracts.gameNFTPredefined, contracts.gameNFTCustom, account, provider, addresses]);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 15000);
    return () => clearInterval(id);
  }, [loadAll]);

  const buyTokens = async () => {
    if (!contracts.gameToken) return;
    const n = Math.floor(parseFloat(tokenAmount));
    if (!n || n <= 0) { toast.error(t('shop.errors.amount', 'Enter a positive amount')); return; }
    if (n > tokenStats.maxPerPurchase) {
      toast.error(t('shop.errors.maxPerPurchase', 'Max {{n}} per purchase', { n: tokenStats.maxPerPurchase }));
      return;
    }
    setLoading(true);
    const cost = tokenPrice * BigInt(n);
    const receipt = await execute(
      () => contracts.gameToken!.buyTokens(n, { value: cost }),
      {
        pending: t('tx.pending.buy_tokens', 'Buying tokens...'),
        success: t('tx.success.buy_tokens', 'Tokens purchased'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) { setTokenAmount('1'); loadAll(); }
    setLoading(false);
  };

  const mintPredefined = async () => {
    if (!contracts.gameNFTPredefined || !account) return;
    const q = Math.max(1, Math.floor(parseFloat(prePredefQuantity) || 1));
    if (q > preStats.maxBatchSize) {
      toast.error(t('shop.errors.maxBatch', 'Max {{n}} per batch', { n: preStats.maxBatchSize }));
      return;
    }
    setLoading(true);
    const value = prePrice * BigInt(q);
    const receipt = await execute(
      () => contracts.gameNFTPredefined!.mint(account, q, { value }),
      {
        pending: t('tx.pending.mint_predefined', 'Minting Predefined NFT...'),
        success: t('tx.success.mint_predefined', 'Predefined NFT minted'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) loadAll();
    setLoading(false);
  };

  const mintCustomEth = async () => {
    if (!contracts.gameNFTCustom || !account) return;
    const q = Math.max(1, Math.floor(parseFloat(customQuantity) || 1));
    if (q > cusStats.maxBatchSize) {
      toast.error(t('shop.errors.maxBatch', 'Max {{n}} per batch', { n: cusStats.maxBatchSize }));
      return;
    }
    setLoading(true);
    const value = cusEthPrice * BigInt(q);
    const receipt = await execute(
      () => contracts.gameNFTCustom!.mintWithETH(account, q, customTokenURI.trim(), { value }),
      {
        pending: t('tx.pending.mint_custom_eth', 'Minting Custom NFT...'),
        success: t('tx.success.mint_custom_eth', 'Custom NFT minted'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) { setCustomTokenURI(''); loadAll(); }
    setLoading(false);
  };

  const mintCustomTokens = async () => {
    if (!contracts.gameNFTCustom || !contracts.gameToken || !account) return;
    const q = Math.max(1, Math.floor(parseFloat(customQuantity) || 1));
    if (q > cusStats.maxBatchSize) {
      toast.error(t('shop.errors.maxBatch', 'Max {{n}} per batch', { n: cusStats.maxBatchSize }));
      return;
    }
    setLoading(true);
    const totalCost = cusTokenPrice * BigInt(q);
    if (currentAllowance < totalCost) {
      const apOk = await execute(
        () => contracts.gameToken!.approve(addresses.gameNFTCustom, totalCost),
        {
          pending: t('tx.pending.approve_tokens', 'Approving GAME spending...'),
          success: t('tx.success.approve_tokens', 'Approval granted'),
          errorPrefix: t('tx.error.prefix', 'Transaction failed'),
        }
      );
      if (!apOk) { setLoading(false); return; }
    }
    const receipt = await execute(
      () => contracts.gameNFTCustom!.mintWithTokens(account, q, customTokenURI.trim()),
      {
        pending: t('tx.pending.mint_custom_tok', 'Minting with GAME tokens...'),
        success: t('tx.success.mint_custom_tok', 'Custom NFT minted with tokens'),
        errorPrefix: t('tx.error.prefix', 'Transaction failed'),
      }
    );
    if (receipt) { setCustomTokenURI(''); loadAll(); }
    setLoading(false);
  };

  const totalCostEth = (parseFloat(tokenAmount || '0') * parseFloat(fmtEth(tokenPrice, 6))).toFixed(4);
  const predefTotal = (parseFloat(prePredefQuantity || '0') * parseFloat(fmtEth(prePrice, 6))).toFixed(4);
  const customEthTotal = (parseFloat(customQuantity || '0') * parseFloat(fmtEth(cusEthPrice, 6))).toFixed(4);
  const customTokenTotal = (parseFloat(customQuantity || '0') * parseFloat(formatEther(cusTokenPrice))).toFixed(2);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ShoppingBagIcon className="w-7 h-7" /> {t('shop.title', 'Token & NFT Shop')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{t('shop.subtitle', 'Buy GAME tokens and mint NFTs.')}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('shop.eth', 'ETH balance')}</div>
          <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(ethBalance, 4)} ETH</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('shop.game', 'GAME balance')}</div>
          <div className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(tokenStats.userTokenBalance, 2)} GAME</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'erc20'} onClick={() => setTab('erc20')} icon={CurrencyDollarIcon} label={t('shop.tabs.buy_tokens', 'Buy Tokens')} />
        <TabButton active={tab === 'predef'} onClick={() => setTab('predef')} icon={PhotoIcon} label={t('shop.tabs.mint_predefined', 'Predefined NFT')} />
        <TabButton active={tab === 'custom'} onClick={() => setTab('custom')} icon={SparklesIcon} label={t('shop.tabs.mint_custom', 'Custom NFT')} />
      </div>

      {tab === 'erc20' && (
        <section className="card">
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('shop.erc20.title', 'Buy GAME tokens')}</h2>
          <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('shop.erc20.price', 'Price')}: <span className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtEth(tokenPrice, 6)} ETH / token</span>
          </div>
          <label className="form-label">{t('shop.erc20.amount', 'Amount (whole tokens)')}</label>
          <input
            className="form-input mb-2"
            type="number"
            min={1}
            max={tokenStats.maxPerPurchase || undefined}
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
          />
          <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            {t('shop.erc20.maxPerPurchase', 'Max {{n}} per purchase', { n: tokenStats.maxPerPurchase })}
            {' · '}
            {t('shop.erc20.cost', 'Total: {{cost}} ETH', { cost: totalCostEth })}
          </div>
          <button type="button" className="btn-flat primary" onClick={buyTokens} disabled={loading || tokenUserStats.remainingBuys === 0}>
            {loading ? t('shop.busy', 'Working…') : t('shop.erc20.cta', 'Buy tokens')}
          </button>
          <Limits24 items={[
            { label: t('shop.erc20.purchases', 'Purchases'), value: `${tokenUserStats.buysThisWindow} / ${tokenStats.buysPer24h}` },
            { label: t('shop.erc20.tokensToday', 'Tokens today'), value: `${tokenUserStats.tokensThisWindow} / ${tokenStats.maxPer24h}` },
            { label: t('shop.erc20.remPurchases', 'Remaining purchases'), value: tokenUserStats.remainingBuys },
            { label: t('shop.erc20.remTokens', 'Remaining tokens'), value: tokenUserStats.remainingTokens },
          ]} />
        </section>
      )}

      {tab === 'predef' && (
        <section className="card">
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('shop.predef.title', 'Mint Predefined NFT')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <KV label={t('shop.predef.price', 'Price')} value={`${fmtEth(prePrice, 4)} ETH`} />
            <KV label={t('shop.predef.supply', 'Supply')} value={`${preStats.totalMinted} / ${preStats.maxSupplyLimit}`} />
            <KV label={t('shop.predef.yourBal', 'Your NFTs')} value={preStats.userBalance} />
            <KV label={t('shop.points', 'Points')} value="10 pts" />
          </div>
          <label className="form-label">{t('shop.predef.quantity', 'Quantity')}</label>
          <input
            className="form-input mb-2"
            type="number"
            min={1}
            max={Math.min(preStats.maxBatchSize || 1, preUserStats.remainingMints || 1, preStats.remainingSupply || 1)}
            value={prePredefQuantity}
            onChange={(e) => setPrePredefQuantity(e.target.value)}
          />
          <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            {t('shop.predef.total', 'Total: {{cost}} ETH — tokens #{{first}}..#{{last}}', {
              cost: predefTotal,
              first: preStats.nextTokenId,
              last: preStats.nextTokenId + Math.max(0, parseInt(prePredefQuantity || '1') - 1),
            })}
          </div>
          <button type="button" className="btn-flat primary" onClick={mintPredefined} disabled={loading || preUserStats.remainingMints === 0 || preStats.remainingSupply === 0}>
            {loading ? t('shop.busy', 'Working…') : t('shop.predef.cta', 'Mint {{q}} ({{p}} ETH)', { q: prePredefQuantity, p: predefTotal })}
          </button>
          <Limits24 items={[
            { label: t('shop.predef.mintsToday', 'Mints today'), value: `${preUserStats.mintsThisWindow}` },
            { label: t('shop.predef.remMints', 'Remaining mints'), value: preUserStats.remainingMints },
            { label: t('shop.predef.maxBatch', 'Max batch size'), value: preStats.maxBatchSize },
          ]} />
        </section>
      )}

      {tab === 'custom' && (
        <section className="card">
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('shop.custom.title', 'Mint Custom NFT')}</h2>

          <div className="border-b mb-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCustomMode('creative')}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderBottom: customMode === 'creative' ? '2px solid var(--text-primary)' : '2px solid transparent',
                  color: customMode === 'creative' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {t('shop.custom.mode_creative', 'Creative Mint (ETH)')}
              </button>
              <button
                type="button"
                onClick={() => setCustomMode('batch')}
                className="px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderBottom: customMode === 'batch' ? '2px solid var(--text-primary)' : '2px solid transparent',
                  color: customMode === 'batch' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {t('shop.custom.mode_batch', 'Batch Mint (GAME)')}
              </button>
            </div>
          </div>

          {customMode === 'creative' ? (
            <>
              <div className="rounded-lg p-4 mb-4 flex gap-2 items-start" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                <SparklesIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-primary)' }} />
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('shop.custom.creative_info', 'Paste your IPFS metadata URI. All NFTs in the batch share this URI. Costs {{price}} ETH each.', { price: fmtEth(cusEthPrice, 4) })}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <KV label={t('shop.custom.price', 'Price / NFT')} value={`${fmtEth(cusEthPrice, 4)} ETH`} />
                <KV label={t('shop.predef.yourBal', 'Your NFTs')} value={cusStats.userBalance} />
                <KV label={t('shop.custom.remaining', 'Remaining supply')} value={cusStats.remainingSupply} />
                <KV label={t('shop.points', 'Points / NFT')} value="30 pts" />
              </div>
              <label className="form-label">{t('shop.custom.quantity', 'Quantity')}</label>
              <input
                className="form-input mb-2"
                type="number"
                min={1}
                max={Math.min(cusStats.maxBatchSize || 1, cusUserStats.remainingMints || 1)}
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
              />
              <label className="form-label">{t('shop.custom.tokenUri', 'Token URI (metadata)')}</label>
              <input
                className="form-input mb-3"
                type="text"
                placeholder={t('shop.custom.uri_placeholder', 'ipfs://... (optional, leave blank for default)')}
                value={customTokenURI}
                onChange={(e) => setCustomTokenURI(e.target.value)}
              />
              <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {t('shop.custom.total_eth', 'Total: {{cost}} ETH', { cost: customEthTotal })}
              </div>
              <button type="button" className="btn-flat primary" onClick={mintCustomEth} disabled={loading || cusUserStats.remainingMints === 0}>
                {loading ? t('shop.busy', 'Working…') : t('shop.custom.mint_with_eth', 'Mint {{q}} NFTs ({{cost}} ETH)', { q: customQuantity, cost: customEthTotal })}
              </button>
              <Limits24 items={[
                { label: t('shop.predef.mintsToday', 'Mints today'), value: cusUserStats.mintsThisWindow },
                { label: t('shop.predef.remMints', 'Remaining mints'), value: cusUserStats.remainingMints },
                { label: t('shop.predef.maxBatch', 'Max batch size'), value: cusStats.maxBatchSize },
              ]} />
            </>
          ) : (
            <>
              <div className="rounded-lg p-4 mb-4 flex gap-2 items-start" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('shop.custom.batch_info', 'Uses GAME tokens instead of ETH. {{price}} GAME per NFT. First approval required.', { price: formatEther(cusTokenPrice) })}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <KV label={t('shop.custom.batchPrice', 'Price / NFT')} value={`${formatEther(cusTokenPrice)} GAME`} />
                <KV label={t('shop.custom.maxBatch', 'Max batch')} value={cusStats.maxBatchSize} />
                <KV label={t('shop.custom.remaining', 'Remaining supply')} value={cusStats.remainingSupply} />
                <KV label={t('shop.points', 'Points / NFT')} value="30 pts" />
              </div>
              <label className="form-label">{t('shop.custom.quantity', 'Quantity')}</label>
              <input
                className="form-input mb-2"
                type="number"
                min={1}
                max={Math.min(cusStats.maxBatchSize || 1, cusUserStats.remainingMints || 1)}
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
              />
              <label className="form-label">{t('shop.custom.tokenUri', 'Token URI (metadata)')}</label>
              <input
                className="form-input mb-2"
                type="text"
                placeholder={t('shop.custom.uri_placeholder', 'ipfs://... (optional, leave blank for default)')}
                value={customTokenURI}
                onChange={(e) => setCustomTokenURI(e.target.value)}
              />
              {(() => {
                const needsApprove = currentAllowance < cusTokenPrice * BigInt(Math.max(1, parseInt(customQuantity || '1')));
                return (
                  <>
                    <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      {t('shop.custom.total_game', 'Total: {{cost}} GAME', { cost: customTokenTotal })}
                      {needsApprove && ` · ${t('shop.custom.willApprove', 'Step 1/2: approve, Step 2/2: mint')}`}
                    </div>
                    <button type="button" className="btn-flat primary" onClick={mintCustomTokens} disabled={loading || cusUserStats.remainingMints === 0}>
                      {loading
                        ? t('shop.busy', 'Working…')
                        : t('shop.custom.batch_mint', 'Batch Mint {{qty}} ({{price}} GAME)', { qty: String(customQuantity), price: customTokenTotal })}
                    </button>
                  </>
                );
              })()}
              <Limits24 items={[
                { label: t('shop.predef.mintsToday', 'Mints today'), value: cusUserStats.mintsThisWindow },
                { label: t('shop.predef.remMints', 'Remaining mints'), value: cusUserStats.remainingMints },
                { label: t('shop.custom.allowance', 'Current allowance'), value: `${fmtEth(currentAllowance, 0)} GAME` },
              ]} />
            </>
          )}
        </section>
      )}
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button type="button" onClick={onClick} className={active ? 'btn-flat primary' : 'btn-flat'}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)' }}>
      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function Limits24({ items }: { items: Array<{ label: string; value: any }> }) {
  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>24h limits</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {items.map((it) => (
          <div key={it.label}>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{it.label}</div>
            <div className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TokenShop() {
  return (
    <PageGate requires="whitelisted">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <ShopInner />
      </div>
    </PageGate>
  );
}
