#!/usr/bin/env bash
# EduChain — bring the whole deployment back from nothing (т.3, 2026-10-31).
#
#   scp this to the server, then:   sudo -u slavy -H bash redeploy-all.sh [--dry-run]
#   or from the laptop:             ssh -i ~/.ssh/gemba_claude "$EDU_HOST" \
#                                     'sudo -u slavy -H bash -s' < redeploy-all.sh
#
# ──────────────────────────────────────────────────────────────────────────────────────────────────
# WHY THIS EXISTS
#
# EduChain lives entirely on a testnet that GEMBA itself runs, and that chain has been restarted
# before. A restart wipes every contract: the addresses in deployed/latest.json and in the frontend
# suddenly point at accounts with no code, every page that reads the chain shows zeros, and bringing
# it back used to be an afternoon of remembering which script to run in which order. That made a
# chain restart a project. This script makes it a 15-minute procedure.
#
# IDEMPOTENT by design. Every step checks the chain first and skips itself when the chain already
# agrees. Running it twice changes nothing; running it after a partial failure continues from where
# it stopped. That is what makes it safe to run when you are not sure what state you are in.
#
# WHAT IT DOES NOT DO: it never touches mainnet (it refuses any chain id but 821207), it never
# creates or prints a private key, and it does not restart Apache or change a vhost.
set -euo pipefail

ROOT=/educhain
BC=$ROOT/blockchain
CHAIN_ID=821207
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY=1

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
fail() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }
run()  { if [ -n "$DRY" ]; then info "[dry-run] $*"; else eval "$@"; fi; }

cd "$BC"

# ── 0. preconditions, checked before anything is spent ──────────────────────────────────────────
say "0 · preconditions"
[ -f "$BC/.env" ] || fail "blockchain/.env is missing (USER1_PRIVATE_KEY, GEMBA_RPC_URL)"
grep -q '^USER1_PRIVATE_KEY=' "$BC/.env" || fail "USER1_PRIVATE_KEY is not in blockchain/.env"
command -v npx >/dev/null || fail "npx is not on PATH"

