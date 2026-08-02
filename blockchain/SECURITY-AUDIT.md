# EduChain — Security Self-Audit

**Project:** EduChain — on-chain educational game economy (tokens, NFTs, marketplace,
faucet, whitelist, progress tracking)
**Scope:** the 7 production Solidity contracts in [`contracts/`](contracts/)
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
| Hardhat unit / access / attack / invariant tests | **80 / 80 pass** |
| Foundry property fuzzing | **3 fuzz × 10 000 runs — pass** |
| Foundry stateful invariants | **4 invariants × 12 800 calls — pass** |
| Slither static analysis | **0 high (reentrancy-eth = 0)** |
| Mythril symbolic execution | **7 / 7 contracts — 0 issues** |
| Gemba testnet live-fire (fixed bytecode) | **every attack DEFEATED** |

The full test sources are committed to this repository and reproducible with the
commands in [`TESTING.md`](TESTING.md).

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

Solidity `0.8.28`, optimizer runs 200. Attacker/mock contracts live in
[`contracts/test/`](contracts/test/) and are **never** deployed by `scripts/deploy.js`.

## 3. Methodology — what & how it was tested

| # | Layer | Tooling | Files |
|---|-------|---------|-------|
| 1 | Unit, access-control, events, boundaries, real attacker contracts | Hardhat + Mocha/Chai | [`test/`](test/) (`01`–`09`) |
| 2 | Property fuzzing | Foundry `forge` | [`test-forge/FuzzGameToken.t.sol`](test-forge/FuzzGameToken.t.sol) |
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

- **Mythril** — symbolic execution over all 7 production contracts: **0 issues**.
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

All seven were redeployed on the fixed code and verified on gembascan. The live-fire
harness ([`scripts/live-fire/`](scripts/live-fire/)) reproduces the attacks against a
disposable fresh deploy so production is never touched.

## 7. How to reproduce

Everything is in this repository. See [`TESTING.md`](TESTING.md) for full detail:
```bash
cd blockchain
npm install
git clone --depth 1 https://github.com/foundry-rs/forge-std.git lib/forge-std
npx hardhat test                     # 80 unit/access/attack/invariant tests
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
