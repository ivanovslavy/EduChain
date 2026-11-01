# EduChain — Contract Test & Audit Suite

A full, adversarial test suite for the 8 EduChain contracts (Whitelist, GameToken,
GameNFTPredefined, GameNFTCustom, TokenMarketplace, TrackingContract, ETHFaucet,
CertificateRegistry).
It closes audit finding **H1** ("zero tests on ~3.2k LOC of value-moving contracts").

Three layers, plus an optional on-chain "live-fire" layer:

| Layer | Tool | What it does |
|-------|------|--------------|
| Unit / access / attacks / invariants | Hardhat + Mocha/Chai | 119 tests over every function, guard, event, boundary — plus real attacker contracts |
| Property fuzzing + stateful invariants | Foundry (`forge`) | 10 fuzz tests × 10 000 runs, 4 invariants × 12 800 calls |
| Static analysis | Slither | 0 high-severity over the production contracts |
| Symbolic execution | Mythril | all 8 production contracts — 0 issues |
| **Live-fire (optional)** | Hardhat scripts | the same attacks as REAL transactions on gemba testnet 821207 |
| Web tier | Puppeteer + Chromium | the exam end to end, the IPFS endpoint, the CSP sweep, the network check — see §5 and §6 |

**No production contract is modified by any of this.** The attacker/mock contracts
live in `contracts/test/` and are never deployed by `scripts/deploy.js`.

---

## Prerequisites

```bash
cd blockchain
npm install                      # Hardhat + toolbox + OZ + erc721a

# Foundry (fuzz/invariant layer) — one-time:
curl -L https://foundry.paradigm.xyz | bash && foundryup
git clone --depth 1 https://github.com/foundry-rs/forge-std.git lib/forge-std

# Slither (static layer) — one-time:
pipx install slither-analyzer
```

---

## 1. Hardhat suite (unit + access + attacks + invariants)

```bash
npx hardhat test                 # all 119 tests
npx hardhat test test/08-attacks.test.js   # just the adversarial suite
npx hardhat coverage             # line/branch coverage (the H1-closing metric)
```

Files (`test/`):

| File | Covers |
|------|--------|
| `helpers/fixtures.js` | Deploys the whole ecosystem 1:1 with `scripts/deploy.js`; seeds actors: `owner`, `admin` (teacher), `alice/bob/carol` (whitelisted), `mallory` (whitelisted attacker), `outsider` (NOT whitelisted). |
| `01-whitelist.test.js` | admin/whitelist/blacklist roles, batch limits, pagination, **probe: a blacklisted admin keeps admin power**. |
| `02-gametoken.test.js` | buy flow, refunds, per-purchase + daily rate limits (24h window via time-travel), owner config, **probe: M1 uncapped `mintToContract`**. |
| `03-nftpredefined.test.js` | mint, maxSupply cap, daily limit, transfer gating, tokenURI scheme. |
| `04-nftcustom.test.js` | ETH + GAME mint paths, multi-URI mint, batch/daily caps, **probe: `withdrawTokens` strands the old paymentToken balance after a swap**. |
| `05-marketplace.test.js` | ERC721/ERC20 listing → escrow → purchase → cancel, private listings, ownership checks, daily limits. |
| `06-ethfaucet.test.js` | claim + cooldown, funding, bounds (≤1 ETH, ≤7d), withdraw, **probe: `fallback()` swallows a mistyped ETH-bearing call**. |
| `07-tracking.test.js` | points/tier/net-worth computation, pagination, tier ordering, **probe: `setPointsFormula` has no bounds**. |
| `08-attacks.test.js` | **the hacker-contract suite** — see below. |
| `09-invariants.test.js` | supply conservation, escrow-ownership, faucet drain rate, whitelist consistency. |
| `10-certificates.test.js` | **CertificateRegistry** (39 tests): construction, issue (role separation — the owner cannot issue, the issuer cannot revoke), bounds (zero holder/hash refused, score > 100 refused, 0 and 100 both accepted), one-hash-one-serial, soulbound (transfer/safeTransfer/approve/setApprovalForAll all revert, not even the contract owner can move one), revoke/reinstate with both events kept, administration (`setIssuer`, `setBaseURI`, `tokenURI`), verification (`isValid` false for unknown and revoked alike, hash → serial lookup), invariants (`validCount` == issued − revoked, `balanceOf` never decreases), and **privacy** (the whole record is a hash, two dates, a score and two small numbers; no function but `setBaseURI` takes a string; raw storage slots contain no readable text). |

### The attacker contracts (`contracts/test/`)

