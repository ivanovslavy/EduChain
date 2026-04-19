import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, ClipboardIcon, CheckIcon, ExclamationTriangleIcon, ArrowRightOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN } from '../config/wagmi';
import { useWeb3 } from '../context/Web3Context';
import { useEthersProvider } from '../lib/ethersAdapter';
import { WalletIcon } from './icons';
import { fmtEth } from '../lib/format';

function shorten(addr?: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletButton() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { correctChain, chainId } = useWeb3();
  const provider = useEthersProvider();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!isConnected || !address || !provider) { setBalance(null); return; }
    let cancelled = false;
    provider.getBalance(address).then((b) => { if (!cancelled) setBalance(BigInt(b)); }).catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [isConnected, address, provider, chainId]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(t('wallet.copied', 'Address copied'), { duration: 1500 });
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t('wallet.copyFailed', 'Copy failed'));
    }
  };

  if (!isConnected) {
    return (
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md"
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            border: '1px solid color-mix(in srgb, var(--color-accent-eth) 35%, var(--border-color))',
            transition: 'background 150ms',
          }}
          disabled={isPending}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {isPending ? (
            <ArrowPathIcon className="w-4 h-4 spin" style={{ color: 'var(--color-accent-eth)' }} />
          ) : (
            <WalletIcon size={16} />
          )}
          <span>{isPending ? t('wallet.connecting', 'Connecting…') : t('wallet.connect', 'Connect')}</span>
        </button>
        <AnimatePresence>
          {open && !isPending && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role="menu"
              className="absolute right-0 mt-2 z-50 min-w-[220px] rounded-lg py-1"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
            >
              {connectors.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => { connect({ connector: c }); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm"
                  style={{ color: 'var(--text-primary)', background: 'transparent' }}
                >
                  {c.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const wrongNetwork = !correctChain;
  const dotColor = wrongNetwork ? 'var(--color-accent-danger)' : 'var(--color-accent-success)';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          if (wrongNetwork) { switchChain({ chainId: DEFAULT_CHAIN.id }); return; }
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-2 text-xs rounded-full"
        style={{
          height: 32,
          padding: '0 12px',
          background: 'var(--card-bg)',
          color: 'var(--text-primary)',
          border: `1px solid ${wrongNetwork
            ? 'color-mix(in srgb, var(--color-accent-danger) 50%, transparent)'
            : 'color-mix(in srgb, var(--color-accent-eth) 30%, var(--border-color))'}`,
          transition: 'border-color 150ms, background 150ms',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, background: dotColor, boxShadow: `0 0 0 3px color-mix(in srgb, ${dotColor} 20%, transparent)` }}
          aria-hidden="true"
        />
        {wrongNetwork ? (
          <>
            <ExclamationTriangleIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-accent-danger)' }} />
            <span style={{ fontWeight: 500 }}>{t('wallet.wrongNetworkPill', 'Wrong network')}</span>
          </>
        ) : (
          <>
            <span className="font-mono" style={{ fontWeight: 500 }}>{shorten(address)}</span>
            <ChevronDownIcon className="w-3 h-3" style={{ color: 'var(--text-secondary)', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && !wrongNetwork && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="menu"
            className="absolute right-0 mt-2 z-50 min-w-[260px] rounded-lg"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
          >
            <div className="px-4 pt-3 pb-2">
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('wallet.address', 'Address')}</div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs flex-1 break-all" style={{ color: 'var(--text-primary)' }}>{address}</code>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="inline-flex items-center justify-center w-7 h-7 rounded"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                  aria-label={t('wallet.copyAddress', 'Copy address')}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span key="check" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                        <CheckIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-accent-success)' }} />
                      </motion.span>
                    ) : (
                      <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                        <ClipboardIcon className="w-3.5 h-3.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>

            <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('wallet.network', 'Network')}</span>
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent-success)' }} />
                Sepolia
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('wallet.balance', 'Balance')}</span>
              <span className="text-xs font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                {balance === null ? '—' : `${fmtEth(balance, 4)} ETH`}
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => { disconnect(); setOpen(false); }}
                className="w-full inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                style={{ color: 'var(--color-accent-danger)', background: 'transparent', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                {t('wallet.disconnect', 'Disconnect')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
