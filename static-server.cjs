/**
 * EduChain static SPA server (SEO-correct serve layer)
 * --------------------------------------------------------------------------
 * Replaces `npx serve -s build` so we can express real HTTP semantics that
 * Google Search Console needs (no more soft-404s / 200-for-everything).
 *
 * Order of handling (must stay in this order):
 *   1. Real static assets (assets/*, *.png/svg, sitemap.xml, robots.txt, og/*,
 *      demo/*, docs/*, favicon, llms*.txt, ai.txt) -> 200, served from disk.
 *   2. Bare "/"                                    -> 301 redirect to /en
 *   3. Non /en|/bg|/es path whose first segment is a known section
 *                                                  -> 301 redirect to /en/<path>
 *   4. Path under /en|/bg|/es                      -> 200 + index.html with the
 *      <head> rewritten per-route (canonical, title, description, hreflang,
 *      og:*, twitter:*) so crawlers that do NOT execute JS see the same
 *      metadata SEOHead.tsx would emit client-side. This is what fixes the
 *      "every page canonicalizes to /en" GSC problem (2026-07-20).
 *   5. Anything else (genuinely unknown)           -> 404 + index.html body
 *
 * The per-route head values mirror src/components/SEOHead.tsx exactly:
 * titles/descriptions come from src/i18n/<lang>.json `seo.<section>.*`.
 */
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.disable('x-powered-by');

const PORT = parseInt(process.env.PORT || '3085', 10);
const BUILD_DIR = path.join(__dirname, 'dist'); // `build` is a symlink to dist; use dist directly
const INDEX_HTML = path.join(BUILD_DIR, 'index.html');

const SUPPORTED_LANGS = ['en', 'bg', 'es'];

// --- SEO constants (mirror src/components/SEOHead.tsx) ----------------------
const SITE_NAME = 'EduChain by GEMBA IT';
const SITE_URL = 'https://educhain.gembait.com';
const DEFAULT_TITLE = 'EduChain — Educational Blockchain Platform by GEMBA IT';
const DEFAULT_DESC =
  'Safe, educational Web3 platform for young learners. Mint NFTs, earn GAME tokens, and trade on a curated marketplace — all on GembaBlockchain testnet. Built by GEMBA IT.';
const LOCALE = { en: 'en_US', bg: 'bg_BG', es: 'es_ES' };

// Known client-side sections (from src/App.tsx routes). A non-prefixed request
// for one of these is a language-less deep link -> 301 into the default (en)
// locale, preserving the rest of the path. `home` -> bare /en index.
const KNOWN_SECTIONS = new Set([
  // 2026-10-31: without these two, /en/certificates and /en/verify/<serial> would be hard 404s —
  // this Set, not the one in SEOHead.tsx, is what decides 200 vs 404 for a server-rendered path.
  'certificates', 'verify',
  'home',
  'ethereum-foundation',
  'admin',
  'gallery',
  'marketplace',
  'shop',
  'faucet',
  'leaderboard',
  'rankings',
  'about',
  'contact',
  'partnership',
  'teachers',
  'curriculum',
  'demo',
  'privacy',
  'terms',
  'philosophy',
]);

// --- i18n seo.<section>.{title,description} (loaded once at startup) --------
const I18N = {};
for (const lang of SUPPORTED_LANGS) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'i18n', `${lang}.json`), 'utf-8'));
    I18N[lang] = raw.seo || {};
  } catch (e) {
    console.error(`i18n load failed for ${lang}: ${e.message}`);
    I18N[lang] = {};
  }
}

function seoFor(lang, section) {
  const entry = (I18N[lang] && I18N[lang][section]) || (I18N.en && I18N.en[section]) || {};
  return { title: entry.title || '', description: entry.description || '' };
}

// --- index.html template cache (re-read if the build is redeployed) ---------
let templateCache = { mtimeMs: 0, html: '' };
function loadTemplate() {
  const stat = fs.statSync(INDEX_HTML);
  if (stat.mtimeMs !== templateCache.mtimeMs) {
    templateCache = { mtimeMs: stat.mtimeMs, html: fs.readFileSync(INDEX_HTML, 'utf-8') };
  }
  return templateCache.html;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// swap the language prefix of a normalized pathname (mirrors SEOHead.swapLang)
function swapLang(pathname, targetLang) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return `/${targetLang}`;
  if (SUPPORTED_LANGS.includes(parts[0])) parts[0] = targetLang;
  else parts.unshift(targetLang);
  return '/' + parts.join('/');
}

