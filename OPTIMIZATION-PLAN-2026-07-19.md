# EduChain (educhain.gembait.com) — Optimization Plan (2026-07-19)

> Companion to `CODE-REVIEW-FINDINGS-2026-07-19.md` (same dir). Findings = analysis; **this = the
> execution roadmap: what to DO, in order, without touching code now.** Nothing applied. chmod 600
> (references the deployer-key file). `/educhain`'s .gitignore whitelists only `blockchain/`, so this
> file can't be committed.
>
> Scope note: no deep runtime perf profiling was done (no Lighthouse / bundle-analyzer). Section C
> lists perf items visible from the code; where measurement is needed it says so. Context: deployed
> only to a **self-run testnet** (chainId 821207), so contract risk is bounded — but the code should
> be treated as if it will carry value.

Effort: **S** ≤1h · **M** a few h · **L** a day+. Impact: 🔴 high · 🟠 medium · 🟢 low.
Stack: Vite 8 + React 19 + **TypeScript** SPA (~8.5k LOC), Hardhat contracts (~3.2k LOC, 7 contracts),
Express contact backend + static-server. Git repo (github.com/ivanovslavy/EduChain) tracks only
`blockchain/` + docs.

---

## A. Security / correctness hardening (do FIRST)

- [ ] **A1 · S · 🔴 Delete the duplicate deployer-key file.** The owner EOA `0x5578…a5dC` (deployer +
  sole owner of all 7 contracts) has its key in `blockchain/.env` (0600, gitignored — fine) **and a
  needless copy in `blockchain/.env.bak-rpc`** → delete the backup. Pure attack surface.
- [ ] **A2 · S · 🟠 Fix the `hardhat.config.js.bak-rpc` public-leak vector.** It's untracked AND not
  gitignored inside the whitelisted `blockchain/` tree → a `git add -A` would commit it to the (public)
  repo. No secret in it, but stale RPC cruft → delete it or add to `blockchain/.gitignore`.
- [ ] **A3 · S · 🟠 Cap `GameToken.mintToContract`** (contracts, sol:365) — owner-only mint with no
  supply cap = unbounded inflation of the sale token. Add a max-supply cap (this is a contract change,
  so batch it with A/H below and a redeploy — record for the next deploy).
- [ ] **A4 · — · 🟢 `.env`-in-history note.** The old `.env` sits in git history (added `8fccbf1`,
  untracked in `74df75b`) but holds only client-public `VITE_*` values → blast radius ≈ nil. Optional
  history scrub; just confirm `VITE_RPC_URL` never embedded a paid Alchemy/Infura key (currently
  self-hosted `rpc1.gembascan.io`).

## B. Resilience (do SECOND)

- [ ] **B1 · S · 🟠 Push the unpushed HEAD.** `b0d5a83` (regenesis redeploy) is 1 commit ahead of
  `origin/main` → push it so the remote matches the deployed state.
- [ ] **B2 · — · 🟢 Frontend VCS is by-design absent** (`.gitignore` whitelists only `blockchain/`) —
  if the frontend history matters, consider a separate private repo; otherwise leave as-is (the app
  source rebuilds and the design is documented).

## C. Performance (measure first where noted)

- [ ] **C1 · M · 🟠 Measure then split the bundle.** Large page components (`Marketplace` 601,
  `TokenShop` 570, `About` 511, `Home` 496, `Demo` 490) plus the full v3-backup ABIs; likely one big
  chunk. → `rollup-plugin-visualizer`, then `React.lazy` the heavy/rare routes (Admin panel,
  Marketplace, Demo). *(Needs measurement.)*
- [ ] **C2 · S · 🟢 Confirm asset caching** (immutable `dist/assets/*`, no-cache `index.html`) —
  `static-server.cjs` already does SEO-correct serving; verify the cache headers are set.
- [ ] **C3 · — · 🟢 Lighthouse baseline** on the token-shop/marketplace pages to quantify JS
  execution time before investing in C1.
- [ ] **C4 · S · 🟢 The read-only provider design is already a perf win** (separate RPC provider to
  avoid quota contention) — keep it; just verify `publicReader` isn't over-fetching on every render.

## D. Code structure / maintainability

- [ ] **D1 · M · 🔴 Turn on TypeScript strictness + kill the `any` sprawl.** `tsconfig.app.json:23-24`
  has `strict:false` + `noImplicitAny:false`, which de-fangs the whole app and lets 53 `any` + 25
  `as any` pass at the ethers/wagmi boundary (contract returns read positionally through `any`,
  `publicReader.ts:110`). → flip `strict:true`, type the contract read shapes, remove the `as any`
  casts. This is the single biggest correctness lever for a value-moving UI.
