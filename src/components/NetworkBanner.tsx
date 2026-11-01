import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useSwitchChain } from 'wagmi';
import { useWeb3 } from '../context/Web3Context';
import { DEFAULT_CHAIN } from '../config/wagmi';

/**
 * The wrong-network banner. Sits under the navbar, on every route, and is the one piece of UI
 * that tells a user their wallet is on the wrong chain even on pages that are not gated.
 *
 * It renders off `wrongNetwork` from Web3Context, never off a raw chain id, so it cannot appear
 * while the chain is still resolving or while the one-shot auto-switch is in flight — see the
 * comment on `wrongNetwork` there. Every string is an existing translated key; the chain id is a
 * bare number, which needs no translation.
 */
export default function NetworkBanner() {
  const { t } = useTranslation();
  const { wrongNetwork, chainId } = useWeb3();
  const { switchChain, isPending } = useSwitchChain();

  if (!wrongNetwork) return null;

  return (
    <div
      role="alert"
      data-testid="wrong-network-banner"
      className="w-full border-b text-xs sm:text-sm"
      style={{
        background: 'color-mix(in srgb, var(--color-accent-danger) 10%, var(--bg-secondary))',
        borderColor: 'color-mix(in srgb, var(--color-accent-danger) 40%, var(--border-color))',
      }}
    >
      <div
        className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-2 gap-y-1"
        style={{ color: 'var(--text-primary)' }}
      >
        <ExclamationTriangleIcon
          className="w-4 h-4 shrink-0"
          style={{ color: 'var(--color-accent-danger)' }}
          aria-hidden="true"
        />
        <span style={{ fontWeight: 600 }}>{t('wallet.wrongNetworkPill', 'Wrong network')}</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {t('gate.wrongChainBody', 'Switch to GembaBlockchain to use this dApp.')}
        </span>
        {typeof chainId === 'number' && (
          <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
            ({chainId} &rarr; {DEFAULT_CHAIN.id})
          </span>
        )}
        <button
          type="button"
          onClick={() => switchChain({ chainId: DEFAULT_CHAIN.id })}
          disabled={isPending}
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            border: '1px solid color-mix(in srgb, var(--color-accent-danger) 50%, transparent)',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {t('wallet.wrongNetwork', 'Switch to GembaBlockchain')}
        </button>
      </div>
    </div>
  );
}
