# EduChain — Full Code Review Findings (2026-07-19)

> **Status: OPEN — nothing fixed.** Read-only 3-agent review of `/educhain` on 46.225.1.162
> (educhain.gembait.com, git github.com/ivanovslavy/EduChain). Recorded as a to-do checklist —
> same convention as the Permitiv / gembaticket / gembapay reviews. Tick items off + note the
> fixing commit next to each when work resumes.
>
> chmod 600: references the deployer-key file location and a committed-env note. `/educhain` is
> NOT a git repo tree that tracks this file (the repo whitelists only `blockchain/`), so it can't
> be committed — but keep it 0600 on the shared host.

## What EduChain actually is (branding vs reality)

Branded as an "EU Web3 education platform / certificates". **Reality: there is NO education /
credential / certificate logic on-chain.** It is a generic Web3 starter kit — ERC-20 sale token +
two ERC-721A mint contracts + escrow marketplace + ETH faucet + points leaderboard, all gated by a
shared whitelist. Frontend = Vite 8 + React 19 + TypeScript SPA (~8.5k LOC). Contracts = ~3.2k LOC
Solidity (Hardhat 0.8.28). Deployed only to the **self-run GembaBlockchain testnet** (chainId
821207, Blockscout at testnet.gembascan.io) — no real-money exposure. Grades: frontend 7/10,
contracts 6.5/10, hygiene 6/10.

---

## 1. HIGH

- [ ] **H1 — Zero tests on ~3.2k LOC of value-moving contracts.** No `test/` dir anywhere (prod,
  v2, or backup). `package.json` declares `hardhat test` but there is nothing to run;
  `scripts/test-gemba.js` (40 LOC) is a console-log smoke script with no assertions;
  `solidity-coverage` + `hardhat-gas-reporter` are installed but unused. **Do: write unit +
  invariant tests for GameToken, the two NFT mints, TokenMarketplace, ETHFaucet, Whitelist —
  happy path + access control + reentrancy + refund math + rate limits.**

- [ ] **H2 — Single-EOA centralization + the controlling key stored plaintext AND duplicated.**
  One EOA `0x5578c75F…a5dC` is deployer, sole `owner` of all 7 contracts, and a whitelisted test
  user. Its key sits at `blockchain/.env` (`USER1_PRIVATE_KEY`, 0600, gitignored — acceptable) **and
  a needless second copy in `blockchain/.env.bak-rpc`.** That key can drain all ETH
  (`GameToken.withdrawETH:341`, `ETHFaucet.withdraw/emergencyWithdrawAll:329/342`,
  `GameNFTCustom.withdrawETH/withdrawTokens:403/412`), reset all prices/limits, and mint unlimited
  GAME. Testnet ⇒ nil financial impact, but the backup key file is pure attack surface. **Do: delete
  `blockchain/.env.bak-rpc`; for any future value-bearing deploy, move to a hardware wallet / split
  owner from deployer / multisig.**

## 2. MEDIUM

- [ ] **M1 — Uncapped owner mint.** `GameToken.sol:365 mintToContract` — owner-only mint with no
  supply cap → unbounded inflation of the sale token. **Do: add a max-supply cap (or document the
  intent explicitly).**
- [ ] **M2 — `.env` was committed to git history and is reachable from `origin/main`** (added in
  `8fccbf1`, untracked later in `74df75b`). The leaked values are **exclusively client-public
  `VITE_*`** (self-hosted RPC URL, EmailJS *public* key, Turnstile *site* key, WalletConnect id) —
  all baked into the shipped bundle by design, so blast radius ≈ nil. **Do: confirm `VITE_RPC_URL`
  never embedded a paid Alchemy/Infura key (currently `rpc1.gembascan.io`, low risk); optionally
  scrub history. Not urgent.**
- [ ] **M3 — `blockchain/hardhat.config.js.bak-rpc` is untracked AND not gitignored** → a stray
  `git add -A` commits it to the (likely public) repo. It contains no secret (scanned clean) but is
  stale RPC-migration cruft. **Do: delete it or add to `blockchain/.gitignore`.**
