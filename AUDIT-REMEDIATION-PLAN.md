# EduChain — Remediation Plan for the Adversarial-Suite Findings

> **chmod 600, kept OUTSIDE the public git tree.** `/educhain` tracks only
> `blockchain/` to GitHub (public); this file lives at `/educhain/` root so it can
> never be committed. It names exploitable-but-unfixed issues in the LIVE contracts.
>
> Source: the test/contract-suite adversarial run (2026-08-02), confirmed both
> locally (80 Hardhat + 7 Foundry) and on-chain (gemba testnet 821207 live-fire).
> Contracts are **immutable** (no proxy) → every fix requires a redeploy.
> Nothing here is applied yet — this is the plan.

## Findings recap (confirmed exploits + probes)

| # | Sev | Contract | Finding | Proven |
|---|-----|----------|---------|--------|
| A1 | 🔴 | TokenMarketplace | Bait-and-switch: pays seller for a fake ERC721 that never escrows | local + on-chain |
| A2 | 🔴 | TokenMarketplace | Fee-on-transfer: records requested amount, not received → later listing unredeemable | local + on-chain |
| A3 | 🟠 | TokenMarketplace | Stuck asset: `onERC721Received` accepts any direct transfer, no rescue | local + on-chain |
| A4 | 🟠 | Whitelist | A blacklisted admin keeps admin power | local |
| A5 | 🟠 | GameNFTCustom | `withdrawTokens` only drains the CURRENT paymentToken → swap strands the old balance | local |
| A6 | 🟢 | ETHFaucet | `fallback()` swallows mistyped ETH-bearing calls as donations | local + on-chain-capable |
| A7 | 🟢 | TrackingContract | `setPointsFormula` unbounded → overflow risk on read | local |
| M1 | 🟢 | GameToken | `mintToContract` has no supply cap (from the original code review) | local |
| L8 | 🟢 | TrackingContract | Leaderboard `calls-inside-a-loop` → view gas-DoS at scale (Slither) | static |

---

## The fixes

### A1 — Bait-and-switch (TokenMarketplace) 🔴

**Root cause:** `createERC721Listing` (line ~203) trusts a caller-supplied token
contract: `ownerOf` can lie and `transferFrom` can be a no-op, so nothing actually
enters escrow; `purchaseListing` then pays the seller before "delivering" the
(non-existent) asset.

**Fix (defence in depth):**
1. **Post-escrow ownership assert** at listing time — after `nft.transferFrom(seller, address(this), tokenId)`, require `nft.ownerOf(tokenId) == address(this)`. A no-op transfer fails this check → the malicious listing reverts. (One `require`; defeats any fake/lying NFT.)
2. **Delivery assert** at purchase time — after delivering an ERC721 to the buyer, require `nft.ownerOf(tokenId) == buyer` (and for ERC20 check a balance delta). Belt-and-suspenders.
3. **(Closed-ecosystem option, strongest):** a token **allowlist** — only `GameNFTPredefined`, `GameNFTCustom`, `GameToken` may be listed. EduChain is a closed educational marketplace, so an allowlist is arguably the correct model and also neutralises A2. Add `mapping(address=>bool) allowedToken` + owner setter; check in both `create*Listing`.

**Recommendation:** ship **1 + 2** unconditionally (defends any token), and add the
**allowlist (3)** as the primary control for the closed ecosystem.

**Regression test:** `test/08-attacks.test.js` bait-and-switch case flips from
CONFIRMED → the listing/purchase must now **revert** (add
`.to.be.revertedWith...`). Live-fire scenario 2 must report **DEFEATED**.

### A2 — Fee-on-transfer escrow drain (TokenMarketplace) 🔴

**Root cause:** `createERC20Listing` (line ~257) stores the *requested* `amount`,
but a fee-on-transfer token delivers less into escrow; all listings for one token
share a pooled balance, so a later listing becomes unredeemable.

**Fix:** measure the **actual received amount**:
```solidity
uint256 balBefore = token.balanceOf(address(this));
token.safeTransferFrom(msg.sender, address(this), amount);
uint256 received = token.balanceOf(address(this)) - balBefore;
// store `received` as listing.amount (revert if received == 0)
```
This makes payouts exact for any token. The **allowlist (A1.3)** is an alternative
that also fixes this (standard tokens only). Ship the received-amount measurement
regardless; add the allowlist for the closed model.

**Regression test:** the fee-on-transfer case flips CONFIRMED → the second listing
is now redeemable (buyer receives exactly the escrowed amount). Live-fire scenario 6
→ DEFEATED.

### A3 — Stuck asset via `onERC721Received` (TokenMarketplace) 🟠

**Root cause:** `onERC721Received` (line ~625) returns the selector unconditionally;
an NFT `safeTransfer`'d directly (outside a listing) is accepted with no way out.

