import { Shield, Coins, Image as ImageIcon, Palette, Store, BarChart3, Droplet, Wallet, Trophy, Home as HomeLucide, LayoutGrid, ShoppingCart, Award, Info, Mail, Settings, Handshake, GraduationCap, BookOpen, FileText, Sparkles, Network, Cpu, Layers, ScrollText, PlayCircle, Hexagon, Compass, type LucideProps, BadgeCheck } from 'lucide-react';

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

const SEMANTIC = {
  certificates: 'var(--color-accent-success)',
  whitelist: 'var(--color-accent-info)',
  token: 'var(--color-accent-game)',
  nftPre: 'var(--color-accent-nft-pre)',
  nftCus: 'var(--color-accent-nft-cus)',
  marketplace: 'var(--color-accent-eth)',
  tracking: 'var(--color-accent-success)',
  faucet: 'var(--color-accent-faucet)',
  wallet: 'var(--color-accent-eth)',
  trophy: 'var(--color-accent-points)',
  home: 'var(--color-primary)',
  gallery: 'var(--color-accent-nft-pre)',
  shop: 'var(--color-accent-game)',
  leaderboard: 'var(--color-accent-points)',
  about: 'var(--color-accent-info)',
  contact: 'var(--color-accent-eth)',
  admin: 'var(--color-accent-danger)',
  partnership: 'var(--color-primary)',
  teachers: 'var(--color-accent-nft-pre)',
  curriculum: 'var(--color-accent)',
  privacy: 'var(--color-accent-eth)',
  terms: 'var(--color-accent-info)',
  architecture: 'var(--color-accent-info)',
  stack: 'var(--color-accent-nft-cus)',
  layers: 'var(--color-accent-game)',
  demo: 'var(--color-accent-faucet)',
  ethereum: 'var(--color-accent-eth)',
  philosophy: 'var(--color-primary)',
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
export const PartnershipIcon = wrap(Handshake, 'partnership');
export const TeachersIcon = wrap(GraduationCap, 'teachers');
export const CurriculumIcon = wrap(BookOpen, 'curriculum');
export const PrivacyIcon = wrap(FileText, 'privacy');
export const TermsIcon = wrap(ScrollText, 'terms');
export const HomeHeroIcon = wrap(Sparkles, 'home');
export const ArchitectureIcon = wrap(Network, 'architecture');
export const StackIcon = wrap(Cpu, 'stack');
export const LayersIcon = wrap(Layers, 'layers');
export const DemoIcon = wrap(PlayCircle, 'demo');
export const EthereumIcon = wrap(Hexagon, 'ethereum');
export const PhilosophyIcon = wrap(Compass, 'philosophy');

export { default as Medal } from './Medal';
export { FlagEN, FlagBG, FlagES } from './Flags';
export const CertificateIcon = wrap(BadgeCheck, 'certificates');
