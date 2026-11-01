import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EXPLORER_URL } from '../config/explorer';
import addresses from '../contracts/addresses.json';
import {
  DemoIcon,
  CurriculumIcon,
  PartnershipIcon,
  ContactIcon,
  TokenIcon,
  NFTPredefinedIcon,
  NFTCustomIcon,
  MarketplaceIcon,
  TrophyIcon,
  FaucetIcon,
  GalleryIcon,
} from '../components/icons';
import {
  ArrowRight,
  PlayCircle,
  Github,
  ExternalLink,
  Wallet,
  PenTool,
  Link as LinkIcon,
  Sparkles,
  X,
} from 'lucide-react';

// Когато видеото е готово, замени това с YouTube embed URL
// Пример: "https://www.youtube.com/embed/VIDEO_ID"
// Ако е локален MP4 (напр. "/demo/demo.mp4"), рендерира се като <video>.
// Per-language локални walkthrough-и: BG (default) / EN / ES
// VIDEO_CACHE_BUST — бъмпни при ре-енкодване на видеата; налага fresh fetch
// въпреки browser video cache и 4h Cloudflare TTL (иначе <video> държи
// старото range-bytes дори в incognito).
const VIDEO_CACHE_BUST = '20260424c';
const VIDEO_BY_LANG: Record<string, string> = {
  bg: `/demo/demo.mp4?v=${VIDEO_CACHE_BUST}`,
  en: `/demo/demo-en.mp4?v=${VIDEO_CACHE_BUST}`,
  es: `/demo/demo-es.mp4?v=${VIDEO_CACHE_BUST}`,
};
const IS_LOCAL_VIDEO_RE = /\.(mp4|webm|ogg)(\?|$)/i;

// Всеки screenshot има base filename в public/demo/.
// За localized: true, реалният URL става `<base>-<langKey>.png` за en/es;
// bg използва base-а без суфикс (защото съществуващите BG snapshots
// нямат -bg суфикс). За localized: false се показва един и същ файл
// независимо от ezika (например Etherscan UI).
const SCREENSHOTS = [
  { key: 'home', file: 'home-hero.png', Icon: DemoIcon, localized: true },
  { key: 'faucet', file: 'faucet-claim.png', Icon: FaucetIcon, localized: true },
  { key: 'shop', file: 'shop-mint.png', Icon: TokenIcon, localized: true },
  { key: 'gallery', file: 'gallery-owned.png', Icon: GalleryIcon, localized: true },
  { key: 'marketplace', file: 'marketplace-listings.png', Icon: MarketplaceIcon, localized: true },
  { key: 'leaderboard', file: 'leaderboard-live.png', Icon: TrophyIcon, localized: true },
  { key: 'rankings', file: 'rankings-filters.png', Icon: NFTPredefinedIcon, localized: true },
  { key: 'connect', file: 'metamask-connect.png', Icon: Wallet, localized: true },
  { key: 'transaction', file: 'metamask-transaction.png', Icon: PenTool, localized: true },
  { key: 'etherscan', file: 'etherscan-proof.png', Icon: LinkIcon, localized: false },
];

function resolveScreenshotFile(file: string, langKey: string, localized: boolean) {
  if (!localized || langKey === 'bg') return file;
  return file.replace(/\.png$/, `-${langKey}.png`);
}

const GITHUB_URL = 'https://github.com/ivanovslavy/EduChain';
const EXPLORER = EXPLORER_URL;
const ETHERSCAN_EXAMPLE = `${EXPLORER}/address/${addresses.gameNFTPredefined}`;