**Fix (two parts):**
1. **Reject unsolicited transfers** — set a transient flag during
   `createERC721Listing` and have `onERC721Received` return the selector only when
   that flag is set (revert otherwise). Prevents accidental locks entirely.
2. **Owner rescue** — `rescueERC721(token,id,to)` / `rescueERC20(token,amt,to)`,
   owner-only, that refuses to move any asset tied to an **active listing** (guard
   against draining escrow). Recovers anything that still gets stuck.

**Regression test:** direct `safeTransferFrom` into the marketplace now reverts;
rescue recovers a pre-existing stuck asset. Live-fire scenario 7 → DEFEATED.

### A4 — Blacklisted admin retains power (Whitelist) 🟠

**Root cause:** `onlyOwnerOrAdmin` (line ~109) checks `_admins.contains` only.

**Fix:** treat a blacklisted admin as unauthorised:
```solidity
modifier onlyOwnerOrAdmin() {
    if (msg.sender != owner() &&
        !(_admins.contains(msg.sender) && !_blacklisted.contains(msg.sender)))
        revert NotAuthorized();
    _;
}
```
(Or auto-remove the admin role inside `addToBlacklist`.) **Deployment note below —
this one has heavy coupling.**

### A5 — Stranded paymentToken (GameNFTCustom) 🟠

**Root cause:** `withdrawTokens()` (line ~589) drains only the *current* `paymentToken`.

**Fix:** parameterise it — `withdrawTokens(address token)` (owner-only) that
withdraws that token's full balance; keep the no-arg variant as a convenience for
the current token. Recovers any previously-collected token after a swap.

### A6 — `fallback()` swallows ETH (ETHFaucet) 🟢

**Fix:** drop `fallback()` (keep `receive()` + `fundFaucet()`), or make `fallback()`
`revert` on non-empty calldata so mistyped calls fail loudly.

### A7 — Unbounded `setPointsFormula` (TrackingContract) 🟢

**Fix:** cap each weight (e.g. `require(w <= 1e6)`) so `balance * weight` cannot
overflow on a read.

### M1 — Uncapped `mintToContract` (GameToken) 🟢

**Fix:** add a `MAX_SUPPLY` constant and `require(totalSupply()+amount <= MAX_SUPPLY)`,
or document the unlimited-mint intent explicitly.

### L8 — Leaderboard view gas (TrackingContract) 🟢

**Fix:** lower `MAX_BATCH_VIEW`, and/or move full-leaderboard aggregation off-chain
(the frontend already has a read-only provider). No fund risk; scale concern only.

---

## Deployment strategy (immutable contracts)

Every contract stores its dependencies as **`immutable`** constructor refs
(GameToken/NFTs/Marketplace/Faucet/Tracking → Whitelist; Tracking → both NFTs +
GameToken). So a change to a *depended-upon* contract forces redeploying its
dependents:

- **Marketplace-only fixes (A1, A2, A3)** — Marketplace is a leaf (nothing depends
  on it). Redeploy **just the fixed Marketplace** pointing at the **existing**
  Whitelist; update `src/contracts/addresses.json`. No graph-wide migration.
  Existing active listings (few, testnet) should be cancelled first.
- **A5 (GameNFTCustom)** — Tracking holds an immutable ref to it → redeploying the
  NFT forces redeploying Tracking too, and re-wiring `setPaymentToken`.
- **A4 (Whitelist)** — **everything** refs the Whitelist immutably → fixing it in
  place means a **full-graph redeploy** + re-seeding whitelist membership.

**Recommendation:** since it's testnet and pre-launch, **batch ALL fixes and do one
clean full redeploy** (a "regenesis" like 2026-06-26), rather than piecemeal:
1. Apply all code fixes on a `fix/marketplace-hardening` branch.
2. Add/flip regression tests → the CONFIRMED cases must become DEFEATED; run the
   full Hardhat + Foundry suite green + Slither clean.
3. Redeploy the whole ecosystem to gemba testnet via `scripts/deploy.js`.
4. **Re-seed the Whitelist** (re-add current members — export via
   `getEverWhitelistedPaginated` from the old Whitelist first).
5. Update `src/contracts/addresses.json` + `deployed/latest.json`; rebuild frontend.
6. **Re-run live-fire** — all 8 scenarios must now report DEFEATED.
7. Verify all 7 on gembascan.

If a full redeploy is undesirable, the **minimum viable** path is: redeploy only the
**Marketplace** (fixes the two 🔴 + A3, the only fund-loss issues, all in one leaf
contract) and defer A4/A5/A7 to the next regenesis.

## Priority order

1. **A1 + A2** (🔴 fund loss, both Marketplace) — do first; Marketplace-only redeploy.
2. **A3** (🟠, same Marketplace redeploy — free to include).
3. **A4, A5** (🟠) — fold into the next full regenesis.
4. **A6, A7, M1, L8** (🟢) — opportunistic, same regenesis.

*No contract is modified until you approve this plan. All findings remain recorded
only.*
