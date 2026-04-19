import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowTopRightOnSquareIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const ETHERSCAN = 'https://sepolia.etherscan.io';

interface TxMessages {
  pending?: string;
  success?: string;
  errorPrefix?: string;
}

export function useTxToast() {
  const { t } = useTranslation();
  const execute = useCallback(async <T = any,>(
    txFactory: () => Promise<any>,
    messages: TxMessages = {}
  ): Promise<any | null> => {
    const {
      pending = t('tx.pending.default', 'Submitting transaction...'),
      success = t('tx.success.default', 'Transaction confirmed'),
      errorPrefix = t('tx.error.prefix', 'Transaction failed'),
    } = messages;
    const viewLabel = t('tx.view_on_etherscan', 'View on Sepolia Etherscan');

    const toastId = toast.loading(
      <div className="flex flex-col gap-1">
        <div className="font-medium">{pending}</div>
        <div className="text-xs opacity-70">Confirm in your wallet</div>
      </div>,
      {
        style: {
          background: 'var(--card-bg)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
          color: 'var(--text-primary)'
        }
      }
    );

    try {
      const tx = await txFactory();

      toast.loading(
        <div className="flex flex-col gap-2">
          <div className="font-medium">{pending}</div>
          <a
            href={`${ETHERSCAN}/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border"
            style={{
              color: 'var(--text-primary)',
              background: 'rgba(37, 99, 235, 0.12)',
              borderColor: 'rgba(37, 99, 235, 0.4)'
            }}
          >
            {viewLabel}
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </a>
        </div>,
        {
          id: toastId,
          style: {
            background: 'var(--card-bg)',
            border: '1px solid rgba(37, 99, 235, 0.4)',
            color: 'var(--text-primary)'
          }
        }
      );

      const receipt = await tx.wait();

      toast.success(
        <div className="flex flex-col gap-2">
          <div className="font-medium">{success}</div>
          <a
            href={`${ETHERSCAN}/tx/${receipt.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border"
            style={{
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.12)',
              borderColor: 'rgba(16, 185, 129, 0.5)'
            }}
          >
            {viewLabel}
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        </div>,
        {
          id: toastId,
          duration: 12000,
          icon: <CheckCircleIcon className="w-5 h-5" style={{ color: '#10b981' }} />,
          style: {
            background: 'var(--card-bg)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: 'var(--text-primary)'
          }
        }
      );
      return receipt;
    } catch (err: any) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Unknown error';
      const shortMsg = msg.length > 100 ? msg.slice(0, 97) + '...' : msg;

      toast.error(
        <div className="flex flex-col gap-1">
          <div className="font-medium">{errorPrefix}</div>
          <div className="text-xs opacity-80">{shortMsg}</div>
        </div>,
        {
          id: toastId,
          duration: 6000,
          icon: <XCircleIcon className="w-5 h-5" style={{ color: '#ef4444' }} />,
          style: {
            background: 'var(--card-bg)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: 'var(--text-primary)'
          }
        }
      );
      return null;
    }
  }, []);

  return { execute };
}