- [ ] **D2 · M · 🟠 Add error UI to the read pages.** ~20 `.catch(()=>0n)` in `TokenShop` + similar in
  `Marketplace`/`Faucet`/`Gallery`/`WalletButton` render "0 tokens / empty" on an RPC outage instead
  of an error (only `Demo.tsx` has an error state). → surface a read-error state (the write path via
  `useTxToast` is already good).
- [ ] **D3 · S · 🟢 Centralize the explorer URL.** Hardcoded `testnet.gembascan.io` in 3 files +
  env-driven in 2 → one config export.

## E. Cleanup

- [ ] **E1 · S · 🟢 Delete dead code inside `src/`** (all gitignored, local clutter):
  `contracts/addresses.ts` (orphan — everyone imports `addresses.json`), `contracts/_v1-backup-
  20260419/` (~470KB old v1 ABIs), `config/wagmi.ts.bak-rpc`, `lib/publicReader.ts.bak-rpc`,
  `contracts/addresses.json.bak-pre-regenesis-*`, empty `src/docs/` + `src/components/admin/`.
- [ ] **E2 · S · 🟢 Reclaim ~275MB of prod-disk cruft** (all gitignored): `archives/` 161M,
  `dist.bak-rpc/` + `dist.bak-rpc-root/` (38M each), `_legacy/` 756K, `.env.bak-rpc`, `build`→dist
  symlink; the stale systemd unit `educhain.service.bak.20260613`.
- [ ] **E3 · S · 🟢 Update the stale CLAUDE.md.** 13 stale hits: §9 still titled "Smart Contract
  Addresses (Sepolia)" (migrated to GembaBlockchain + regenesis-redeployed), EmailJS refs (replaced by
  the self-hosted SMTP backend), `npx serve` refs (replaced by `static-server.cjs`). README is current.
- [ ] **E4 · S · 🟢 Set real IPFS CIDs** in the live config — `deployed/latest.json` still ships
  `ipfs://bafybeiexamplepredefined/` / `…examplecustom/` placeholders.

## F. Quality (raise the floor — the biggest gap)

- [ ] **F1 · L · 🔴 Write a contract test suite.** ~3.2k LOC of value-moving contracts have ZERO
  tests (`hardhat test` runs nothing; the smoke script has no assertions; coverage/gas-reporter
  installed but unused). → unit + invariant tests for GameToken, both NFT mints, TokenMarketplace,
  ETHFaucet, Whitelist: happy path + access control + reentrancy + refund math + rate limits. Highest
  ROI item here.
- [ ] **F2 · S · 🟢 Contract-hygiene nits:** `GameToken.renounceOwnership()` reverts with the wrong
  reused error `NotWhitelisted(address(0))`; `TrackingContract` view functions iterate the full
  ever-whitelisted set (gas-DoS for off-chain callers at scale); `deploy.js` auto-verify never runs on
  the `gemba` network (relies on `verify-all.js`) — align.
- [ ] **F3 · — · 🟢 Resolve the branding-vs-reality gap.** There is NO education/credential/certificate
  logic on-chain — it's a generic Web3 starter kit (token sale + NFT mints + marketplace + faucet +
  leaderboard). → either add real education logic (issue verifiable credentials) or state plainly in
  the docs/marketing that it's a Web3 starter/demo. Product decision, not code.

## G. Governance (before any value-bearing deploy)

- [ ] **G1 · M · 🟠 Split owner from deployer / add a multisig.** One EOA is deployer + sole owner of
  all 7 contracts + a whitelisted test user, and can drain all ETH + reset all params + mint unlimited
  GAME. Testnet ⇒ nil impact today, but before any mainnet/value deploy: hardware wallet or multisig
  as owner, distinct from the deployer.

---

## Suggested sequence

1. **A1 A2** (delete the duplicate key file; fix the `.bak-rpc` public-leak vector) + **B1** (push HEAD)
   — today.
2. **E1 E2 E3 E4** (delete src dead-code, reclaim 275MB, update CLAUDE.md, real IPFS CIDs).
3. **F1** (write the contract tests — the biggest gap).
4. **D1 D2 D3** (`strict:true` + de-`any`, error UI on read pages, centralize explorer URL).
5. **C3 C2 C1** (Lighthouse baseline, caching, then measured bundle split).
6. **A3 F2 F3 G1** (cap the mint + contract nits + branding decision + owner/multisig) — batch the
   contract changes into one reviewed redeploy.

> Do A + B before E/F. Delete the duplicate key + close the public-leak vector first; the tests
> (F1) are the highest-value quality investment.
