# EduChain — Contract Test & Audit Suite

A full, adversarial test suite for the 7 EduChain contracts (Whitelist, GameToken,
GameNFTPredefined, GameNFTCustom, TokenMarketplace, TrackingContract, ETHFaucet).
It closes audit finding **H1** ("zero tests on ~3.2k LOC of value-moving contracts").

Three layers, plus an optional on-chain "live-fire" layer:

| Layer | Tool | What it does |
|-------|------|--------------|
| Unit / access / attacks / invariants | Hardhat + Mocha/Chai | 80 tests over every function, guard, event, boundary — plus real attacker contracts |
| Property fuzzing + stateful invariants | Foundry (`forge`) | 3 fuzz tests × 10 000 runs, 4 invariants × 12 800 calls |
| Static analysis | Slither | detector sweep over the production contracts |
| **Live-fire (optional)** | Hardhat scripts | the same attacks as REAL transactions on gemba testnet 821207 |

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
npx hardhat test                 # all 80 tests
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
forge test            # all 7
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

Fuzz depth is set in `foundry.toml` (`runs = 10000`, invariant `runs=256 depth=50`).

---

## 3. Slither (static analysis)

```bash
./slither.sh          # writes slither-report.txt, production contracts only
```

Baseline result: **65 informational/low findings, 0 high-severity** (no
reentrancy-eth, arbitrary-send, suicidal, delegatecall, tx-origin). The notable
low items — `calls-inside-a-loop` in `TrackingContract` leaderboard views and
`block.timestamp` in the rate-limit windows — corroborate code-review items L8/M-series.

---

## 4. Live-fire — real on-chain attacks (optional, gemba testnet 821207)

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

## Findings surfaced by this suite (beyond the original code review)

| # | Severity | Finding |
|---|----------|---------|
| A1 | 🔴 | **Bait-and-switch**: marketplace pays a seller for a fake ERC721 that never enters escrow; buyer gets nothing. Contradicts the contract's "bait-and-switch is impossible" claim. |
| A2 | 🔴 | **Fee-on-transfer drain**: `createERC20Listing` records the requested amount, not the amount received; shared escrow pool leaves a later listing unredeemable. |
| A3 | 🟠 | **Stuck NFT**: `onERC721Received` accepts any direct transfer with no rescue path → asset locked forever. |
| A4 | 🟠 | **Blacklisted admin keeps power**: `onlyOwnerOrAdmin` ignores the blacklist. |
| A5 | 🟠 | **Stranded paymentToken**: `GameNFTCustom.withdrawTokens` only drains the current token; a swap locks the prior balance. |
| A6 | 🟢 | `ETHFaucet.fallback()` swallows mistyped ETH-bearing calls as donations. |
| A7 | 🟢 | `TrackingContract.setPointsFormula` has no bounds (overflow risk on read). |
| — | — | plus the original code review's H1 (now closed), M1 (uncapped mint, reproduced). |

All findings are **recorded only** — no contract was modified. Remediation is a
separate, authorized step.
