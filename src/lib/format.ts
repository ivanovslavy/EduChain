import { formatEther, formatUnits } from 'ethers';

export const shorten = (addr: string | undefined | null, head = 6, tail = 4) =>
  addr ? `${addr.slice(0, head)}…${addr.slice(-tail)}` : '';

const stripTrailingZeros = (s: string): string => {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
};

export const fmtEth = (wei: bigint | number | string | undefined | null, maxDecimals = 6) => {
  if (wei === undefined || wei === null) return '0';
  try {
    const full = formatEther(BigInt(wei));
    const num = parseFloat(full);
    if (!isFinite(num)) return '0';
    return stripTrailingZeros(num.toFixed(maxDecimals));
  } catch {
    return '0';
  }
};

export const fmtEthFixed = (wei: bigint | number | string | undefined | null, decimals = 4) => {
  if (wei === undefined || wei === null) return '0';
  try {
    return parseFloat(formatEther(BigInt(wei))).toFixed(decimals);
  } catch {
    return '0';
  }
};

export const fmtAmount = (
  raw: bigint | number | string | undefined | null,
  decimals = 18,
  maxDecimals = 6,
) => {
  if (raw === undefined || raw === null) return '0';
  try {
    const full = formatUnits(BigInt(raw), decimals);
    const num = parseFloat(full);
    if (!isFinite(num)) return '0';
    return stripTrailingZeros(num.toFixed(maxDecimals));
  } catch {
    return '0';
  }
};

// v2 TrackingContract returns plain integer points — no wei division
export const fmtPoints = (n: bigint | number | string | undefined | null) => {
  if (n === undefined || n === null) return '0';
  try {
    return Number(n).toLocaleString('en-US');
  } catch {
    return '0';
  }
};

// Legacy alias — some pages still import formatPoints
export const formatPoints = fmtPoints;

export const ipfsToHttp = (uri: string | undefined | null, gateway = 'https://ipfs.io/ipfs/') => {
  if (!uri) return '';
  return uri.startsWith('ipfs://') ? gateway + uri.slice(7) : uri;
};

export interface TierInfo { label: string; color: string; }

export const parseTier = (tier: number | bigint | string | undefined | null): TierInfo => {
  switch (Number(tier ?? 0)) {
    case 4: return { label: 'Platinum', color: '#e5e4e2' };
    case 3: return { label: 'Gold',     color: '#d4af37' };
    case 2: return { label: 'Silver',   color: '#c0c0c0' };
    case 1: return { label: 'Bronze',   color: '#cd7f32' };
    default: return { label: 'Unranked', color: '#6b7280' };
  }
};

export const formatCountdown = (totalSeconds: number | bigint) => {
  const s = Math.max(0, Number(totalSeconds));
  if (s <= 0) return '0s';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};
