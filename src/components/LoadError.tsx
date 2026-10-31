import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Called when the user clicks Retry — pass the page's load function. */
  onRetry: () => void;
  /** Optional custom message; defaults to a generic on-chain read failure. */
  message?: string;
}

/**
 * Shared error surface for data pages. Shown when an on-chain READ fails (e.g. an
 * RPC outage) instead of silently rendering zeros/empty. The write path already
 * surfaces failures via useTxToast; this covers the read path (audit finding M6).
 */
export default function LoadError({ onRetry, message }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="mb-4"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.85rem 1rem',
        borderRadius: '0.6rem',
        border: '1px solid rgba(239,68,68,0.35)',
        background: 'rgba(239,68,68,0.08)',
      }}
    >
      <ExclamationTriangleIcon
        style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, color: '#ef4444' }}
      />
      <span style={{ flex: 1, minWidth: '12rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
        {message ||
          t(
            'common.loadError',
            "Couldn't load on-chain data. Check your wallet connection and network, then retry."
          )}
      </span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.8rem',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          border: '1px solid #ef4444',
          background: 'transparent',
          color: '#ef4444',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <ArrowPathIcon style={{ width: '1rem', height: '1rem' }} />
        {t('common.retry', 'Retry')}
      </button>
    </div>
  );
}
