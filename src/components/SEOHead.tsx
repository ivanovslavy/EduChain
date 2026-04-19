import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

const SITE_NAME = 'EduChain by GEMBA IT';
const SITE_URL = 'https://educhain.gembait.com';
const DEFAULT_TITLE = 'EduChain — Educational Blockchain Platform by GEMBA IT';
const DEFAULT_DESC =
  'Safe, educational Web3 platform for young learners. Mint NFTs, earn GAME tokens, and trade on a curated marketplace — all on Ethereum Sepolia testnet. Built by GEMBA IT.';
const OG_IMAGE = `${SITE_URL}/og/educhain.png`;
const LANGS = ['en', 'bg', 'es'] as const;
const LOCALE: Record<string, string> = { en: 'en_US', bg: 'bg_BG', es: 'es_ES' };
const KNOWN_SECTIONS = ['home', 'gallery', 'marketplace', 'shop', 'faucet', 'leaderboard', 'rankings', 'about', 'contact'] as const;

type SEOHeadProps = {
  title?: string;
  description?: string;
  page?: string;
};

function swapLang(pathname: string, targetLang: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return `/${targetLang}`;
  if ((LANGS as readonly string[]).includes(parts[0])) parts[0] = targetLang;
  else parts.unshift(targetLang);
  return '/' + parts.join('/');
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="alternate"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: unknown) {
  let el = document.head.querySelector<HTMLScriptElement>(`script[data-seo="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function detectSection(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  // /en -> home, /en/gallery -> gallery, etc.
  if (parts.length < 2) return 'home';
  const section = parts[1];
  return (KNOWN_SECTIONS as readonly string[]).includes(section) ? section : 'home';
}

export default function SEOHead({ title, description, page }: SEOHeadProps = {}) {
  const { t, i18n } = useTranslation();
  const { lang: routeLang } = useParams();
  const { pathname } = useLocation();
  const lang = (LANGS as readonly string[]).includes(routeLang || '') ? (routeLang as string) : i18n.language || 'en';

  useEffect(() => {
    const section = page || detectSection(pathname);
    const sectionTitleKey = `seo.${section}.title`;
    const sectionDescKey = `seo.${section}.description`;
    const sectionTitle = title || (t(sectionTitleKey, { defaultValue: '' }) as string);
    const sectionDesc = description || (t(sectionDescKey, { defaultValue: '' }) as string);

    const fullTitle = sectionTitle ? `${sectionTitle} — ${SITE_NAME}` : DEFAULT_TITLE;
    const fullDesc = sectionDesc || DEFAULT_DESC;
    const canonical = `${SITE_URL}${pathname}`;

    document.title = fullTitle;
    document.documentElement.lang = lang;

    setMeta('name', 'description', fullDesc);
    setLink('canonical', canonical);

    LANGS.forEach((l) => setLink('alternate', `${SITE_URL}${swapLang(pathname, l)}`, l));
    setLink('alternate', `${SITE_URL}${swapLang(pathname, 'en')}`, 'x-default');

    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', fullDesc);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:locale', LOCALE[lang] || 'en_US');
    setMeta('property', 'og:image', OG_IMAGE);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:image:alt', fullTitle);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', fullDesc);
    setMeta('name', 'twitter:image', OG_IMAGE);

    if (section !== 'home') {
      setJsonLd('breadcrumb', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'EduChain', item: `${SITE_URL}/${lang}` },
          { '@type': 'ListItem', position: 2, name: sectionTitle || section, item: canonical },
        ],
      });
    }
  }, [title, description, page, pathname, lang, t]);

  return null;
}
