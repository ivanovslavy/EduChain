import {
  Shield, Coins, Image as ImageIcon, Palette, Store, BarChart3, Droplet,
  Wallet, Trophy, Home as HomeLucide, LayoutGrid, ShoppingCart, Award,
  Info, Mail, Settings, type LucideProps,
} from 'lucide-react';

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

const SEMANTIC = {
  whitelist: 'var(--color-accent-info)',
  token: 'var(--color-accent-game)',
  nftPre: 'var(--color-accent-nft-pre)',
  nftCus: 'var(--color-accent-nft-cus)',
  marketplace: 'var(--color-accent-eth)',
  tracking: 'var(--color-accent-success)',
  faucet: 'var(--color-accent-faucet)',
  wallet: 'var(--color-accent-eth)',
  trophy: 'var(--color-accent-points)',
  home: 'currentColor',
  gallery: 'var(--color-accent-nft-pre)',
  shop: 'var(--color-accent-game)',
  leaderboard: 'var(--color-accent-points)',
  about: 'var(--color-accent-info)',
  contact: 'var(--color-accent-eth)',
  admin: 'currentColor',
} as const;

type Semantic = keyof typeof SEMANTIC;

function wrap(LucideIcon: React.ComponentType<LucideProps>, semantic: Semantic) {
  return function Icon({ size = 20, color, className, strokeWidth = 2 }: IconProps) {
    return (
      <LucideIcon
        size={size}
        color={color ?? SEMANTIC[semantic]}
        className={className}
        strokeWidth={strokeWidth}
        aria-hidden="true"
      />
    );
  };
}

export const WhitelistIcon = wrap(Shield, 'whitelist');
export const TokenIcon = wrap(Coins, 'token');
export const NFTPredefinedIcon = wrap(ImageIcon, 'nftPre');
export const NFTCustomIcon = wrap(Palette, 'nftCus');
export const MarketplaceIcon = wrap(Store, 'marketplace');
export const TrackingIcon = wrap(BarChart3, 'tracking');
export const FaucetIcon = wrap(Droplet, 'faucet');
export const WalletIcon = wrap(Wallet, 'wallet');
export const TrophyIcon = wrap(Trophy, 'trophy');

export const HomeIcon = wrap(HomeLucide, 'home');
export const GalleryIcon = wrap(LayoutGrid, 'gallery');
export const ShopIcon = wrap(ShoppingCart, 'shop');
export const LeaderboardIcon = wrap(Award, 'leaderboard');
export const AboutIcon = wrap(Info, 'about');
export const ContactIcon = wrap(Mail, 'contact');
export const AdminIcon = wrap(Settings, 'admin');

export { default as Medal } from './Medal';
export { FlagEN, FlagBG, FlagES } from './Flags';
