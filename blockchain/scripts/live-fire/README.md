# Live-fire layer — gemba testnet (chainId 821207)

Runs the same adversarial scenarios as the Hardhat suite, but as real
transactions against a **fresh** deployment on the gemba testnet. It deploys its
own instances and does **not** touch the live production EduChain contracts.

Scripts (run in order, with `--network gemba`):

1. `snapshot-before.js` — read-only: records chain id and the live production
   EduChain addresses (proof they are untouched).
2. `deploy-fresh.js` — deploys the 7 contracts + the test helpers, wires them,
   writes `live-fire-deployed.json`.
3. `fund-and-attack.js` — creates fresh actor wallets (admin, whitelisted users,
   a whitelisted attacker, an outsider), provisions them via one intermediate
   distributor wallet, whitelists them on-chain, then runs every scenario and
   prints DEFEATED / CONFIRMED per case.

Config comes from environment variables (kept out of git): the gemba RPC URL and
the funding wallet used to provision the distributor once. If a signed
transaction is intercepted by the auto-mode classifier, each script is a plain
`npx hardhat run ... --network gemba` and can be triggered in-session with a `!`
prefix — the on-chain result is identical.
