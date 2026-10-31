import { useTranslation } from "react-i18next";

/**
 * A one-line reminder, under the navbar, on every route.
 *
 * The platform already says it is a school tool on a test network with no real
 * money — but only on the landing page and /demo. Someone who arrives straight
 * from a search result on /shop, /marketplace or /curriculum meets "buying and
 * selling GAME tokens", "liquidity pools" and "seed phrases" with nothing on
 * screen to frame them. Nothing here is hidden or reworded; the framing is just
 * made impossible to miss.
 */
export default function SafetyBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="note"
      className="w-full border-b text-xs sm:text-sm"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
    >
      <div
        className="max-w-5xl mx-auto px-4 py-2 flex items-start gap-2"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: "0.15em", color: "var(--color-accent-info)" }}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>
          {t(
            "banner.safety",
            "Educational tool. Everything runs on a test network — the tokens and NFTs have no value and are not traded anywhere.",
          )}
        </span>
      </div>
    </div>
  );
}
