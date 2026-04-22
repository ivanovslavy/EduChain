# EduChain — Smart Contracts

Hardhat project holding the seven Solidity contracts that power the [EduChain](https://educhain.gembait.com) platform. All contracts target the Ethereum Sepolia testnet.

Part of [EduChain](../README.md) — an open-source public good for Ethereum education. For the platform overview, curriculum, and funding context, see the [root README](../README.md).

## Requirements

- Node.js 20+
- npm 10+
- An Ethereum wallet with a small amount of Sepolia ETH (for deployment / testing)
- Optional: Alchemy or Infura API key, Etherscan API key (for verification)

## Setup

```bash
cd blockchain
npm install
cp .env.example .env
# edit .env and fill in the keys you need
```

### Environment variables

| Variable | Purpose |
|---|---|
| `ALCHEMY_API_KEY` | Preferred Sepolia RPC (Alchemy) |
| `INFURA_API_KEY` | Fallback Sepolia RPC (Infura) |
| `ETHERSCAN_API_KEY` | Required for `hardhat verify` on Etherscan |
| `USER1_PRIVATE_KEY` … `USER5_PRIVATE_KEY` | Signing keys; index 1 is the deployer |
| `BSCSCAN_API_KEY`, `POLYGONSCAN_API_KEY` | Optional, only if deploying to BSC / Polygon |
| `REPORT_GAS` | Set to any non-empty value to enable gas reporting during tests |

If no RPC key is set, the Sepolia network falls back to the public `https://rpc.sepolia.org` endpoint (rate-limited).

## Common tasks

```bash
npm run compile              # compile all contracts
npm run test                 # run the test suite (when tests are added)
npm run node                 # local hardhat node on :8545

# Deploy the full stack to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Verify a deployed contract on Etherscan
npx hardhat verify --network sepolia <ADDRESS> <constructor-args...>
```

Deployment output is written to `deployed/latest.json` and to a timestamped snapshot alongside it (e.g. `deployment-sepolia-YYYY-MM-DD-HH-MM-SS.json`). Compiled ABIs are emitted into `abi/`.

## Contracts

| File | Description |
|---|---|
| `Whitelist.sol` | Central access-control registry. Other contracts consult it before executing privileged actions. |
| `GameToken.sol` | ERC-20 utility token (`GAME`). Priced at 0.01 ETH, with per-address purchase limits and on-chain sale stats. |
| `GameNFTPredefined.sol` | ERC-721A collection with fixed metadata and a hard cap of 50 items (price: 0.01 ETH). |
| `GameNFTCustom.sol` | ERC-721A collection where users supply their own metadata URI. Mintable with ETH (0.03 ETH) or GAME tokens (1 GAME). |
| `TokenMarketplace.sol` | Non-custodial P2P marketplace for GAME and both NFT collections. Fixed-price listings with `ReentrancyGuard` + `SafeERC20`. |
| `TrackingContract.sol` | Aggregates per-address activity (buys, mints, trades) and exposes leaderboard queries. |
| `ETHFaucet.sol` | Drip faucet — sends 0.05 Sepolia ETH per claim, with a 24-hour cooldown per address. |

All contracts compile with:

```
solc 0.8.28
optimizer: enabled (200 runs)
evmVersion: cancun
```

## Deployed on Sepolia

See [`../README.md`](../README.md#smart-contract-addresses) for the address table, or inspect `deployed/latest.json` for the full deployment record (including constructor arguments, tx hashes, and block numbers).

## Architecture notes

- **Access control.** `Whitelist` is deployed first; every subsequent contract is constructed with its address and consults it for gated operations.
- **Re-entrancy safety.** All contracts that move ETH or ERC-20 value inherit `ReentrancyGuard` and use `SafeERC20` for token transfers.
- **Gas-efficient mints.** Both NFT contracts extend ERC-721A (Chiru Labs) to keep batch-mint gas costs low.
- **No admin back-doors on user funds.** Owner privileges are limited to pausing, price updates, and whitelist management. Listings and balances cannot be moved by the owner.

## License

MIT — see [`../LICENSE`](../LICENSE).