- [ ] **M4 — CLAUDE.md (49KB) is stale vs reality** (last touched Apr 24, before the June chain/RPC/
  SMTP migrations; 13 stale hits): §9 titled "Smart Contract Addresses (Sepolia)" while the app
  migrated to GembaBlockchain + regenesis-redeployed; references EmailJS (replaced by the
  self-hosted SMTP backend `server/index.cjs`) and `npx serve` (replaced by `static-server.cjs`).
  README.md is current — only CLAUDE.md drifted. **Do: update CLAUDE.md §9 + the EmailJS/serve refs.**
- [ ] **M5 — `strict: false` + `noImplicitAny: false`** (`tsconfig.app.json:23-24`) de-fang type
  checking, enabling 53 `any` + 25 `as any` at the ethers/wagmi boundary. Contract returns read
  positionally through `any` (`lib/publicReader.ts:110` `(preSales as any).totalMinted ?? (preSales
  as any)[1]`), fragile vs ABI changes; hotspots `context/Web3Context.tsx:83-89` (`(WhitelistABI as
  any).abi` ×7), `pages/Marketplace.tsx`, `components/FunctionForm.tsx`, `pages/AdminPanel.tsx`.
  **Do: enable `strict: true`, type the contract read shapes, remove the `as any` casts.**
- [ ] **M6 — Silently swallowed read errors → no error UI.** Read calls fall back to defaults with
  no user signal: `pages/TokenShop.tsx:64-123` (~20 `.catch(()=>0n/null)`), `Marketplace.tsx:128-168`,
  `Faucet.tsx:40-42`, `Gallery.tsx:86-103`, `WalletButton.tsx:51`. On an RPC outage the UI shows
  "0 tokens / empty marketplace" instead of an error. Only `Demo.tsx` has an error state. **Do: add
  an error surface to the data pages (the write path via `useTxToast` is already fine).**

## 3. LOW

- [ ] **L1 — Explorer URL duplicated 5× with two mechanisms:** hardcoded
  `const ETHERSCAN='https://testnet.gembascan.io'` in `Marketplace.tsx:16`, `useTxToast.tsx:6`,
  `AdminPanel.tsx:23`; env-driven with the same fallback in `Gallery.tsx:15`, `Demo.tsx:69`.
  Centralize into one config export.
- [ ] **L2 — Dead code inside `src/`** (all gitignored, local clutter only): `contracts/addresses.ts`
  (orphan — everyone imports `addresses.json`), `contracts/_v1-backup-20260419/` (~470KB old v1 ABIs),
  `config/wagmi.ts.bak-rpc`, `lib/publicReader.ts.bak-rpc`, `contracts/addresses.json.bak-pre-regenesis-20260627`,
  empty dirs `src/docs/` + `src/components/admin/`.
- [ ] **L3 — ~275MB+ deletable backup cruft on the prod disk** (all gitignored): `archives/` 161M,
  `dist.bak-rpc/` + `dist.bak-rpc-root/` (38M each), `_legacy/` 756K, `.env.bak-rpc`, `build`→dist
  symlink. Safe to remove.
- [ ] **L4 — Placeholder IPFS URIs live in the deployed config:** `deployed/latest.json`
  `predefinedBaseURI`/`customBaseURI` = `ipfs://bafybeiexamplepredefined/` / `…examplecustom/` —
  example CIDs, not real metadata. **Do: set real CIDs (or confirm intentional).**
- [ ] **L5 — deploy.js auto-verify never runs on `gemba`:** `scripts/deploy.js`
  `isPublicNetwork = network.name === "sepolia" || "mainnet"` skips PHASE-4 verify on the `gemba`
  network even though `hardhat.config.js` defines a `gemba` customChain (relies on separate
  `verify-all.js`). Align.
- [ ] **L6 — HEAD (`b0d5a83`, regenesis redeploy) is 1 commit ahead of `origin/main`, unpushed.**
  Push it.
- [ ] **L7 — Stale systemd artifact** `/etc/systemd/system/educhain.service.bak.20260613-081011` —
  leftover unit backup, clutter.
- [ ] **L8 — Contract-hygiene nits:** `GameToken.sol:381` `renounceOwnership()` reverts with the
  wrong reused error `NotWhitelisted(address(0))` (cosmetic); `TrackingContract.sol:294`
  `_activeWhitelistedCount` + `getLeaderboardPaginated` iterate the full ever-whitelisted set in view
  functions (gas-DoS for off-chain callers at scale, no fund risk); post-migration stale naming
  (`publicReader.ts:38 const SEPOLIA = new Network('gemba', 821207)`, "publicnode/Infura" comments).
