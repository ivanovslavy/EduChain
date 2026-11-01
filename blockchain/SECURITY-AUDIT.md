# EduChain — Security Self-Audit

**Project:** EduChain — on-chain educational game economy (tokens, NFTs, marketplace,
faucet, whitelist, progress tracking)
**Scope:** the 8 production Solidity contracts in [`contracts/`](contracts/)
**Network:** Gemba testnet (chainId **821207**); contracts verified on gembascan
**Date:** 2026-08-02
**Auditor / sign-off:** **Slavcho Ivanov — Tech Lead, GembaIT**

---

## 1. Summary

The trigger for this audit was finding **H1** — ~3.2k lines of value-moving contracts
shipped with **zero tests**. That gap is now closed: every contract is covered by a
five-layer adversarial programme (unit/access/attack, property fuzzing, stateful
invariants, static analysis, symbolic execution) plus a **live-fire run on the Gemba
testnet** where the attacks are executed as real transactions against a fresh deploy.

Nine code findings were identified (2 high, 3 medium, 4 low) and **all were fixed**
(one accepted with rationale); the production contracts were redeployed on the fixed
code and re-verified. Final state:

| Layer | Result |
|-------|--------|
| Hardhat unit / access / attack / invariant tests | **119 / 119 pass** |
| Foundry property fuzzing | **10 fuzz × 10 000 runs — pass** |
| Foundry stateful invariants | **4 invariants × 12 800 calls — pass** |
| Slither static analysis | **0 high (reentrancy-eth = 0)** |
| Mythril symbolic execution | **8 / 8 contracts — 0 issues** |
| Gemba testnet live-fire (fixed bytecode) | **every attack DEFEATED** |

**Where the evidence lives — and what is reproducible from a clone.**

| Layer | Source | Reproducible from this repo? |
|---|---|---|
| Hardhat 119, Foundry 14, attacker contracts, Slither, Mythril, live-fire | `test/`, `test-forge/`, `contracts/test/`, `slither.sh`, `myth-solc.json`, `scripts/live-fire/` — all committed | **Yes**, with the commands in [`TESTING.md`](TESTING.md) |
| 72-check certificate end-to-end, 8 red canaries, 37-check browser sweep, 6 mail checks | `~/Documents/Claude/EduChain-scripts/` on the maintainer's laptop — **not committed** | **No** — reported figures, not reproducible |

The contract layers are the audited scope and they are fully in the repository. The four
certificate figures above are **asserted, not reproducible**, and are deliberately not committed.
The reason is not secrecy about the code — none of those scripts hardcodes a secret; they read what
they need at runtime from gitignored files. The reason is what they depend on:

* three of them (`certificates-e2e.js`, `certificates-canaries.js`, `certificates-browser-full.js`)
  build their answer oracle by reading `server/certificates/questions/questions.bg.json` — the bank
  **including the `correct` index**. The bank is `640 root:www-data` and excluded from git by name.
  Committing the suites would not commit the bank, but it would publish the exact recipe for
  extracting an answer key, and the suites would still not run for anyone without the bank — so
  "reproducible" would remain false while the exam got easier to attack.
* two of them read the **cold owner key** from `blockchain/.env` at run time, and one reads SMTP
  credentials from the environment. No value is in the source, but a committed script whose
  documented path is *read the production owner key from this absolute path* is an invitation.
* they address absolute production paths and act on live state: the canary suite revokes and
  reinstates real serials. That is precisely how four test certificates ended up live on the public
  verification page on 2026-10-31 and had to be revoked.

**Decision: they stay off the repository**, and this document states the figures as measured rather
than as reproducible. Committing them would require first rewriting them to take the bank and every
path by injection and to refuse to touch a production serial — worth doing, tracked as an open item,
not done here. See [`docs/certificates.md`](../docs/certificates.md).

## 2. Scope — contracts audited

| Contract | Role |
|----------|------|
| `Whitelist` | admin/whitelist/blacklist roles + pagination |
| `GameToken` | ERC20 the game economy runs on (buy flow, rate limits) |
| `GameNFTPredefined` | fixed-catalogue NFT with maxSupply + daily caps |
| `GameNFTCustom` | custom-URI NFT, ETH + GAME payment paths |
| `TokenMarketplace` | ERC721/ERC20 listing → escrow → purchase |
| `TrackingContract` | points / tier / net-worth progress tracking |
| `ETHFaucet` | rate-limited testnet ETH faucet |
| `CertificateRegistry` | soulbound course certificates + public registry (hot `issuer` / cold `owner`) |

Solidity `0.8.28`, optimizer runs 200. Attacker/mock contracts live in
[`contracts/test/`](contracts/test/) and are **never** deployed by `scripts/deploy.js`.