| Contract | Vector | Expected |
|----------|--------|----------|
| `MaliciousERC721` | lies about `ownerOf`, no-ops `transferFrom` → bait-and-switch | **CONFIRMED** (buyer pays, gets nothing) |
| `FeeOnTransferERC20` | skims a fee on transfer → escrow accounting drift | **CONFIRMED** (later listing unredeemable) |
| `ReentrantSeller` | re-enters `purchaseListing` on seller payout | DEFEATED (nonReentrant + CEI) |
| `ReentrantBuyer` | re-enters on the overpay refund | DEFEATED |
| `ReentrantClaimer` | re-enters `ETHFaucet.claim()` | DEFEATED (exactly one claim) |
| `ReentrantERC20` | re-enters `mintWithTokens` via `transferFrom` | DEFEATED (minted once) |
| `RejectingReceiver` | rejects ETH → griefs payouts/claims | fails CLOSED (reverts, no silent loss) |
| `MockERC20` / `MockERC721` | well-behaved tokens for happy-path tests | — |

`CONFIRMED` = the exploit succeeded and the test proves it (a real finding).
`DEFEATED` = the guard held and the attack reverted / could not double-spend.

---

## 2. Foundry fuzz + invariants

```bash
forge test            # all 14 (10 fuzz + 4 invariants)
forge test -vvv       # with traces
forge test --match-contract InvariantMarketplace
```

Files (`test-forge/`):

- `FuzzGameToken.t.sol` — fuzzes buy amounts/payments: in-limit buys always conserve
  supply; underpayment always reverts; a non-whitelisted address can never buy.
- `InvariantGameToken.t.sol` — random buys/withdraws/time-warps by 5 actors;
  asserts `users+owner+pool == totalSupply` and `contractETH ≤ totalSalesETH`.
- `InvariantMarketplace.t.sol` — random list/purchase/cancel of ERC721s;
  asserts every ACTIVE listing's token is really escrowed, and the marketplace
  never traps ETH between txs.
- `FuzzCertificateRegistry.t.sol` — 7 properties over the registry: only the issuer
  can issue; the issuer can never revoke; a certificate is never transferable; a
  content hash is unique for ever; the score is bounded and round-trips; an unknown
  serial is never valid; `validCount` always matches issued minus revoked.

Fuzz depth is set in `foundry.toml` (`runs = 10000`, invariant `runs=256 depth=50`).

---

## 3. Slither (static analysis)

```bash
./slither.sh          # writes slither-report.txt, production contracts only
```

Result: **0 high-severity** (no reentrancy-eth, arbitrary-send, suicidal,
delegatecall, tx-origin). The notable low items — `calls-inside-a-loop` in
`TrackingContract` leaderboard views and `block.timestamp` in the rate-limit
windows — corroborate code-review items L8/M-series. The `reentrancy-benign`/events
items (e.g. `TokenMarketplace.createERC721Listing`) write state after the escrow
transfer but are guarded by `nonReentrant` + CEI and move no attacker value.

## 3b. Mythril (symbolic execution)

```bash
# myth-solc.json carries the OZ/erc721a remappings + optimizer
for C in Whitelist GameToken GameNFTPredefined GameNFTCustom TokenMarketplace TrackingContract ETHFaucet CertificateRegistry; do
  myth analyze contracts/$C.sol --solc-json myth-solc.json --solv 0.8.28 --execution-timeout 200
done
```
All 8 production contracts return "No issues were detected."

---

## 4. Live-fire — real on-chain attacks (optional, gemba testnet 821207)


> **2026-10-31 — the Foundry layer was not runnable.** `lib/forge-std` was absent from the server, so
> every `forge test` failed to compile and the documented fuzz/invariant layer had not run for some
> time. Fixed with `forge install foundry-rs/forge-std --no-git`; `lib/` stays gitignored, as Foundry
> intends. `forge` itself is at `/home/slavy/.foundry/bin/forge` and is not on the default PATH —
> prefix it, or the command looks like it is missing.


Runs the same scenarios as **real broadcast transactions** against a **fresh**
deployment. It deploys its own instances and does NOT touch the production EduChain
contracts. See `scripts/live-fire/README.md`. Order:

```bash
npx hardhat run scripts/live-fire/snapshot-before.js  --network gemba   # read-only proof
npx hardhat run scripts/live-fire/deploy-fresh.js     --network gemba   # fresh 7 + helpers
npx hardhat run scripts/live-fire/fund-and-attack.js  --network gemba   # actors + attacks
```

`fund-and-attack.js` generates fresh actor wallets, provisions them from one
intermediate distributor, whitelists them on-chain, and runs every scenario,
printing `DEFEATED` / `CONFIRMED` and writing `attack-results.json`.

Config is via environment variables (never committed): the gemba RPC URL and the
funding wallet used to provision the distributor once.

---

## Findings surfaced by this suite — and how each was FIXED