- [ ] **L9 — `package.json` has no `engines`; frontend + server (express/nodemailer) runtime deps
  share one manifest.** Heavy inline styling (760 `style={{}}`, mostly CSS-var theming); large page
  components (Marketplace 601, TokenShop 570 w/ ~15 useState, About 511, Home 496, Demo 490).

## 4. Verified GOOD (do not re-audit)

- **Solidity craftsmanship is strong:** all 7 contracts use OZ (`Ownable`/`ReentrancyGuard`/
  `SafeERC20`) + ERC721A, **zero hand-rolled crypto**, **custom errors only (0 require-strings)**,
  disciplined CEI + `nonReentrant` everywhere value moves, every `.call{value:}` checks its return,
  full NatSpec, `renounceOwnership()` overridden to revert, zero-address/zero-amount/bounds
  validation in every constructor + setter, packed-struct storage. TokenMarketplace is especially
  tight (owner cannot touch escrow; only `emergencyCancelListing`→seller). Security-smell sweep
  entirely clean: no tx.origin, delegatecall, selfdestruct, or inline assembly.
- **Frontend hygiene:** 0 `console.log`, 0 TODO/FIXME/HACK, 0 `@ts-ignore`/`@ts-expect-error`, 0
  non-null-assertion abuse, **no secrets in `src`** (only correctly-public `VITE_` keys). Thoughtful
  web3 architecture: a dedicated read-only provider (`lib/publicReader.ts`) split from the wallet/
  signer contracts to avoid RPC-quota contention + login role-flicker; last-write-wins role checks
  (`Web3Context.tsx:112-160`); `withSigner()` sentinel turning ethers' `UNSUPPORTED_OPERATION` into a
  clean localized message. Unusually good "why" comments. Centralized write-path UX (`useTxToast`),
  full parallel i18n (en/bg/es, 1653 lines each), real a11y (99 `aria-*`/`role=`).
- **Deployment hardened:** both backends bind `127.0.0.1` (static-server :3085, contact API :3088
  as www-data); Apache TLS + full security headers (HSTS preload, X-Frame-Options, nosniff,
  Referrer/Permissions-Policy) + HTTP→HTTPS. `server/index.cjs` (SMTP contact form + IPFS proxy) and
  `static-server.cjs` (SEO-correct SPA serving) carry no hardcoded secrets, validate env at boot,
  Turnstile + per-IP rate limiting.
- **Secrets properly scoped:** deployer key `blockchain/.env` (0600, double-gitignored),
  `.env.server` (root:www-data 0640, SMTP + Turnstile secret), no private key committed anywhere,
  Hardhat config reads all keys from `process.env`. `.gitignore` is a solid whitelist. Source matches
  deployed (regenerated ABIs include the Multi functions; `deployed/latest.json` recorded + verified
  on gembascan).
- **"v2" is not a separate codebase:** `~/educhain-contracts-v2` doesn't exist; "v2" =
  `~/Documents/Solidity_Projects/educhain`, the SAME repo at an earlier (Sepolia) point. Drift is
  minimal — 6 of 7 contracts byte-identical; only `GameNFTCustom.sol` (+95 LOC Multi functions) +
  the network migration differ.

## 5. Recommended fix order

1. **H1** — write the contract test suite (the biggest gap).
2. **H2 + M1** — delete the duplicate key file (`blockchain/.env.bak-rpc`); cap `mintToContract`;
   plan owner≠deployer / multisig before any value-bearing deploy.
3. **M3** — gitignore/delete `blockchain/hardhat.config.js.bak-rpc` (public-leak vector).
4. **M4 + L6** — update CLAUDE.md to the live chain/serving reality; push HEAD.
5. **M5 + M6** — `strict:true` + de-`any` the web3 boundary; add error UI to read pages.
6. **L2 + L3 + L7** — clean the ~275MB backup cruft, `src/` orphans, stale systemd unit.
7. **L1 / L4 / L5 / L8** opportunistically; decide the branding-vs-reality question (add real
   education logic, or state plainly it's a Web3 starter kit).
