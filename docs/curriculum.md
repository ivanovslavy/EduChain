# Student Curriculum (16 Hours)

> Moved out of the root README on 2026-10-31 so that the README documents the product and this document keeps the positioning. The full seven-module, sixteen-hour student syllabus.

The curriculum is designed for students aged twelve and above. It can be delivered as a standalone elective course, integrated into existing informatics or economics programmes, or adapted for shorter bootcamp formats. The programme progresses from conceptual foundations to independent creation, culminating in a final project each student presents to their peers.

### Module 1: Introduction to Web3 and Blockchain Foundations (2 hours)

Students examine how the internet has evolved from Web1 (static pages you read) through Web2 (platforms you write to but do not own) to Web3 (networks where ownership is mathematically verifiable on-chain). Blockchain is presented through the analogy of a shared public ledger that no single party controls. Key principles are introduced: decentralisation, transparency, and immutability. Smart contracts are framed as self-executing agreements, often illustrated with the vending machine analogy.

Practical work: each student connects MetaMask to the GembaBlockchain testnet and opens the EduChain platform. Discussion follows on the benefits and risks of decentralisation in everyday life.

### Module 2: Web3 Wallets and Smart Contracts in Practice (2 hours)

The second module moves from concept to action. MetaMask is explored in depth: what private keys actually are, why seed phrases must never be shared or photographed, and how transactions are digitally signed using public-key proofs. Students observe what happens when they click "mint" or "buy" on a dApp, tracing the transaction through the mempool to confirmation on GembaScan.

Practical work: students claim their first testnet GMB from the platform faucet and purchase their first GameToken. Each student then locates their transaction on GembaScan and interprets its fields.

### Module 3: ERC-20 Tokens and Decentralised Trading (2 hours)

Students study the ERC-20 standard in detail: what makes a token fungible, what decimals mean, and how total supply differs from circulating supply. Liquidity pools are introduced through accessible analogies, and price discovery is explained through order mechanics. The fixed-price design of the EduChain GameToken provides a controlled environment for observing these concepts without the volatility of live markets.

Practical work: students buy and sell GameToken on the platform, observe how their wallet balance changes, and use GembaScan to verify every movement on-chain.

### Module 4: Non-Fungible Tokens and Digital Art (ERC-721) (2 hours)

The fourth module introduces the ERC-721 standard. Students learn what makes a token unique, how tokenId and metadata interact, and why the metadata JSON file is the actual artistic payload of most NFTs. IPFS is explained as the decentralised filesystem that makes digital assets permanent. Students practise with the platform's own IPFS endpoint, uploading an image and a metadata file, obtaining content identifiers, and assembling a valid tokenURI.

Practical work: each student creates an original image, writes a structured metadata JSON file with attributes such as name, description, and rarity, uploads both to IPFS through the platform's `/api/ipfs/metadata` endpoint — which takes the upload against a wallet signature and pins it to EduChain's own Kubo node — and mints a Custom NFT on the EduChain platform. The newly minted NFT appears in the gallery within seconds.

### Module 5: Economics of Tokens and NFTs (2 hours)

Students learn to move assets between wallets, approve third parties to spend on their behalf, and list items for sale on the marketplace. Pricing strategy is examined: how to value a digital asset when there is no obvious reference point. The gamified points system is explored as a microeconomic exercise, demonstrating how reputation, rank, and scarcity interact.

Practical work: each student lists an NFT for sale priced in GameTokens. Students purchase one another's NFTs. A time-boxed competition rewards whoever reaches the highest leaderboard position by the end of class. Post-competition discussion examines which strategies proved most effective and why.

### Module 6: Security, Key Management, and Scam Recognition (2 hours)

The sixth module is the most consequential for the student's future. Private key management is revisited with greater depth: hardware wallets, cold storage, and the trade-offs of each approach. Approve functions are examined as a frequent vector for fraud. Common scam patterns are studied in detail: phishing, fake airdrops, malicious token approvals, rug pulls, and liquidity exploits. Students practise distinguishing verified contracts from unverified ones, reading contract source on GembaScan, and identifying suspicious patterns.

Practical work: a simulated scam scenario is run in the classroom. Students must identify the attack vector before authorising a transaction. Transaction approval is practised with attention to allowance limits and contract addresses.

### Module 7: Final Project and AI as Blockchain Assistant (4 hours)

The final module synthesises every prior lesson into a presented project.

In the first hour, students create an advanced NFT collection with rich metadata, integrating attributes such as traits, rarity tiers, and narrative elements. Pinning and metadata management through the platform's own IPFS endpoint are refined. Discussion examines common mistakes in NFT projects and how to avoid them.

In the second hour, students use AI assistants to analyse smart contract source code. A standard OpenZeppelin template is examined alongside a deliberately crafted scam contract. Students practise using AI to identify risks, not to replace their own judgement but to augment it. The concept of AI as daily Web3 infrastructure is introduced.

In the third and fourth hours, students work on their individual final project. Each project has three components: a small NFT collection with a coherent narrative, an economic strategy intended to reach a target leaderboard position, and a market integration plan. Students work individually with teacher support and AI assistance. The course concludes with each student presenting their project to the class, followed by a forward-looking discussion on continuing Web3 education. The course itself awards no certificate: certification is a separate, self-service exam on the platform — twenty questions, eighty percent to pass — after which the holder receives a signed PDF by e-mail and a soulbound on-chain record.

### Learning Outcomes

A student who completes the full programme can:

- Explain blockchain fundamentals and the evolution of the internet.
- Create, secure, and operate a Web3 wallet.
- Read, interpret, and verify on-chain transactions.
- Distinguish fungible from non-fungible tokens and explain the use cases for each.
- Create and publish original digital assets on decentralised storage.
- Buy, sell, and trade digital assets through peer-to-peer markets.
- Recognise common scams and apply defensive practices.
- Use AI tools as analytical assistants for smart contract evaluation.
- Describe the economic dynamics of tokenised systems.
- Present a completed Web3 project to peers.

---