# The chain must be the one we think it is, and it must answer. Nothing below runs otherwise.
ONCHAIN=$(node -e '
const { ethers } = require("ethers");
require("dotenv").config();
(async () => {
  const url = process.env.GEMBA_RPC_URL || "https://rpc1.gembascan.io";
  const p = new ethers.JsonRpcProvider(url, undefined, { staticNetwork: false });
  const n = await p.getNetwork();
  const w = new ethers.Wallet(process.env.USER1_PRIVATE_KEY, p);
  const bal = await p.getBalance(w.address);
  console.log(JSON.stringify({ chainId: Number(n.chainId), block: await p.getBlockNumber(), deployer: w.address, balance: ethers.formatEther(bal) }));
})().catch((e) => { console.error(e.message); process.exit(1); });
') || fail "the RPC endpoint did not answer"
info "chain: $ONCHAIN"
echo "$ONCHAIN" | grep -q "\"chainId\":$CHAIN_ID" || fail "refusing to run: the RPC is not GembaBlockchain testnet $CHAIN_ID"

# ── 1. compile ──────────────────────────────────────────────────────────────────────────────────
say "1 · compile"
run "npx hardhat compile"

# ── 2. the tests, before anything is deployed ──────────────────────────────────────────────────
say "2 · tests (the deploy does not start on a red suite)"
if [ -n "$DRY" ]; then info "[dry-run] npx hardhat test"; else
  npx hardhat test >/tmp/edu-redeploy-tests.log 2>&1 || { tail -30 /tmp/edu-redeploy-tests.log; rm -f /tmp/edu-redeploy-tests.log; fail "the Hardhat suite is red"; }
  grep -E "passing" /tmp/edu-redeploy-tests.log | tail -1 | sed 's/^/   /'
  rm -f /tmp/edu-redeploy-tests.log
fi

# ── 3. are the seven core contracts alive? ──────────────────────────────────────────────────────
say "3 · the seven core contracts"
ALIVE=$(node -e '
const fs = require("fs");
const { ethers } = require("ethers");
require("dotenv").config();
(async () => {
  const d = JSON.parse(fs.readFileSync("deployed/latest.json", "utf8"));
  const p = new ethers.JsonRpcProvider(process.env.GEMBA_RPC_URL || "https://rpc1.gembascan.io", 821207, { staticNetwork: true });
  const core = ["Whitelist","GameToken","GameNFTPredefined","GameNFTCustom","TokenMarketplace","TrackingContract","ETHFaucet"];
  const dead = [];
  for (const k of core) {
    const a = d.contracts?.[k]?.address;
    if (!a || (await p.getCode(a)) === "0x") dead.push(k);
  }
  console.log(dead.length ? "DEAD:" + dead.join(",") : "ALIVE");
})().catch((e) => { console.error(e.message); process.exit(1); });
')
if [ "$ALIVE" = "ALIVE" ]; then
  info "all seven have code on-chain — skipping the core deploy"
else
  info "$ALIVE"
  say "3a · deploying the core (deploy.js writes deployed/latest.json and verifies on GembaScan)"
  run "npx hardhat run scripts/deploy.js --network gemba"
  say "3b · the NFT base URIs (the real Kotkata collection, not the placeholders)"
  run "npx hardhat run scripts/set-baseuri.js --network gemba"
fi

# ── 4. the certificate registry (idempotent on its own) ────────────────────────────────────────
say "4 · CertificateRegistry + the issuer key"
run "npx hardhat run scripts/deploy-certificates.js --network gemba"

# ── 5. faucet liquidity ─────────────────────────────────────────────────────────────────────────
say "5 · faucet liquidity"
FAUCET=$(node -e '
const fs = require("fs");
const { ethers } = require("ethers");
require("dotenv").config();
(async () => {
  const d = JSON.parse(fs.readFileSync("deployed/latest.json", "utf8"));
  const a = d.contracts.ETHFaucet.address;
  const p = new ethers.JsonRpcProvider(process.env.GEMBA_RPC_URL || "https://rpc1.gembascan.io", 821207, { staticNetwork: true });
  console.log(ethers.formatEther(await p.getBalance(a)));
})().catch(() => { console.log("0"); });
')
info "faucet balance: $FAUCET GMB"
# 100 GMB is 2000 claims at 0.05 — plenty for a classroom, trivial to lose.
if [ "$(printf '%.0f' "$FAUCET")" -lt 10 ]; then
  info "below 10 GMB — topping up"
  run "npx hardhat run scripts/migrate-faucet.js --network gemba"
else
  info "above the floor — nothing to do"
fi

# ── 6. the frontend's copy of the addresses, and a build ───────────────────────────────────────
say "6 · frontend addresses + build"
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync("deployed/latest.json", "utf8"));
const map = {
  whitelist: "Whitelist", gameToken: "GameToken", gameNFTPredefined: "GameNFTPredefined",
  gameNFTCustom: "GameNFTCustom", marketplace: "TokenMarketplace",
  trackingContract: "TrackingContract", ethFaucet: "ETHFaucet",
  certificateRegistry: "CertificateRegistry",
};
const p = "../src/contracts/addresses.json";
const cur = JSON.parse(fs.readFileSync(p, "utf8"));
let changed = 0;
for (const [k, name] of Object.entries(map)) {
  const a = d.contracts?.[name]?.address;
  if (a && cur[k] !== a) { cur[k] = a; changed++; }
}
if (changed) { fs.writeFileSync(p, JSON.stringify(cur, null, 2) + "\n"); console.log(`   ${changed} address(es) updated in src/contracts/addresses.json`); }
else console.log("   the frontend already has the right addresses");
'
if [ -n "$DRY" ]; then info "[dry-run] npm run build (in $ROOT)"; else
  ( cd "$ROOT" && npm run build >/tmp/edu-redeploy-build.log 2>&1 ) \
    || { tail -20 /tmp/edu-redeploy-build.log; rm -f /tmp/edu-redeploy-build.log; fail "the frontend build is red"; }
  CSS=$(stat -c %s "$ROOT"/dist/assets/index-*.css 2>/dev/null | head -1)
  info "build ok · CSS ${CSS} bytes"
  # The documented healthy-CSS signal: under ~15 kB means Tailwind's @source lines were lost.
  [ "${CSS:-0}" -gt 20000 ] || fail "the CSS is only ${CSS} bytes — the @source directives in src/index.css are missing"
  rm -f /tmp/edu-redeploy-build.log
fi

# ── 7. the services ─────────────────────────────────────────────────────────────────────────────
say "7 · services"
info "the two restarts need root; run them yourself or via the claude account:"
info "  sudo systemctl restart educhain educhain-api"
if [ -z "$DRY" ] && sudo -n true 2>/dev/null; then
  run "sudo systemctl restart educhain educhain-api"
  sleep 3
  systemctl is-active educhain educhain-api | sed 's/^/   /'
fi

# ── 8. prove it, from outside ───────────────────────────────────────────────────────────────────
say "8 · proof"
for u in https://educhain.gembait.com/bg https://educhain.gembait.com/bg/certificates \
         https://educhain.gembait.com/api/health https://educhain.gembait.com/api/certificates/health; do
  printf '   %-56s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' "$u")"
done
node -e '
const fs = require("fs");
const { ethers } = require("ethers");
require("dotenv").config();
(async () => {
  const d = JSON.parse(fs.readFileSync("deployed/latest.json", "utf8"));
  const p = new ethers.JsonRpcProvider(process.env.GEMBA_RPC_URL || "https://rpc1.gembascan.io", 821207, { staticNetwork: true });
  for (const [name, c] of Object.entries(d.contracts)) {
    const code = await p.getCode(c.address);
    console.log(`   ${code === "0x" ? "DEAD " : "ok   "} ${name.padEnd(20)} ${c.address}`);
  }
})();
'
say "done"
info "if the chain was restarted, remember: the three events deployed before the restart are gone"
info "for good — nothing can bring an old address back. The whitelist has to be re-populated too."
