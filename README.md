# EduChain

**An open-source public good for Ethereum education.**
*Empowering the next generation of Web3 builders, developers, and informed citizens across Europe and beyond.*

---

[![Live Demo](https://img.shields.io/badge/Demo-educhain.gembait.com-2563eb)](https://educhain.gembait.com)
[![Network](https://img.shields.io/badge/Network-GembaBlockchain_Testnet-f59e0b)](https://testnet.gembascan.io)
[![License](https://img.shields.io/badge/License-MIT-10b981)](LICENSE)
[![Built by GEMBA IT](https://img.shields.io/badge/Built_by-GEMBA_IT-111827)](https://gembait.com)

EduChain is a comprehensive educational Web3 platform built for schools, universities, and training centres. It is a public good, not a product — every smart contract, every curriculum module, and every deployment artefact is freely available under open licences. EduChain exists for one purpose: to teach people how Ethereum works, safely and rigorously, and to grow the community of builders and informed users on whom the ecosystem's future depends.

**Technical documentation:** the Hardhat project with contract sources, deployment scripts, and developer instructions lives in [`blockchain/`](./blockchain/README.md).

---

## Table of Contents

1. [About the Project](#about-the-project)
2. [Platform Features](#platform-features)
3. [Technical Architecture](#technical-architecture)
4. [Platform Tour](#platform-tour)
5. [Smart Contract Addresses](#smart-contract-addresses)
6. [Technology Stack](#technology-stack)
7. [Security and Compliance](#security-and-compliance)
8. [For Developers](#for-developers)
9. [Contact](#contact)
10. [License](#license)

### Also in `docs/`

The positioning, the syllabus and the funding material were moved out of this README on 2026-10-31,
so that the README documents the product and each of those documents keeps its own job:

| document | what it is |
|---|---|
| [`docs/curriculum.md`](docs/curriculum.md) | the seven-module, sixteen-hour student syllabus |
| [`docs/teacher-training.md`](docs/teacher-training.md) | the **planned** teacher-training programme — none of it is implemented in the platform |
| [`docs/audiences.md`](docs/audiences.md) | who the platform is for, by segment |
| [`docs/why-web3-education.md`](docs/why-web3-education.md) | the policy rationale |
| [`docs/ethereum-commitment.md`](docs/ethereum-commitment.md) | the standing commitments to the Ethereum ecosystem |
| [`docs/partnerships.md`](docs/partnerships.md) · [`docs/funding.md`](docs/funding.md) · [`docs/sustainability.md`](docs/sustainability.md) · [`docs/open-source.md`](docs/open-source.md) | partnership, funding, sustainability and transparency |
| [`docs/redeploy.md`](docs/redeploy.md) | how to bring the whole deployment back after a chain restart |
| [`docs/certificates.md`](docs/certificates.md) | the certificate exam: how it works, what is stored, what goes on-chain |

---

## About the Project

EduChain is built for the Ethereum ecosystem, by people who believe that education is ecosystem infrastructure. It is an open-source public good designed to strengthen Ethereum's foundations by creating the next generation of informed users, responsible developers, and critical thinkers. The platform does not extract value from the ecosystem — it gives back. Every line of code, every curriculum module, and every deployed contract is freely available. EduChain exists to grow the Ethereum community, reduce the barrier to entry, and establish Web3 literacy as a fundamental skill for the digital age.

EduChain was developed by GEMBA IT to introduce blockchain technologies, decentralised finance, and digital asset management into the formal and informal education sectors across Europe. The platform operates entirely on the GembaBlockchain testnet, meaning no real value is ever at risk. Students and teachers learn by doing: they claim testnet GMB, buy tokens, mint NFTs, and trade on a curated marketplace, all under the supervision of trained educators. Every interaction is a real Ethereum transaction — with gas, confirmation times, and on-chain visibility — but the environment is a safe sandbox.

EduChain addresses a structural gap in European education. While Web3 technologies increasingly shape the digital economy, most school curricula and teacher training programmes have not yet integrated them. EduChain closes this gap with a turnkey solution: production-grade smart contracts, a polished web application, a detailed teacher training curriculum, and a structured 16-hour student programme. The project is positioned for adoption by ministries of education, regional authorities, universities, vocational training centres, coding bootcamps, private academies, and Ethereum-ecosystem initiatives, wherever they may be located. Its open-source foundation and GDPR-compliant design make it suitable for integration into publicly funded education systems anywhere, and its Ethereum-native architecture keeps it tightly aligned with ecosystem tooling and standards.

---

## Platform Features

EduChain combines a safe sandbox environment with production-grade tooling.

**Testnet-only environment.** All financial interactions take place on the GembaBlockchain testnet. Real money is never exchanged. Students experiment freely with buying, minting, trading, and transferring digital assets without financial risk.

**Role-based access control.** Three distinct roles structure the experience. The Owner controls system-wide configuration. Administrators, typically teachers or course leaders, manage the whitelist and guide students. Whitelisted students interact with the platform under controlled conditions.

**Rate-limited interactions.** Every contract enforces daily limits: three token purchases, three NFT mints, three marketplace listings, three marketplace purchases, and one faucet claim per twenty-four hours. These limits prevent spam, encourage deliberation, and mirror the discipline required in real financial environments.

**Live on-chain leaderboard.** The TrackingContract reads balances directly from the blockchain at the moment of each query. There is no caching, no manual refresh, and no cooldown. Students see their ranking update the moment a transaction confirms. Sorting is performed client-side in the browser, making the leaderboard scalable to thousands of users without on-chain gas costs.

**Multilingual interface.** The platform is fully translated into English, Bulgarian, and Spanish, with URL-based language routing. Additional languages require only translation of the JSON language files.

**Integrated NFT gallery.** Students view their complete NFT collection with full metadata, images, attributes, and direct links to both the smart contract and the IPFS-hosted metadata. Batch-minted NFTs are discovered via on-chain event queries rather than supply iteration, guaranteeing that every owned token appears.

**Peer-to-peer marketplace.** Students list their tokens and NFTs for sale at chosen prices. Private listings can be restricted to a specific buyer address. All sales settle on-chain with escrow-style asset custody during the listing period.

**GMB faucet for testnet activity.** Whitelisted students claim a fixed amount of testnet GMB every twenty-four hours, enabling continuous engagement with the platform without external funding.

**Admin dashboard.** Teachers and administrators interact with the contracts through a dynamic, ABI-driven function panel. Every writable contract function is exposed as a form with typed inputs. Owner-only and admin-only functions are separated by role, and the active wallet's permissions determine what is shown.

**AI-assisted learning.** The curriculum integrates modern AI assistants as analytical tools, teaching students to use them for smart contract analysis, risk identification, and decision support. This reflects actual Web3 professional practice.

---

## Technical Architecture

### Smart Contract Ecosystem

EduChain follows a testnet-first, risk-free deployment model. The platform consists of eight production-grade, immutable smart contracts, all deployed to GembaBlockchain testnet and verified on GembaScan, with full source code and compiled ABIs published in this repository. Contracts are written in Solidity 0.8.28, use OpenZeppelin v5 libraries, and target the Cancun EVM. They use custom errors instead of revert strings for gas efficiency and machine-readable error handling.

**Whitelist.** The access control registry. Maintains separate sets of whitelisted users, blacklisted users, and administrators. Every downstream contract queries this registry before allowing a user action. Uses OpenZeppelin's EnumerableSet for O(1) membership checks and gap-free pagination.

**GameToken.** An ERC-20 fungible token used as in-platform currency. Whitelisted users purchase whole tokens with testnet GMB at a fixed price. Three independent rate limits protect against spam: maximum tokens per purchase, maximum purchases per day, and maximum tokens per day. Per-user accounting is packed into a single storage slot for gas efficiency.

**GameNFTPredefined.** An ERC-721A non-fungible token collection with a fixed maximum supply. Metadata follows a deterministic pattern: `baseURI + tokenId + ".json"`. ERC-721A enables gas-efficient batch minting, so a user can mint multiple NFTs in a single transaction.

**GameNFTCustom.** An ERC-721A collection where users supply their own IPFS metadata URIs at mint time. Supports two payment modes: testnet GMB or GameToken (ERC-20). When a URI is provided, it is stored per-token and cannot be changed afterwards, guaranteeing metadata immutability.

**TokenMarketplace.** A peer-to-peer trading venue supporting ERC-20 and ERC-721 listings. Assets are escrowed in the marketplace at listing time and delivered to the buyer on purchase. Optional private listings restrict sales to a single allowed buyer address.

**TrackingContract.** The live leaderboard aggregator. Reads balances directly from the GameToken and NFT contracts on every query, computes points from an owner-configurable formula, and returns both raw balances and derived metrics (total points, tier rank from Bronze to Platinum, net worth in GMB). No cached state, no manual update function.

**ETHFaucet.** Distributes testnet GMB to whitelisted users. Per-user cooldown enforced in seconds. Contract-level ceilings prevent accidental misconfiguration: claim amounts cannot exceed one GMB and cooldown cannot exceed one week.

**CertificateRegistry** (added 2026-10-31). Course certificates, as a soulbound ERC-721 plus a public registry. Transfers and approvals are refused at the contract level: a diploma that can be sold certifies nothing. What is stored on-chain is a 32-byte hash of the certificate's contents, the date, the score and whether it has been revoked — and nothing else. **No personal data of any kind is written to the chain**, because a public chain is permanent and world-readable and a name written into it could never be corrected or erased. The readable fields live in EduChain's own database and on the PDF, where they can be. Two keys, deliberately separated: a hot `issuer` key on the server whose only power is `issue()`, and the cold `owner` key — not on the server — which is the only one that can revoke. See [`docs/certificates.md`](docs/certificates.md).

### The server tier

Two small Node processes sit behind the same Apache vhost, both bound to localhost:

**The static server** (`static-server.cjs`, port 3085) serves the built SPA with real HTTP semantics — a 301 for a bare `/`, a 404 for an unknown path, and a per-route `<head>` so crawlers see the right title and description without running JavaScript.

**The API** (`server/index.cjs`, port 3088) is deliberately tiny: a contact form (Turnstile + rate limit, forwarded by SMTP, stored nowhere), an IPFS pinning endpoint, and the certificates module.

**IPFS is ours.** EduChain runs its own Kubo node and pins to it directly; the public read gateway is `ipfs.gembait.com`. No third-party pinning service is used, and since 2026-10-31 the pinning endpoint requires a wallet signature checked against the on-chain whitelist, decides the file type from the bytes rather than from the declared MIME, and strips EXIF/XMP/IPTC before anything is pinned — IPFS is permanent and public, so a photograph's GPS coordinates must never get there.

**The certificates module** (`server/certificates/`) is the only part of EduChain with a database: a SQLite file holding the minimum needed to issue and verify a certificate, with a retention schedule. It is self-contained on purpose, so it can be lifted onto its own subdomain later.

### Why GembaBlockchain Testnet

EduChain is deployed on GembaBlockchain testnet for three deliberate reasons.

**Safety.** No real funds are ever at risk. Schools, ministries, and public institutions can adopt EduChain without financial liability or regulatory exposure. This is what makes the platform genuinely deployable in the public sector.

**Fidelity.** Every transaction is a real Ethereum transaction — with gas fees, confirmation times, and on-chain visibility. Students learn exactly how mainnet works, including its costs and constraints, without paying for them.

**Portability.** Because EduChain uses standard Ethereum tooling (Solidity, OpenZeppelin, ERC-721A) with no proprietary dependencies, the same contracts can be redeployed to mainnet, any EVM-compatible Layer 2 (Arbitrum, Optimism, Base, Polygon, zkSync), or a consortium chain with minimal changes. A student who learns on EduChain can apply that knowledge immediately anywhere in the Ethereum ecosystem.

### Platform Architecture

The web application is built with React 19 and TypeScript, served through Vite 8, and styled with Tailwind CSS v4 design tokens. Wallet connection is handled by wagmi v3, low-level chain interactions by viem v2, and contract calls by ethers v6. Internationalisation is handled by react-i18next. The NFT gallery reads the chain itself — it enumerates `Transfer` events and fetches each `tokenURI` directly, with no third-party NFT API in the path. The frontend is hosted behind Apache with Cloudflare as CDN and SSL terminator. The production domain is [educhain.gembait.com](https://educhain.gembait.com).

---

## Platform Tour

The live platform is available at [educhain.gembait.com](https://educhain.gembait.com). Evaluation does not require registration or payment — a GembaBlockchain testnet wallet and whitelist approval suffice.

**Home page.** Presents the platform mission, links to the curriculum and teacher programme, and displays live on-chain statistics including total whitelisted users, total NFTs minted, and current marketplace activity.

**Gallery.** Shows the connected user's complete NFT collection across both Predefined and Custom contracts. Each card displays the NFT image, name, contract badge, and token ID. Clicking opens a lightbox with full metadata, trait grid, contract link to GembaScan, and IPFS metadata JSON link.

**Token Shop.** Three tabs. The first allows purchase of GameToken at a fixed testnet-GMB price. The second allows minting of Predefined NFTs at a fixed testnet-GMB price. The third handles Custom NFTs with two sub-modes: Creative Mint (user supplies own IPFS URI, pays in testnet GMB) and Batch Mint (pays in GameTokens, uses default metadata for cheaper experimentation).

**Marketplace.** Displays all active listings with full NFT metadata rendered in each card. Filters allow viewing by token type or by seller. Each listing includes a Buy button (disabled for the seller), a Cancel button (only for the seller), and a View Details modal with complete information including private buyer restrictions where applicable.

**Leaderboard.** Shows the top ten users ranked by live points calculated on the blockchain. Each entry displays shortened address, tier badge, points total, and net worth in GMB. Auto-refreshes every thirty seconds.

**Full Rankings.** Displays every tracked user with client-side filters and sorting. Users can search by address, filter by minimum points or tier, and sort by points, token count, or net worth. Pagination supports page sizes from ten to one hundred.

**Faucet.** Allows whitelisted users to claim testnet GMB once every twenty-four hours. Shows countdown to next eligible claim, total claims made, cumulative GMB received, and current faucet balance.

**Admin Panel.** Restricted to administrators and the owner. Provides a dynamic, ABI-driven interface to every contract. Functions are organised by contract, separated into Read and Write tabs, and filtered by role. Each function renders as a form with typed inputs and an Execute button that produces pending, confirmed, and rejected transaction toasts with GembaScan links.

**Certificates.** Visible once a wallet is connected. A 20-question exam drawn at random from a bank of 65 across five topics and three difficulty levels, one question per screen, with a progress bar and no going back. The e-mail address is confirmed with a code before the exam starts, so a certificate can never be addressed to somebody else's inbox. At 80 % or above the certificate is issued: a PDF by e-mail, a soulbound token on-chain, and a public verification page. The correct answers never leave the server — not in an API response, not in the bundle, and not even in the result screen after a failed attempt.

**Verify.** Public, no wallet needed: anybody can type a certificate serial (or scan the QR on the PDF) and get a straight answer. Validity is read from the chain, not from our database, so our opinion cannot differ from the record. The page shows the name, the course, the date and the score — never an e-mail address.

**Contact.** Provides a simple form for partnership inquiries, pilot programme requests, technical questions, and funding discussions.

---

## Smart Contract Addresses

All eight contracts are deployed and source-verified on **GembaBlockchain testnet (chain id 821207)**.
Every address below is read from `src/contracts/addresses.json`, which is the file the application
itself loads — so this table cannot drift from what the site uses without the site breaking too.

| Contract | Address | What it does |
|---|---|---|
| Whitelist | [`0x76D8ddb79F91df2FB494Ef5375A67F778860AcFE`](https://testnet.gembascan.io/address/0x76D8ddb79F91df2FB494Ef5375A67F778860AcFE#code) | Access gate: who may use the platform, and who may administer it. |
| GameToken | [`0x7C9FFE16984b4fd7d006E806ce60C80d1089caA9`](https://testnet.gembascan.io/address/0x7C9FFE16984b4fd7d006E806ce60C80d1089caA9#code) | The GAME ERC-20 token students buy with test GMB. |
| GameNFTPredefined | [`0x8c05d9Ff72a1053b838BC7a945Aa203d700F0371`](https://testnet.gembascan.io/address/0x8c05d9Ff72a1053b838BC7a945Aa203d700F0371#code) | The curated ERC-721 collection (fixed metadata on IPFS). |
| GameNFTCustom | [`0x8838300d9F56d463E90356403E1E479a6DA62cFf`](https://testnet.gembascan.io/address/0x8838300d9F56d463E90356403E1E479a6DA62cFf#code) | Student-created ERC-721s with their own metadata. |
| TokenMarketplace | [`0x965d745e3fc0a7c2c9648dDaed0eb6EF276e8972`](https://testnet.gembascan.io/address/0x965d745e3fc0a7c2c9648dDaed0eb6EF276e8972#code) | Peer-to-peer trading between whitelisted users. |
| TrackingContract | [`0x9f5349e8514726b394fDEcEf16C1E8122f909397`](https://testnet.gembascan.io/address/0x9f5349e8514726b394fDEcEf16C1E8122f909397#code) | Points, ranks and the leaderboard. |
| ETHFaucet | [`0x76c46FF20A2770e564052A60dcB3990f2D8082AB`](https://testnet.gembascan.io/address/0x76c46FF20A2770e564052A60dcB3990f2D8082AB#code) | 0.05 GMB per 24 hours, to whitelisted users. |
| CertificateRegistry | [`0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4`](https://testnet.gembascan.io/address/0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4#code) | Course certificates: a soulbound ERC-721 plus a public registry. Only a HASH of the certificate is stored on-chain — no personal data. |

Deployer / owner: [`0x5578c75F22dE0bf1caA4BdD46BA28406C696a5dC`](https://testnet.gembascan.io/address/0x5578c75F22dE0bf1caA4BdD46BA28406C696a5dC)
Core stack deployed 2026-08-02; CertificateRegistry deployed 2026-10-31.
Explorer: <https://testnet.gembascan.io>

> **This is a testnet.** The GMB used for gas has no monetary value and neither do the tokens and
> NFTs. GEMBA runs the chain, and it has been restarted before — a restart wipes every contract and
> needs a redeploy. `blockchain/scripts/` plus the documented redeploy procedure make that a
> fifteen-minute job rather than a project; see `docs/redeploy.md`.

## Technology Stack

**Smart Contracts**

- Solidity 0.8.28
- OpenZeppelin Contracts v5
- ERC721A from Chiru Labs (gas-optimised batch minting)
- Hardhat development environment
- Cancun EVM target

**Frontend**

- React 19 with TypeScript
- Vite 8
- Tailwind CSS v4
- wagmi v3, viem v2, ethers v6
- Heroicons, Lucide
- react-hot-toast for transaction notifications

**Infrastructure**

- Production hosting on Hetzner dedicated server (Nuremberg)
- Cloudflare as CDN and DDoS protection
- Apache with Let's Encrypt TLS
- systemd service supervision
- Automated nightly backups

---

## Security and Compliance

**Smart contract security.** Every contract uses OpenZeppelin's audited primitives: Ownable for access control, ReentrancyGuard for reentrancy protection, and SafeERC20 for token movement. Custom errors replace revert strings for gas efficiency. The Checks-Effects-Interactions pattern is enforced in every state-changing function. Ownership renunciation is explicitly disabled in every contract to prevent accidental lockout. External security audit is scoped for any deployment beyond testnet.

**Platform security.** The application never stores or requests private keys. All authentication is wallet-based. Communication is TLS-encrypted. No user-identifiable data is collected without explicit consent. The platform operates in compliance with the GDPR and the EU Data Act.

**Classroom safety.** Testnet-only operation means no real financial exposure. Rate limits prevent students from making large or rapid-fire mistakes. Whitelist gating ensures only approved participants can interact with the contracts. Teachers can remove a student from the whitelist at any time, immediately halting their ability to mint, trade, or claim testnet GMB.

**Regulatory positioning.** EduChain is an educational tool and does not constitute a financial product. The GameToken has no real-world exchange value and no path to listing on any exchange. NFTs minted on the platform carry explicit metadata identifying them as educational artefacts.

---

## For Developers

The Hardhat project — contract sources, deployment scripts, compiled ABIs, and deployment records — lives in [`blockchain/`](./blockchain/README.md). See the [blockchain README](./blockchain/README.md) for full setup, deploy, and verification instructions.

Quick start:

```bash
git clone https://github.com/ivanovslavy/EduChain.git
cd EduChain/blockchain
npm install
cp .env.example .env       # then fill in RPC + GembaScan + deployer keys
npx hardhat compile
npx hardhat run scripts/deploy.js --network gemba
```

The seven core contracts deploy in dependency order, wire themselves together, fund the faucet, whitelist the deployer, extract ABIs into `blockchain/abi/`, save deployment records to `blockchain/deployed/`, and verify every contract on GembaScan in a single command. The eighth, `CertificateRegistry`, has its own script (`scripts/deploy-certificates.js`) because it needs the separate issuer key; both are wrapped by the redeploy procedure in [`docs/redeploy.md`](docs/redeploy.md), which is idempotent and checks the chain before every step.

---

## Contact

GEMBA EOOD is a Bulgarian technology company (VAT BG208656371) based in Varna. For partnership inquiries, pilot programme applications, grant collaboration, ecosystem contributions, or technical questions:

- Primary contact: [contacts@gembait.com](mailto:contacts@gembait.com)
- Website: [gembait.com](https://gembait.com)
- Live platform: [educhain.gembait.com](https://educhain.gembait.com)
- Managing Director: Slavcho Ivanov
- LinkedIn: [linkedin.com/in/slavy-ivanov](https://linkedin.com/in/slavy-ivanov)

Inquiries from ecosystem partners, EU institutions, national ministries, regional authorities, and non-profit organisations are responded to within two working days.

---

## License

The smart contract source code in this repository is released under the [MIT License](LICENSE). Educational curriculum materials are released under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). The EduChain name and visual identity remain the property of GEMBA EOOD.

---

EduChain is an open-source public good built to strengthen Ethereum, promote Web3 literacy, and empower the next generation of builders.

We welcome collaboration with the Ethereum Foundation, ecosystem partners, universities, schools, non-profit organisations, and training centres anywhere. If you share the mission of making Ethereum education accessible to everyone, please reach out.