## 3. Methodology — what & how it was tested

| # | Layer | Tooling | Files |
|---|-------|---------|-------|
| 1 | Unit, access-control, events, boundaries, real attacker contracts | Hardhat + Mocha/Chai | [`test/`](test/) (`01`–`10`) |
| 2 | Property fuzzing | Foundry `forge` | [`test-forge/FuzzGameToken.t.sol`](test-forge/FuzzGameToken.t.sol), [`FuzzCertificateRegistry.t.sol`](test-forge/FuzzCertificateRegistry.t.sol) |
| 3 | Stateful invariants | Foundry `forge` | [`test-forge/InvariantGameToken.t.sol`](test-forge/InvariantGameToken.t.sol), [`InvariantMarketplace.t.sol`](test-forge/InvariantMarketplace.t.sol) |
| 4 | Static analysis | Slither | [`slither.sh`](slither.sh) |
| 5 | Symbolic execution | Mythril | [`myth-solc.json`](myth-solc.json) |
| 6 | **Live-fire — real on-chain attacks** | Hardhat scripts | [`scripts/live-fire/`](scripts/live-fire/) |

The attacker suite (`08-attacks.test.js` + `contracts/test/`) exercises marketplace
bait-and-switch, fee-on-transfer drains, reentrancy on purchase/claim, unsolicited
NFT transfers, and privilege abuse by a blacklisted admin.

## 4. Findings & remediation

| # | Severity | Finding | Fix | Verified |
|---|----------|---------|-----|----------|
| **H1** | 🔴 High | ~3.2k LOC of value-moving contracts with **zero tests**. | this 80-test + fuzz/invariant/live-fire suite | coverage established |
| **A1** | 🔴 High | **Marketplace bait-and-switch** — paid for a fake ERC721 that never escrowed. | post-escrow `ownerOf == address(this)` assert on list + delivery assert on purchase | test 05/08 + live-fire DEFEATED |
| **A2** | 🟠 Medium | **Fee-on-transfer drain** — recorded the requested, not the received amount. | record `balanceAfter − balanceBefore`; per-token `_escrowedERC20` accounting | test 08 + live-fire DEFEATED |
| **A3** | 🟠 Medium | **Stuck NFT** — `onERC721Received` accepted any transfer, no rescue. | reject unsolicited safe-transfers + owner `rescueERC721/rescueERC20` (escrow-guarded) | test 05/08 |
| **A4** | 🟠 Medium | **Blacklisted admin kept power.** | `onlyOwnerOrAdmin` now rejects a blacklisted admin | test 01/08 |
| **A5** | 🟢 Low | **Stranded paymentToken** in `GameNFTCustom` after a payment-token swap. | added `sweepToken(address)` (distinct name — clean ABI/UI) | test 04 |
| **A6** | 🟢 Low | `ETHFaucet.fallback()` swallowed mistyped ETH-bearing calls. | removed `fallback()` → such calls now revert | test 06 |
| **A7** | 🟢 Low | `TrackingContract.setPointsFormula` unbounded weights. | `MAX_POINTS_WEIGHT` bound per weight | test 07 |
| **M1** | 🟢 Low | `GameToken.mintToContract` uncapped. | `MAX_SUPPLY` cap (100M) | test 02 |
| **L8** | 🟢 Low | Leaderboard view gas (`calls-in-loop`). | `MAX_BATCH_VIEW` 500 → 100 | test 07/09 |

Each fix preserves existing behaviour — the happy-path and invariant suites are
unchanged and still pass. One historical finding (an old third-party RPC key that
remains only in git history, no longer active) is **accepted**: the active exposure is
stopped and the chain is on gembascan.

## 5. Static-analysis classification

- **Mythril** — symbolic execution over all 8 production contracts: **0 issues**.
- **Slither** — **0 high**; `reentrancy-eth = 0`. The `reentrancy-benign` / events items
  (e.g. `TokenMarketplace.createERC721Listing`) write state after the escrow transfer
  but are guarded by `nonReentrant` + checks-effects-interactions and move no attacker
  value — not exploitable. Remaining items are informational (naming, `block-timestamp`
  for cooldowns/daily windows, view-function gas) with no security impact.

## 6. On-chain — verified production deployment (Gemba 821207)