| # | Sev | Finding | Fix (all applied) |
|---|-----|---------|-------------------|
| A1 | 🔴 | **Bait-and-switch**: marketplace paid for a fake ERC721 that never escrowed | post-escrow `ownerOf == address(this)` assert on list + delivery assert on purchase |
| A2 | 🔴 | **Fee-on-transfer drain**: recorded requested, not received amount | record `balanceAfter − balanceBefore`; per-token `_escrowedERC20` accounting |
| A3 | 🟠 | **Stuck NFT**: `onERC721Received` accepted any transfer, no rescue | reject unsolicited safe-transfers + owner `rescueERC721/rescueERC20` (escrow-guarded) |
| A4 | 🟠 | **Blacklisted admin keeps power** | `onlyOwnerOrAdmin` now rejects a blacklisted admin |
| A5 | 🟠 | **Stranded paymentToken** in `GameNFTCustom` | added `sweepToken(address)` (distinct name, not an overload → clean ABI/UI) |
| A6 | 🟢 | `ETHFaucet.fallback()` swallowed mistyped ETH | removed `fallback()` → such calls now revert |
| A7 | 🟢 | `TrackingContract.setPointsFormula` unbounded | `MAX_POINTS_WEIGHT` bound on each weight |
| M1 | 🟢 | `GameToken.mintToContract` uncapped | `MAX_SUPPLY` cap (100M) |
| L8 | 🟢 | Leaderboard view gas (`calls-in-loop`) | `MAX_BATCH_VIEW` 500 → 100 |

**Status: all fixed and verified** — 119 Hardhat + 14 Foundry green, and the live-fire
run reports every scenario DEFEATED on gemba testnet after redeploy. Each fix
preserves existing behaviour (happy-path + invariant suites unchanged and passing).

---

## 5. Certificates (added 2026-10-31)

The certificate feature spans a contract, a server module, a PDF, an e-mail and a public page, so it
has its own layers. Everything below ran against the LIVE database and the LIVE testnet — the only
part ever replaced by a double is the SMTP connection, because a test must not send mail to a real
person.

| layer | what it checks | command | result |
|---|---|---|---|
| Hardhat | 39 unit / access / soulbound / invariant / privacy tests | `npx hardhat test test/10-certificates.test.js` | **39/39** |
| Foundry | 7 properties × 10 000 random runs (only-issuer, score bounds, hash uniqueness, soulbound against any caller, validCount, unknown serials, issuer-cannot-revoke) | `forge test --match-path test-forge/FuzzCertificateRegistry.t.sol` | **7/7** |
| Slither | static analysis of `CertificateRegistry.sol` | `slither contracts/CertificateRegistry.sol --solc-remaps …` | 2 Low, both by design |
| Mythril | symbolic execution | `myth analyze contracts/CertificateRegistry.sol --solc-json myth-solc.json --solv 0.8.28` | **0 issues** |
| E2E | the whole journey: form → code → 20 questions → 80 % → on-chain issue → PDF → e-mail → `/verify` → revoke → reinstate → **re-revoke** → retention | `certificates-e2e.js` (laptop) | **73/73** |
| Canaries | 8 guards broken one at a time on a COPY outside the live tree | `certificates-canaries.js` | **8/8 red** |
| Browser | the gate, the nav, the public verification page in bg/en/es, plus the exam UI with an injected wallet | `certificates-browser.js` | **40/40** |
| Mail | the real SMTP path with a real PDF, to a test address, read back over IMAP | `certificates-mail-live.js` | **6/6** |

### What the tests are really defending

**The correct answers never leave the server.** The E2E suite asserts the exact key set of every
question payload (`index,level,options,text,topic,total` — nothing else), that an answer's reply says
nothing about right or wrong, and that a FAILED attempt returns no answer key. The browser test
scans every `/api/certificates/*` response the page received during a full 20-question exam for
`"correct"` and `"why"`. The build is grepped for the question text and for the bank's filenames.

**The exam cannot be gamed.** No going back, no changing an answer, no answering out of order, no
resubmitting, three attempts a day per e-mail AND per wallet, and a sitting that expires. Each of
those has a canary.

**A compromised server cannot rewrite history.** The hot issuer key may only `issue()`; revocation
needs the cold owner key, which is not on the server. The canary that removes the owner check on the
revocation-note endpoint goes red.

**No personal data on-chain.** A test reads the contract's raw storage slots looking for readable
text, and asserts that the only function taking a string is `setBaseURI`.

### The question bank

65 questions × 3 languages, in `server/certificates/questions/` — **server-side only, and excluded
from git by name.** The certificate is worth something only while the answer key is not public. A
test asserts the three banks have identical ids, topics, levels and correct answers, so a translation
cannot move the answer, and that the EN/ES banks honour the house terminology rule (no "crypto*").

---

