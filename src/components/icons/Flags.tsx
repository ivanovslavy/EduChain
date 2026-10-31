interface FlagProps {
  size?: number;
  className?: string;
}

export function FlagEN({ size = 20, className }: FlagProps) {
  const h = Math.round((size * 3) / 5);
  return (
    <svg width={size} height={h} viewBox="0 0 60 36" className={className} aria-hidden="true">
      <rect width="60" height="36" fill="#012169" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#FFF" strokeWidth="7" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#C8102E" strokeWidth="3" />
      <path d="M30,0 V36 M0,18 H60" stroke="#FFF" strokeWidth="10" />
      <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="5" />
    </svg>
  );
}

export function FlagBG({ size = 20, className }: FlagProps) {
  const h = Math.round((size * 3) / 5);
  return (
    <svg width={size} height={h} viewBox="0 0 60 36" className={className} aria-hidden="true">
      <rect width="60" height="12" fill="#FFFFFF" />
      <rect y="12" width="60" height="12" fill="#00966E" />
      <rect y="24" width="60" height="12" fill="#D62612" />
    </svg>
  );
}

export function FlagES({ size = 20, className }: FlagProps) {
  const h = Math.round((size * 3) / 5);
  return (
    <svg width={size} height={h} viewBox="0 0 60 36" className={className} aria-hidden="true">
      <rect width="60" height="9" fill="#AA151B" />
      <rect y="9" width="60" height="18" fill="#F1BF00" />
      <rect y="27" width="60" height="9" fill="#AA151B" />
    </svg>
  );
}