| Contract | Address |
|----------|---------|
| Whitelist | `0x76D8ddb79F91df2FB494Ef5375A67F778860AcFE` |
| GameToken | `0x7C9FFE16984b4fd7d006E806ce60C80d1089caA9` |
| GameNFTPredefined | `0x8c05d9Ff72a1053b838BC7a945Aa203d700F0371` |
| GameNFTCustom | `0x8838300d9F56d463E90356403E1E479a6DA62cFf` |
| TokenMarketplace | `0x965d745e3fc0a7c2c9648dDaed0eb6EF276e8972` |
| TrackingContract | `0x9f5349e8514726b394fDEcEf16C1E8122f909397` |
| ETHFaucet | `0x76c46FF20A2770e564052A60dcB3990f2D8082AB` |
| CertificateRegistry | `0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4` |

The first seven were redeployed on the fixed code and verified on gembascan; CertificateRegistry
was deployed on 2026-10-31 and verified there too (solc 0.8.28) — see §9. The live-fire
harness ([`scripts/live-fire/`](scripts/live-fire/)) reproduces the attacks against a
disposable fresh deploy so production is never touched.

## 7. How to reproduce

Everything is in this repository. See [`TESTING.md`](TESTING.md) for full detail:
```bash
cd blockchain
npm install
git clone --depth 1 https://github.com/foundry-rs/forge-std.git lib/forge-std
npx hardhat test                     # 119 unit/access/attack/invariant tests
forge test                           # fuzz + invariants
./slither.sh                         # static analysis
# Mythril: myth analyze contracts/<C>.sol --solc-json myth-solc.json --solv 0.8.28
# Live-fire (needs a funded .env): scripts/live-fire/ (see its README)
```
Secrets (RPC, funding key) live only in a gitignored `.env`; see
[`.env.example`](.env.example).

## 8. Conclusion

The zero-test gap (H1) is closed and all code findings are remediated and re-verified,
both locally and on-chain. Slither reports no high/real-medium issues and Mythril
reports none. In my assessment the EduChain contracts carry no known high- or
medium-severity vulnerabilities and are safe for their intended educational use.

**Slavcho Ivanov**
Tech Lead, GembaIT
2026-08-02

---

## 9. CertificateRegistry — added and audited 2026-10-31