> **Counts corrected 2026-11-01.** The E2E is 72 → **73**: it now re-revokes the certificate it
> issued instead of leaving it reinstated, and asserts that it did. The browser suite is 37 → **40**,
> and the old 37/37 was stale rather than passing: it hardcoded `EDU-2026-000001` and asserted that
> serial renders as "Valid certificate" with the test holder's name, so when those four test
> certificates were revoked and de-personalised on 2026-10-31 the suite silently dropped to 31/37.
> It now reads the serial's real state from the verify API and asserts the page agrees with it,
> covering both the valid and the revoked rendering without requiring a publicly valid TEST
> certificate to exist — a requirement that was in direct conflict with leaving no test data live.

## 6. The network check and the backup (added 2026-11-01)

Two guards that existed only on paper until today, each now with a test that goes red when the
bug is put back.

### 6a. The wrong-network check — `network-check-e2e.js`

`Web3Context` used `useChainId()` to decide "are we on the right network". That value is
`config.state.chainId`, which createConfig pins to `chains[0]`, so with one supported chain it
could never disagree with `DEFAULT_CHAIN.id`: `correctChain` was a constant `true` and twelve
downstream guards were dead code. The detector is now `useAccount().chain`, where `undefined`
means an unsupported network.

| # | property | result |
|---|---|---|
| 1 | wallet on 821207 → no banner, never flashed, `/certificates` nav link present, chain gate passed | 5/5 |
| 2 | wallet on chain 1 with the switch REJECTED → banner shown, naming `1 → 821207`; gated page shows the wrong-network notice; no enabled transaction button; member nav withdrawn | 5/5 |
| 3 | wallet on chain 1 with the switch ACCEPTED → the banner **never** appears, not even for a frame (MutationObserver + 50 ms poll from first paint) | 3/3 |
| 4 | `chainChanged` back to 821207 → banner clears, gated page recovers, **no page reload** (a `window` sentinel set at first paint is still present) | 3/3 |

**16/16** against the live build. Canary: `canary-c-usechainid.sh` puts `useChainId()` back in that
one line, builds it to `dist-canary` (asserting the live `dist/index.html` sha256 is unchanged),
serves it on `127.0.0.1:3099` and re-runs the suite — **12/16, 4 red**: `2a` banner shown, `2b`
banner contents, `2c` gated-page notice, `2e` member-nav withdrawal. With the bug back the chain
events list is empty too, i.e. the auto-switch is never attempted.

Harness note: the injected `eth_chainId` in `browser-check.js`, `certificates-browser.js` and
`certificates-browser-full.js` was `0xc8757` = **821079** — transposed digits — so every
`EDU_WALLET=1` run was a wrong-network run that passed only because the old detector could not
notice. Corrected to `0xc87d7`, and the seeded `wagmi.store` bumped from `version: 2` to `3`
(@wagmi/core is 3.x and derives the store version from the major, so a v2 blob was being migrated
away and the seeded connection silently dropped).

The new harness also replaces the no-op `on: () => {}` of the older scripts with a real EIP-1193
event registry, which is what makes property 4 testable at all: without it wagmi subscribes to a
`chainChanged` that can never fire.

### 6b. The certificate-database backup — restore and failure path

`/usr/local/bin/educhain-backup.sh`, 04:50 UTC daily. Documented in
[`../docs/backup.md`](../docs/backup.md). Tested with the three scripts in
`EduChain-scripts/restore-test/` on the laptop; nothing is left on the server.

| # | probe | expected | result |
|---|---|---|---|
| 1 | a writer holds the db open, a certificate is committed, the WAL is not checkpointed, and only the main file is copied — what `cp`, `rsync` or `tar` would capture | the record is missing | `certificates = 0` — **lost** |
| 2 | the same database through the real job (paths redirected, everything else byte-identical — the diff is shown), decrypted on the laptop with the private key | the record survives | `integrity_check ok`, serial 20269001 → full_name / position / organisation / issued_date / score_pct all present |
| 3 | pre-existing production rows | carried through | 5 revocations, `meta.email_salt` present |
| 4 | archive transferred to the laptop | sha256 matches the manifest | matches |
| 5 | the server decrypting its own backup | refused | `no identity matched any of the recipients`, exit 1 |
| 6 | recipient key missing | FAIL in the operator log, mail to `alerts@`, non-zero exit, nothing written | `FAIL public key … missing`, exit **1**, SMTP `250 2.0.0 OK`, output dir never created |
| 7 | the key restored | a real run is green again | `OK … (off-site verified)`, exit 0 |

Probe 1 is the reason the job uses `VACUUM INTO` rather than a file copy, and it is the half that
is easy to get wrong: `sqlite3_close()` checkpoints the WAL on the **last** connection closing
regardless of `wal_autocheckpoint`, so a test that closes its writer before copying will "prove"
that a byte-wise copy is safe. The writer has to stay open, which is also the state the live file
is permanently in, because `educhain-api` holds it.
