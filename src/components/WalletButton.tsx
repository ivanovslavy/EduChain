import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { WalletIcon, ArrowRightOnRectangleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DEFAULT_CHAIN } from '../config/wagmi';
import { useWeb3 } from '../context/Web3Context';

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
  const [open, setOpen] = useState(false);

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="btn-flat primary"
          disabled={isPending}
        >
          <WalletIcon className="w-4 h-4" />
          {isPending ? t('wallet.connecting', 'Connecting…') : t('wallet.connect', 'Connect Wallet')}
        </button>
        {open && (
          <div
            className="absolute right-0 mt-2 z-50 min-w-[220px] rounded-lg p-2"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
          >
            {connectors.map((c) => (
              <button
                key={c.uid}
                type="button"
                onClick={() => { connect({ connector: c }); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm rounded"
                style={{ color: 'var(--text-primary)', background: 'transparent' }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!correctChain) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: DEFAULT_CHAIN.id })}
        className="btn-flat"
        style={{ borderColor: '#D97706', color: '#D97706' }}
      >
        <ExclamationTriangleIcon className="w-4 h-4" />
        {t('wallet.wrongNetwork', 'Switch to Sepolia')} ({chainId})
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-flat">
        <WalletIcon className="w-4 h-4" />
        {shorten(address)}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 z-50 min-w-[200px] rounded-lg p-2"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
        >
          <button
            type="button"
            onClick={() => { disconnect(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm rounded inline-flex items-center gap-2"
            style={{ color: 'var(--text-primary)', background: 'transparent' }}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            {t('wallet.disconnect', 'Disconnect')}
          </button>
        </div>
      )}
    </div>
  );
}