**Scope.** `contracts/CertificateRegistry.sol` (15 376 B source), deployed at
[`0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4`](https://testnet.gembascan.io/address/0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4#code)
on GembaBlockchain testnet 821207 and source-verified there. Owner
`0x5578c75F22dE0bf1caA4BdD46BA28406C696a5dC` (the existing cold deployer), issuer
`0x13f1b11dc5DcAcC6f05983655B04885882E824c8` (a new hot key, created for this and nothing else).

**Design decisions that are the security.**

* **Soulbound.** `transferFrom`, `safeTransferFrom`, `approve` and `setApprovalForAll` all revert;
  `_update` refuses any move where `from != address(0)`, so minting works and nothing else does.
  Not even the owner can move a certificate. A credential that can be sold certifies nothing.
* **No external calls, no payable functions.** `_mint` is used rather than `_safeMint` precisely so
  that issuing cannot call out to a recipient contract. With no value and no calls out there is no
  reentrancy surface at all — not a guarded one, an absent one.
* **Role separation.** The hot key on the server can call exactly one function, `issue()`. Revocation,
  role changes and the base URI are owner-only, and the owner key is not on the server. A full
  compromise of the API host therefore bounds the damage to certificates nobody earned — visible in
  the event log and revocable.
* **No personal data on-chain.** The record is a `bytes32` hash of the certificate's contents plus
  the date, the score, a course id and a revocation flag. The readable fields live off-chain where
  they can be corrected and erased; the hash proves a presented certificate is the one issued.
  `setBaseURI` is the only function in the ABI that takes a string, and a test asserts that.
* **One hash, one serial.** `tokenOfHash` makes the same certificate impossible to issue twice, and
  `issue` reverts naming the existing serial.
* **Reinstatement exists.** Refusing to undo an administrative mistake is worse than allowing it:
  both events stay in the log for ever, so nothing is hidden by a reinstatement.

**Static analysis.**

| tool | result |
|---|---|
| Slither 0.11.3 (solc 0.8.28, OZ 5.6.1 — the exact version the build uses) | 2 findings, both Low, both by design |
| Mythril 0.24.8 | **no issues detected** |

The two Slither findings are `missing-zero-check` on `initialIssuer` (constructor) and on
`setIssuer`. Both are **intentional**: `address(0)` is the documented way to switch issuing OFF, and
a test asserts that `issue()` then reverts. A third finding on the first run — `dead-code` for an
overridden `_baseURI()` — was **real and was removed**; `tokenURI` is overridden directly, so an
override of `_baseURI` was code nothing called.

🔑 A note on method: the first Slither re-run after that fix still reported the dead code. It was a
stale `crytic-export` cache, not a stale fix. The check also lies; clear the cache before believing
a second run.

**Tests.** 39 Hardhat + 7 Foundry properties × 10 000 runs + 8 red canaries + a 72-check end-to-end
suite against the live chain. See `TESTING.md` §5.

**Not audited externally.** As with the rest of this document: this is a self-audit, signed below.
An external audit remains scoped for any deployment beyond a testnet.

---

## 10. Web-tier hardening, 2026-10-31 (outside the contracts, inside the threat model)

* **Content-Security-Policy, enforced.** Deployed first as `Content-Security-Policy-Report-Only`,
  measured with a real Chromium over all 60 page/language combinations twice (with and without a
  connected wallet), and flipped to enforcing only after both sweeps reported **zero** violations.
  Scripts are `'self'` plus Cloudflare Turnstile — no `'unsafe-inline'`, no `'unsafe-eval'`.
  `'unsafe-inline'` is granted for STYLES only, because `react-hot-toast`,
  `react-loading-skeleton` and the wallet modal's web components inject `<style>` elements and
  support neither a nonce nor a stable hash; that was the only directive any page ever violated
  (300 × `style-src-elem`). `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`.
* **The IPFS upload endpoint is no longer public.** It had **no authentication at all** — 30 uploads
  per hour per IP, and the IP comes from `X-Forwarded-For` behind `trust proxy`, which is a header,
  not a fact. Now: a wallet signature over a canonical message that includes the sha256 of the image
  (so a captured signature cannot be replayed with a different file), checked against the on-chain
  `Whitelist`; the file type decided by its BYTES rather than the declared MIME (JPEG/PNG/WebP only —
  a scriptable SVG declared as `image/png` is refused); EXIF/XMP/IPTC stripped losslessly before
  anything is pinned, and an upload that cannot be cleaned is REFUSED; a quota per wallet as well as
  per IP. 14/14 security checks, each one an attempt a stranger can make against the live endpoint.
* **Dependencies.** 26 high/critical advisories down to 14, including the one that mattered here:
  `proxy-addr`'s IP-spoofing advisory, which is exactly the control the IPFS endpoint used to lean
  on. `express` 5.2.1→5.3.0, `nodemailer` 8→10.3.1 (CRLF injection), `react-router-dom`
  7.14.1→7.18.5 (arbitrary constructor via turbo-stream), `vite` 8.0.8→8.3.5, `wagmi`/`viem`/
  `@walletconnect/ethereum-provider` lifted, `ws` pinned to ^8.22.0 by override. The remaining 14 all
  trace to one root: `zod` 3 under `@reown/appkit`, whose fix is a major version jump inside the
  wallet-connection path. **Accepted, not fixed** — it is a client-side DoS in the visitor's own tab,
  and lifting it blind in a path that cannot be tested headlessly would be the riskier change.
* **A third-party gateway removed from the path.** NFT images were rendered through the public
  `ipfs.io` gateway while the platform pins to its own node. That both broke the gallery whenever
  ipfs.io was down (it was, from 2026-09-21) and told a third party which CIDs each visitor was
  reading. One place now decides, and it is ours.
* **Secret scanning, with a canary in both directions.** `gitleaks` (default ruleset via
  `[extend] useDefault = true`) is run over the tree before every commit; the configuration is
  [`.gitleaks.toml`](../.gitleaks.toml) at the repository root. It exists because the default rules
  classify a 40-hex EVM **contract address** as a generic API key, and a check that always cries
  wolf is a check nobody reads. The allowlist is therefore exactly one unanchored regex,
  `0x[a-fA-F0-9]{40}` — nothing else, and in particular **no `paths` entry**.

  That last detail is the finding, not a footnote. The first version of the file allowlisted the
  address *files* under `paths`, which in a top-level `[allowlist]` is an **alternative** to
  `regexes`, not an intersection — so the whole file was exempt and a planted `sk_live_…` in
  `src/contracts/addresses.json` was **not** caught. An allowlist that can do that is worse than no
  allowlist, because it reports green. The regex form matches the captured secret exactly, and a
  real credential (`sk_live_…`, a password) contains no 40-hex run, so nothing else is exempted.

  Verified on 2026-10-31 in **both** directions, which is the only way an allowlist can be trusted:

  | probe | expected | result |
  |---|---|---|
  | the tree as it stands | no leaks | no leaks |
  | planted `sk_live_…` in `src/contracts/addresses.json` | 1 leak | **leaks found: 1** |
  | planted password line in `server/index.cjs` | 1 leak | **leaks found: 1** |
  | both reverted | no leaks | no leaks |

  A green scan on a config nobody has tried to defeat is not evidence. There is no `pre-commit`
  hook — the scan is a deliberate manual step in the commit procedure, so it cannot be silently
  skipped by a `--no-verify`.
