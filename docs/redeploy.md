# Bringing EduChain back after a chain restart

> Added 2026-10-31 (plan item т.3). Before this, a restart of GembaBlockchain testnet meant an
> afternoon of remembering which script to run in which order. It is now a fifteen-minute
> procedure, and the script that does it is safe to run when you are not sure what state you
> are in.

## What a chain restart actually does

EduChain lives entirely on a testnet that GEMBA itself runs, and that chain has been restarted
before. A restart wipes every contract: the addresses in `blockchain/deployed/latest.json` and in
`src/contracts/addresses.json` suddenly point at accounts with **no code**, and every page that
reads the chain shows zeros. Nothing is corrupted — the addresses are simply empty.

What cannot be brought back:

* the old addresses (a CREATE/CREATE2 address depends on the deployer's nonce; a fresh chain starts
  from zero and the same address will not reappear);
* the whitelist (it has to be re-populated);
* tokens, NFTs and leaderboard history;
* **certificates already issued** — the serials, the hashes and the soulbound tokens are gone with
  the chain. The readable records stay in our database, but `/verify` will say the chain does not
  know the serial. If that ever happens, the certificates must be re-issued onto the new registry
  from the database; there is no script for that yet, and it needs the owner's decision because
  re-issuing changes the serial numbers.

## The procedure

The script exists in two places: the laptop copy in `~/Documents/Claude/EduChain-scripts/redeploy-all.sh`,
and a copy on the server at `/educhain/blockchain/scripts/redeploy-all.sh`. Either can be used.

> The origin is reachable only through Cloudflare, so its address is not published here.
> Set `EDU_HOST` to the `claude@<origin>` login before running these — the value is in the
> operator notes (`CLAUDE.md`, which is not published), not in this repository.

```bash
# from the laptop, piping the laptop copy in
ssh -i ~/.ssh/gemba_claude "$EDU_HOST" 'sudo -u slavy -H bash -s' \
  < ~/Documents/Claude/EduChain-scripts/redeploy-all.sh

# or, to see what it WOULD do without doing it
ssh -i ~/.ssh/gemba_claude "$EDU_HOST" 'sudo -u slavy -H bash -s -- --dry-run' \
  < ~/Documents/Claude/EduChain-scripts/redeploy-all.sh

# or run the copy that already sits on the server
ssh -i ~/.ssh/gemba_claude "$EDU_HOST" \
  'sudo -u slavy -H /educhain/blockchain/scripts/redeploy-all.sh'          # add --dry-run to rehearse
```

The script is **idempotent**. Every step checks the chain first and skips itself when the chain
already agrees, so running it twice changes nothing and running it after a partial failure continues
from where it stopped. That is what makes it safe to run blind.

What it does, in order:

| step | what | skipped when |
|---|---|---|
| 0 | preconditions: `.env`, `npx`, and the RPC answering on **chain id 821207** | never — it refuses to run on any other chain |
| 1 | `hardhat compile` | never |
| 2 | the full Hardhat suite (119 tests) | never — a deploy does not start on a red suite |
| 3 | the seven core contracts (`deploy.js`), then the real NFT base URIs (`set-baseuri.js`) | when all seven already have code on-chain |
| 4 | `CertificateRegistry` + funding the issuer key (`deploy-certificates.js`) | when it already has code; the issuer is topped up only below 10 GMB |
| 5 | faucet liquidity (`migrate-faucet.js`) | above 10 GMB |
| 6 | writes the new addresses into `src/contracts/addresses.json`, then `npm run build` | addresses: when they already match. The build also asserts the CSS is > 20 kB, which is the documented signal that Tailwind's `@source` lines survived |
| 7 | `systemctl restart educhain educhain-api` | when sudo is not available — it prints the command instead |
| 8 | proof: four HTTP checks and `eth_getCode` on every recorded address | never |

## After the script

1. **Re-populate the whitelist.** `Whitelist.addToWhitelist(address)` from the Admin panel, or
   `batchAddToWhitelist` for a class. The deployer whitelists itself as part of `deploy.js`.
2. **Check the certificate module**: `curl -s https://educhain.gembait.com/api/certificates/health`
   must show `issuerMatches: true` and a non-zero `issuerBalance`.
3. **Tell anyone holding a certificate** that the on-chain record is gone, if it was. The PDF is
   still a true document; the chain reference in it is not.

## What the script deliberately does NOT do

* touch mainnet — it refuses any chain id but 821207;
* create or print a private key (the issuer key is created once, by `make-issuer`, and only its
  address is ever printed);
* change an Apache vhost or a cron entry;
* re-issue certificates (see above).
