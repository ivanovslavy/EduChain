import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LockClosedIcon, ExclamationTriangleIcon, ShieldCheckIcon, WalletIcon } from '@heroicons/react/24/outline';
import { useWeb3 } from '../context/Web3Context';

export type GateLevel = 'connected' | 'chain' | 'whitelisted' | 'admin' | 'owner';

function Notice({
  tone, icon: Icon, title, body,
}: {
  tone: 'warn' | 'danger' | 'info';
  icon: typeof LockClosedIcon;
  title: string;
  body: string;
}) {
  const color = tone === 'danger' ? '#ef4444' : tone === 'info' ? '#2563eb' : '#D97706';
  const border =
    tone === 'danger' ? 'rgba(239,68,68,0.3)' :
    tone === 'info' ? 'rgba(37,99,235,0.3)' : 'rgba(217,119,6,0.3)';
  return (
    <div className="card flex items-start gap-3" style={{ borderColor: border }}>
      <Icon className="w-5 h-5 mt-0.5" style={{ color }} />
      <div>
        <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      </div>
    </div>
  );
}

export function NotConnectedNotice() {
  const { t } = useTranslation();
  return (
    <Notice
      tone="warn"
      icon={WalletIcon}
      title={t('gate.notConnectedTitle', 'Wallet not connected')}
      body={t('gate.notConnectedBody', 'Connect your wallet to access this page.')}
    />
  );
}

export function WrongChainNotice() {
  const { t } = useTranslation();
  return (
    <Notice
      tone="warn"
      icon={ExclamationTriangleIcon}
      title={t('gate.wrongChainTitle', 'Wrong network')}
      body={t('gate.wrongChainBody', 'Switch to Sepolia to use this dApp.')}
    />
  );
}

export function NotWhitelistedNotice() {
  const { t } = useTranslation();
  return (
    <Notice
      tone="danger"
      icon={LockClosedIcon}
      title={t('gate.notWhitelistedTitle', 'Access denied')}
      body={t('gate.notWhitelistedBody', 'Only whitelisted users can access this page. Ask an admin to add your address.')}
    />
  );
}

export function NotAdminNotice() {
  const { t } = useTranslation();
  return (
    <Notice
      tone="danger"
      icon={ShieldCheckIcon}
      title={t('gate.notAdminTitle', 'Admin only')}
      body={t('gate.notAdminBody', 'This page is restricted to admins and the contract owner.')}
    />
  );
}

export function NotOwnerNotice() {
  const { t } = useTranslation();
  return (
    <Notice
      tone="danger"
      icon={ShieldCheckIcon}
      title={t('gate.notOwnerTitle', 'Owner only')}
      body={t('gate.notOwnerBody', 'This page is restricted to the contract owner.')}
    />
  );
}

export function WhitelistGate({ children }: { children: ReactNode }) {
  return <PageGate requires="whitelisted">{children}</PageGate>;
}

export default function PageGate({
  children,
  requires = 'whitelisted',
}: {
  children: ReactNode;
  requires?: GateLevel;
}) {
  const { isConnected, correctChain, isWhitelisted, isOwner, isAdmin } = useWeb3();

  if (requires === 'connected') {
    if (!isConnected) return <NotConnectedNotice />;
    return <>{children}</>;
  }

  if (!isConnected) return <NotConnectedNotice />;
  if (!correctChain) return <WrongChainNotice />;

  if (requires === 'chain') return <>{children}</>;

  if (requires === 'owner') {
    if (!isOwner) return <NotOwnerNotice />;
    return <>{children}</>;
  }

  if (requires === 'admin') {
    if (!isAdmin && !isOwner) return <NotAdminNotice />;
    return <>{children}</>;
  }

  if (!isWhitelisted && !isAdmin && !isOwner) return <NotWhitelistedNotice />;
  return <>{children}</>;
}
