import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import GembaLogo from './GembaLogo';
import WalletButton from './WalletButton';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useWeb3 } from '../context/Web3Context';
import {
  HomeIcon, GalleryIcon, ShopIcon, MarketplaceIcon, LeaderboardIcon,
  FaucetIcon, AboutIcon, ContactIcon, AdminIcon, type IconProps,
} from './icons';

type NavIcon = (p: IconProps) => React.ReactElement;

export default function Navbar() {
  const { t } = useTranslation();
  const { lang = 'en' } = useParams();
  const { isConnected, isWhitelisted, isOwner, isAdmin } = useWeb3();
  const [mobileOpen, setMobileOpen] = useState(false);

  const publicLinks: Array<{ to: string; label: string; Icon: NavIcon }> = [
    { to: `/${lang}`, label: t('nav.home', 'Home'), Icon: HomeIcon },
    { to: `/${lang}/about`, label: t('nav.about', 'About'), Icon: AboutIcon },
    { to: `/${lang}/contact`, label: t('nav.contact', 'Contact'), Icon: ContactIcon },
  ];
  const memberLinks: Array<{ to: string; label: string; Icon: NavIcon }> = [
    { to: `/${lang}`, label: t('nav.home', 'Home'), Icon: HomeIcon },
    { to: `/${lang}/gallery`, label: t('nav.gallery', 'Gallery'), Icon: GalleryIcon },
    { to: `/${lang}/shop`, label: t('nav.shop', 'Shop'), Icon: ShopIcon },
    { to: `/${lang}/marketplace`, label: t('nav.marketplace', 'Marketplace'), Icon: MarketplaceIcon },
    { to: `/${lang}/leaderboard`, label: t('nav.leaderboard', 'Leaderboard'), Icon: LeaderboardIcon },
    { to: `/${lang}/faucet`, label: t('nav.faucet', 'Faucet'), Icon: FaucetIcon },
    { to: `/${lang}/about`, label: t('nav.about', 'About'), Icon: AboutIcon },
    { to: `/${lang}/contact`, label: t('nav.contact', 'Contact'), Icon: ContactIcon },
  ];
  const hasMemberAccess = isConnected && (isWhitelisted || isAdmin || isOwner);
  const links = hasMemberAccess ? memberLinks : publicLinks;
  if (isOwner || isAdmin) links.push({ to: `/${lang}/admin`, label: t('nav.admin', 'Admin'), Icon: AdminIcon });

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    'text-sm transition-colors';
  const linkStyle = (isActive: boolean) => ({
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontWeight: isActive ? 600 : 400,
  });

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--bg-primary) 85%, transparent)', borderBottom: '1px solid var(--border-color)' }}
    >
      <nav className="relative h-16 px-4 flex items-center">
        <NavLink to={`/${lang}`} end className="flex items-center gap-2 shrink-0" style={{ color: 'var(--text-primary)' }}>
          <GembaLogo className="w-7 h-7" />
          <span className="font-display font-semibold text-base">EduChain</span>
        </NavLink>

        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-4 whitespace-nowrap">
          {links.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === `/${lang}`} className={`${linkClass({ isActive: false })} inline-flex items-center gap-1.5`} style={({ isActive }) => linkStyle(isActive)}>
              <Icon size={14} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <WalletButton />
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <XMarkIcon className="w-4 h-4" /> : <Bars3Icon className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-1">
            {links.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === `/${lang}`}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm inline-flex items-center gap-2"
                style={({ isActive }) => linkStyle(isActive)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </NavLink>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