export default function Demo() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Нормализираме "en-US" / "en_GB" / "dev" до първите два символа,
  // за да не падаме обратно в BG фалбака при вариации на locale кода.
  const langKey = (lang || 'bg').slice(0, 2).toLowerCase();
  const videoUrl = VIDEO_BY_LANG[langKey] ?? VIDEO_BY_LANG.bg;
  const isLocalVideo = IS_LOCAL_VIDEO_RE.test(videoUrl);

  const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* HERO */}
      <section className="text-center mb-12 animate-fade-up">
        <div
          className="inline-flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          <DemoIcon size={16} />
          <span>{t('demo.hero.eyebrow', 'See the platform in action')}</span>
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('demo.hero.title', 'EduChain in one minute')}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('demo.hero.subtitle', '...')}
        </p>
      </section>

      {/* VIDEO SECTION */}
      <section className="mb-16 animate-fade-up delay-100">
        {videoUrl ? (
          <div
            className="relative w-full"
            style={{
              paddingBottom: '56.25%',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
            }}
          >
            {isLocalVideo ? (
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <iframe
                src={videoUrl}
                title="EduChain Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              />
            )}
          </div>
        ) : (
          <div
            className="card flex flex-col items-center justify-center text-center"
            style={{
              padding: '60px 24px',
              minHeight: '320px',
              background:
                'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(6, 182, 212, 0.08))',
              borderColor: 'var(--color-primary)',
              borderWidth: '1px',
            }}
          >
            <PlayCircle
              size={64}
              style={{ color: 'var(--color-primary)', marginBottom: '16px' }}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h3
              className="font-display text-xl font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('demo.videoPlaceholder.title', 'Video demonstration')}
            </h3>
            <p
              className="text-sm max-w-lg leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('demo.videoPlaceholder.body', '...')}
            </p>
          </div>
        )}

        {/* CTA buttons under video */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Link to={`/${lang}/contact`} className="btn-flat primary inline-flex items-center gap-2">
            <ContactIcon size={16} />
            <span>{t('demo.hero.ctaPrimary', 'Try it yourself')}</span>
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link to={`/${lang}/curriculum`} className="btn-outline inline-flex items-center gap-2">
            <CurriculumIcon size={16} />
            <span>{t('demo.hero.ctaSecondary', 'See curriculum')}</span>
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS — 5 steps */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('demo.steps.title', 'How the platform works')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('demo.steps.subtitle', '...')}
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step} className="card">
              <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                <div
                  className="font-display text-3xl font-semibold mb-2 md:mb-0 md:min-w-[80px]"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t(`demo.steps.${step}.number`, '')}
                </div>
                <div className="flex-1">
                  <h3
                    className="font-display text-lg font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t(`demo.steps.${step}.title`, '')}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(`demo.steps.${step}.body`, '')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SCREENSHOTS GALLERY */}
      <section className="mb-16 animate-fade-up delay-200">
        <div className="mb-8 text-center">
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('demo.screenshots.title', 'Screenshots from the platform')}
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('demo.screenshots.subtitle', '...')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SCREENSHOTS.map(({ key, file, Icon, localized }) => {
            const resolved = resolveScreenshotFile(file, langKey, localized);
            return (
              <ScreenshotCard
                key={`${key}-${langKey}`}
                k={key}
                file={resolved}
                Icon={Icon}
                onOpen={() => setLightbox(`/demo/${resolved}`)}
              />
            );
          })}
        </div>
      </section>

      {/* PROOF — not a simulation */}
      <section className="mb-16 animate-fade-up delay-300">
        <div className="card" style={{ padding: '32px' }}>
          <h2
            className="font-display text-2xl font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('demo.proof.title', 'Not a simulation — real blockchain technology')}
          </h2>
          <p
            className="text-base leading-relaxed max-w-[720px] mb-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('demo.proof.body', '...')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2 text-sm"
            >
              <Github size={14} strokeWidth={2} aria-hidden="true" />
              <span>{t('demo.proof.viewGithub', 'Open code on GitHub')}</span>
              <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
            </a>
            <a
              href={ETHERSCAN_EXAMPLE}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2 text-sm"
            >
              <LinkIcon size={14} strokeWidth={2} aria-hidden="true" />
              <span>{t('demo.proof.viewEtherscan', 'View contract on GembaScan')}</span>
              <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="text-center animate-fade-up delay-300">
        <div className="card" style={{ padding: '40px 24px' }}>
          <Sparkles
            size={32}
            style={{ color: 'var(--color-primary)', margin: '0 auto 16px' }}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h2
            className="font-display text-2xl md:text-3xl font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('demo.cta.title', 'Ready to try?')}
          </h2>
          <p
            className="text-base max-w-xl mx-auto mb-6 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('demo.cta.subtitle', '...')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={`/${lang}/contact`} className="btn-flat primary inline-flex items-center gap-2">
              <ContactIcon size={16} />
              <span>{t('demo.cta.primary', 'Request access')}</span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              to={`/${lang}/partnership`}
              className="btn-outline inline-flex items-center gap-2"
            >
              <PartnershipIcon size={16} />
              <span>{t('demo.cta.secondary', 'See partnership')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* LIGHTBOX MODAL */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            <X size={32} strokeWidth={2} />
          </button>
          <img
            src={lightbox}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              borderRadius: '8px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// Screenshot card с автоматична fallback логика
// Ако image не се зарежда (404), показва placeholder вместо broken image
function ScreenshotCard({
  k,
  file,
  Icon,
  onOpen,
}: {
  k: string;
  file: string;
  Icon: React.ComponentType<{ size?: number }>;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Image area */}
      <div
        onClick={!error ? onOpen : undefined}
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '60%',
          background: 'var(--bg-secondary)',
          cursor: error ? 'default' : 'zoom-in',
          overflow: 'hidden',
        }}
      >
        {!error && (
          <img
            src={`/demo/${file}`}
            alt={t(`demo.screenshots.${k}.title`, k)}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: loaded ? 'block' : 'none',
            }}
          />
        )}

        {/* Placeholder when image missing or loading */}
        {(error || !loaded) && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--text-secondary)',
              opacity: 0.5,
            }}
          >
            <Icon size={48} />
            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{file}</span>
          </div>
        )}
      </div>

      {/* Title + caption */}
      <div style={{ padding: '16px 20px' }}>
        <h3
          className="font-display text-base font-semibold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {t(`demo.screenshots.${k}.title`, '')}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t(`demo.screenshots.${k}.body`, '')}
        </p>
      </div>
    </div>
  );
}