// Rewrite the static <head> so a non-JS crawler sees the same metadata the
// SPA's SEOHead.tsx would produce for this route.
function renderIndexFor(pathname) {
  let html = loadTemplate();

  const parts = pathname.split('/').filter(Boolean);
  const lang = SUPPORTED_LANGS.includes(parts[0]) ? parts[0] : 'en';
  const section = parts.length >= 2 && KNOWN_SECTIONS.has(parts[1]) ? parts[1] : 'home';

  const { title, description } = seoFor(lang, section);
  const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE;
  const fullDesc = description || DEFAULT_DESC;
  const canonical = `${SITE_URL}${pathname}`;
  const tEsc = escapeAttr(fullTitle);
  const dEsc = escapeAttr(fullDesc);

  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${fullTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${dEsc}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  for (const l of SUPPORTED_LANGS) {
    html = html.replace(
      new RegExp(`(<link rel="alternate" hreflang="${l}" href=")[^"]*(")`),
      `$1${SITE_URL}${swapLang(pathname, l)}$2`
    );
  }
  html = html.replace(
    /(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/,
    `$1${SITE_URL}${swapLang(pathname, 'en')}$2`
  );
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${tEsc}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${dEsc}$2`);
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${LOCALE[lang] || 'en_US'}$2`);
  html = html.replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${tEsc}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${tEsc}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${dEsc}$2`);

  return html;
}

// Send index.html as the body with an explicit status (200 for SPA routes,
// 404 for genuine misses so the SPA shows its 404 page but crawlers see 404).
function sendIndex(res, status) {
  res.status(status);
  res.set('Content-Type', 'text/html; charset=utf-8');
  // index.html may change on each deploy; don't let proxies cache it hard.
  res.set('Cache-Control', 'no-cache');
  res.sendFile(INDEX_HTML, (err) => {
    if (err && !res.headersSent) res.status(500).end();
  });
}

// Send the per-route rewritten SPA shell (always 200 — real SPA routes only).
function sendRewrittenIndex(res, pathname) {
  let html;
  try {
    html = renderIndexFor(pathname);
  } catch (e) {
    console.error(`head rewrite failed for ${pathname}: ${e.message}`);
    return sendIndex(res, 200); // never break serving over SEO decoration
  }
  res.status(200);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-cache');
  res.send(html);
}

// ---------------------------------------------------------------------------
// 1. Real static assets first (index:false so "/" falls through to our logic).
//    `serve`-style: long cache for fingerprinted assets, served straight off disk.
// ---------------------------------------------------------------------------
app.use(
  express.static(BUILD_DIR, {
    index: false,
    redirect: false, // don't auto-301 "/dir" -> "/dir/"; we control redirects
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        // Vite fingerprints these -> safe to cache hard.
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// ---------------------------------------------------------------------------
// 2-5. Everything that wasn't a real static file lands here. Use a catch-all
//      middleware (NOT app.get('*'), which throws under Express 5 / path-to-regexp v8).
// ---------------------------------------------------------------------------
app.use((req, res) => {
  // Only GET/HEAD are meaningful for a static SPA host.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.set('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  // Normalise: strip query string, decode, collapse trailing slash.
  let pathname = req.path || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }

  // 2. Bare root -> default locale.
  if (pathname === '/' || pathname === '') {
    return res.redirect(301, '/en');
  }

  const segments = pathname.split('/').filter(Boolean); // e.g. ['en','about']
  const first = segments[0];

  // 4. Already a localized path. A known section (or the bare locale) is a real
  //    page -> 200. Anything else under a locale prefix is just as invented as a
  //    top-level miss, so it gets a real 404 too — otherwise /en/<anything>
  //    became an indexable phantom URL. (2026-08-13)
  if (SUPPORTED_LANGS.includes(first)) {
    const section = segments[1];
    if (!section || KNOWN_SECTIONS.has(section)) {
      return sendRewrittenIndex(res, pathname);
    }
    return sendIndex(res, 404);
  }

  // 3. Language-less but a known section -> 301 into the default locale,
  //    preserving the full sub-path (e.g. /gallery -> /en/gallery).
  if (KNOWN_SECTIONS.has(first)) {
    const rest = segments.join('/');
    return res.redirect(301, `/en/${rest}`);
  }

  // 5. Genuinely unknown path -> real 404 (body is the SPA so users get a nice
  //    404 page, but crawlers/GSC see the correct status).
  return sendIndex(res, 404);
});

app.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`EduChain static server listening on 127.0.0.1:${PORT} (build: ${BUILD_DIR})`);
});
