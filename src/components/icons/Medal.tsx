interface TierPalette { fill: string; ribbon: string; rim: string; }

const PALETTE: Record<string, TierPalette> = {
  bronze:   { fill: '#CD7F32', ribbon: '#8B5A2B', rim: '#A0622A' },
  silver:   { fill: '#D8D8D8', ribbon: '#7A7A7A', rim: '#A8A8A8' },
  gold:     { fill: '#FFD700', ribbon: '#B8860B', rim: '#DBB22E' },
  platinum: { fill: '#E5E4E2', ribbon: '#9A9A98', rim: '#BDBDBB' },
  diamond:  { fill: '#B9F2FF', ribbon: '#5FAFC7', rim: '#8FD5EA' },
  unranked: { fill: '#6B7280', ribbon: '#4B5563', rim: '#575D6A' },
};

export type Tier = keyof typeof PALETTE | number;

function resolveTier(tier: Tier): keyof typeof PALETTE {
  if (typeof tier === 'number') {
    switch (tier) {
      case 1: return 'bronze';
      case 2: return 'silver';
      case 3: return 'gold';
      case 4: return 'platinum';
      case 5: return 'diamond';
      default: return 'unranked';
    }
  }
  const key = tier.toLowerCase() as keyof typeof PALETTE;
  return PALETTE[key] ? key : 'unranked';
}

interface MedalProps {
  rank: Tier;
  size?: number;
  className?: string;
  title?: string;
}

export default function Medal({ rank, size = 40, className, title }: MedalProps) {
  const key = resolveTier(rank);
  const { fill, ribbon, rim } = PALETTE[key];
  const label = title ?? key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 48"
      className={className}
      role="img"
      aria-label={`${label} medal`}
    >
      <title>{label}</title>
      <path d="M12 2 L6 14 L14 14 L18 6 Z" fill={ribbon} opacity="0.95" />
      <path d="M28 2 L34 14 L26 14 L22 6 Z" fill={ribbon} opacity="0.8" />
      <circle cx="20" cy="28" r="13" fill={fill} stroke={rim} strokeWidth="1.5" />
      <circle cx="20" cy="28" r="9" fill="none" stroke={rim} strokeWidth="0.8" opacity="0.5" />
      <path d="M16 26 L20 22 L24 26 L22 30 L18 30 Z" fill={rim} opacity="0.35" />
    </svg>
  );
}
