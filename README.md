# 🎮 Gaming Ecosystem - Smart Contract Platform

Complete blockchain gaming ecosystem with tokens, NFTs, marketplace, leaderboard, and faucet.

## 📋 Deployed Contracts

### Sepolia Testnet

| Contract | Address | Etherscan |
|----------|---------|-----------|
| Whitelist | `0xD822c6EAe418aC0Df76573bc999f25ed79f5487B` | [View](https://sepolia.etherscan.io/address/0xD822c6EAe418aC0Df76573bc999f25ed79f5487B) |
| GameToken (ERC20) | `0xb82Ba334D89fD07cb4445B0b156c2696099A0dC4` | [View](https://sepolia.etherscan.io/address/0xb82Ba334D89fD07cb4445B0b156c2696099A0dC4) |
| GameNFTPredefined | `0xe8f43769AAB632e716f57A7202d8B07f082ae89f` | [View](https://sepolia.etherscan.io/address/0xe8f43769AAB632e716f57A7202d8B07f082ae89f) |
| GameNFTCustom | `0xA1707e386AFE52CC324D7544E0C7057a2785dD52` | [View](https://sepolia.etherscan.io/address/0xA1707e386AFE52CC324D7544E0C7057a2785dD52) |
| TokenMarketplace | `0xFfE71b0dD485A107BFBabA9edda3bbf54dF9616d` | [View](https://sepolia.etherscan.io/address/0xFfE71b0dD485A107BFBabA9edda3bbf54dF9616d) |
| TrackingContract | `0xD32481b4A759793101C2Aad9ca1F534F5F39BEB6` | [View](https://sepolia.etherscan.io/address/0xD32481b4A759793101C2Aad9ca1F534F5F39BEB6) |
| ETHFaucet | `0x1E52C7dfb7e1cfc13d6fE983c0Cc97c0b04Ff130` | [View](https://sepolia.etherscan.io/address/0x1E52C7dfb7e1cfc13d6fE983c0Cc97c0b04Ff130) |

## 🚀 Features

### 1. **ERC20 Token (GAME)**
- Price: 0.01 ETH per token
- Purchase limits: 3 purchases/24h, max 3 tokens per purchase
- Sales statistics tracking

### 2. **NFT Collections**
- **Predefined NFTs**: Fixed metadata, 50 max supply, 0.01 ETH
- **Custom NFTs**: User-defined metadata, unlimited supply, 0.03 ETH
- **Batch Minting**: Pay with GAME tokens (1 token per NFT, max 2 addresses)

### 3. **Token Marketplace**
- List and trade ERC20, ERC721, ERC1155 tokens
- Interaction limits: 3 listings + 3 purchases per 24h
- Fee system with sales tracking

### 4. **Leaderboard System**
- Point calculation: 1pt per ERC20, 10pts per Predefined NFT, 30pts per Custom NFT
- Real-time ranking based on holdings
- Update stats once per hour

### 5. **ETH Faucet**
- 0.05 ETH per request
- Available every 24 hours
- Only for whitelisted users
- Distribution statistics

## 🛠️ Installation & Setup

### Prerequisites
```bash
- Node.js >= 16.x
- npm or yarn
- MetaMask or similar Web3 wallet
```

### Backend Setup

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment variables**
Create a `.env` file:
```env
# Private Keys (Sepolia Testnet)
USER1_PRIVATE_KEY=your_private_key_here

# API Keys
INFURA_API_KEY=your_infura_key
ALCHEMY_API_KEY=your_alchemy_key (optional)
ETHERSCAN_API_KEY=your_etherscan_key

# Block Explorer API Keys
BSCSCAN_API_KEY=your_bscscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key

# Gas Reporting
REPORT_GAS=true
```

3. **Compile contracts**
```bash
npx hardhat clean
npx hardhat compile
```

4. **Deploy to localhost (for testing)**
```bash
# Terminal 1 - Start local blockchain
npx hardhat node

# Terminal 2 - Deploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

5. **Deploy to Sepolia Testnet**
```bash
# Check network connection first
node scripts/check-network-connection.js

# Deploy
npx hardhat run scripts/deploy.js --network sepolia
```

6. **Verify contracts on Etherscan**
```bash
npx hardhat run scripts/verify.js --network sepolia
```

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
npm install
```

2. **Copy deployment data**
```bash
# Copy latest.json to frontend
cp ../deployed/latest.json src/contracts/deployed/

# Copy ABIs
cp ../artifacts/contracts/*.sol/*.json src/contracts/abis/
```

3. **Configure environment**
Create `frontend/.env`:
```env
REACT_APP_NETWORK_NAME=Sepolia
REACT_APP_CHAIN_ID=11155111
```

4. **Start development server**
```bash
npm start
```

## 🧪 Testing

### Run unit tests
```bash
npx hardhat test
```

### Run integration tests
```bash
# Test with localhost network
npx hardhat run scripts/test-ecosystem.js --network localhost

# Test with real transactions
npx hardhat run scripts/test-real-transactions.js --network localhost
```

### Test results
- **View only tests**: Check contract functions without transactions
- **Real transaction tests**: Execute actual blockchain operations

## 📊 Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Whitelist                             │
│              (Access Control for All Contracts)              │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   GameToken    │  │ GameNFTPredefined│  │  GameNFTCustom  │
│    (ERC20)     │  │     (ERC721)     │  │    (ERC721)     │
│  1 token = 1pt │  │  1 NFT = 10pts   │  │  1 NFT = 30pts  │
└────────────────┘  └──────────────────┘  └──────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ TrackingContract  │
                    │   (Leaderboard)   │
                    └───────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TokenMarketplace                          │
│           (Trade ERC20, ERC721, ERC1155 tokens)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       ETHFaucet                              │
│            (Distribute testnet ETH to users)                 │
└─────────────────────────────────────────────────────────────┘
```

## 📖 Usage Guide

### For Users

#### 1. Connect Wallet
- Install MetaMask
- Switch to Sepolia Testnet
- Connect wallet to the dApp

#### 2. Get Whitelisted
- Contact admin to be added to whitelist
- Required for all contract interactions

#### 3. Get Testnet ETH
- Use the built-in faucet: 0.05 ETH per 24 hours
- Or external faucets:
  - https://sepoliafaucet.com/
  - https://www.infura.io/faucet/sepolia

#### 4. Buy GAME Tokens
- Navigate to "Buy Tokens"
- Enter amount (max 3 per purchase)
- Approve transaction

#### 5. Mint NFTs
- **Predefined NFTs**: Fixed metadata, 0.01 ETH
- **Custom NFTs**: Your metadata URL, 0.03 ETH
- **Batch Mint**: Use GAME tokens (1 token per NFT)

#### 6. Trade on Marketplace
- List your tokens/NFTs for sale
- Browse and purchase from other users
- 3 listings + 3 purchases per 24 hours

#### 7. Track Your Progress
- View leaderboard ranking
- Update stats once per hour
- Earn points: ERC20 = 1pt, NFTs = 10-30pts

### For Admins

#### Whitelist Management
```javascript
// Add user to whitelist
await whitelist.addToWhitelist(userAddress);

// Remove from whitelist
await whitelist.removeFromWhitelist(userAddress);

// Add admin
await whitelist.addAdmin(adminAddress);
```

#### Configure Token Prices
```javascript
// Set ERC20 price
await gameToken.setTokenPrice(ethers.utils.parseEther("0.02"));

// Set NFT mint price
await gameNFTPredefined.setMintPrice(ethers.utils.parseEther("0.015"));
```

#### Configure Limits
```javascript
// Set purchase limits
await gameToken.setBuyPer24Hours(5);
await gameToken.setMaxTokensPerPurchase(5);

// Set mint limits
await gameNFTPredefined.setMintPer24Hours(5);
```

#### Manage Faucet
```javascript
// Fund faucet
await ethFaucet.fundFaucet({ value: ethers.utils.parseEther("1.0") });

// Set grab amount
await ethFaucet.setGrabETH(ethers.utils.parseEther("0.1"));

// Set time limit (in hours)
await ethFaucet.setGrabTimeLimit(48);
```

#### Configure Points System
```javascript
// Set points configuration
await trackingContract.setPointsConfiguration(
  2,   // 2 points per ERC20
  15,  // 15 points per Predefined NFT
  50   // 50 points per Custom NFT
);
```

## 🔒 Security Features

- **Access Control**: Whitelist-based system
- **Reentrancy Protection**: All state-changing functions protected
- **Rate Limiting**: Time-based limits on user interactions
- **Owner-only Functions**: Critical functions restricted to owner
- **Admin Roles**: Delegated administrative capabilities
- **Emergency Functions**: Withdraw and emergency mint capabilities

## 📁 Project Structure

```
token-marketplace/
├── contracts/              # Solidity smart contracts
│   ├── Whitelist.sol
│   ├── GameToken.sol
│   ├── GameNFTPredefined.sol
│   ├── GameNFTCustom.sol
│   ├── TokenMarketplace.sol
│   ├── TrackingContract.sol
│   └── ETHFaucet.sol
├── scripts/               # Deployment and utility scripts
│   ├── deploy.js
│   ├── verify.js
│   ├── test-ecosystem.js
│   ├── test-real-transactions.js
│   └── check-network-connection.js
├── test/                  # Unit tests
├── deployed/              # Deployment records
│   └── latest.json       # Latest deployment addresses
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   │   └── Web3Context.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TokenPurchase.tsx
│   │   │   ├── NFTPredefined.tsx
│   │   │   ├── NFTCustom.tsx
│   │   │   ├── Marketplace.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   ├── Faucet.tsx
│   │   │   └── AdminPanel.tsx
│   │   └── App.tsx
│   └── package.json
├── hardhat.config.js      # Hardhat configuration
├── package.json
└── README.md
```

## 🌐 API Reference

### GameToken (ERC20)

```javascript
// Purchase tokens
await gameToken.buyTokens(amount, { value: totalCost });

// Check purchase limits
const stats = await gameToken.getUserPurchaseStats(userAddress);
// Returns: { purchaseCount, lastPurchaseTime, remainingPurchases, tokensBoughtToday, remainingTokens }

// Check if user can buy
const canBuy = await gameToken.canUserBuy(userAddress, amount);
// Returns: [bool canBuy, string reason]
```

### GameNFTPredefined (ERC721)

```javascript
// Mint NFT
await gameNFTPredefined.mint(toAddress, { value: mintPrice });

// Get user mint stats
const stats = await gameNFTPredefined.getUserMintStats(userAddress);
// Returns: { mintsToday, lastMintTime, remainingMints }

// Get sales statistics
const salesStats = await gameNFTPredefined.getSalesStatistics();
// Returns: { totalSales, totalMinted, remainingSupply, mintPrice, maxSupply }
```

### GameNFTCustom (ERC721)

```javascript
// Regular mint with ETH
await gameNFTCustom.mint(metadataURI, { value: mintPrice });

// Batch mint with ERC20 tokens
await gameToken.approve(gameNFTCustomAddress, totalTokensNeeded);
await gameNFTCustom.batchMintWithERC20([address1, address2], [uri1, uri2]);

// Get sales statistics
const stats = await gameNFTCustom.getSalesStatistics();
// Returns: [totalSalesETH, totalSalesERC20, nftsMintedWithETH, nftsMintedWithERC20]
```

### TrackingContract

```javascript
// Update user stats
await trackingContract.updateUserStats(userAddress);

// Get leaderboard
const leaderboard = await trackingContract.getLeaderboard(limit);
// Returns: [[addresses], [points]]

// Get user stats
const stats = await trackingContract.getUserStats(userAddress);
// Returns: { erc20Balance, erc721PredefinedBalance, erc721CustomBalance, totalPoints, lastUpdateTime, isActive }

// Check if user can update
const canUpdate = await trackingContract.canUserUpdate(userAddress);
// Returns: [bool canUpdate, uint timeUntilUpdate]
```

### ETHFaucet

```javascript
// Grab ETH
await ethFaucet.grabETH();

// Get user stats
const stats = await ethFaucet.getUserGrabStats(userAddress);
// Returns: [lastGrabTime, totalGrabbed, timesGrabbed]

// Check if user can grab
const canGrab = await ethFaucet.canUserGrab(userAddress);
// Returns: [bool canGrab, uint timeUntilNext, uint amount]

// Get faucet statistics
const stats = await ethFaucet.getFaucetStats();
// Returns: [balance, totalDistributed, totalRequests, uniqueUsers]
```

## 🐛 Troubleshooting

### Common Issues

**1. "Network Error" during deployment**
- Check your Infura/Alchemy API key
- Try alternative RPC: https://rpc.sepolia.org
- Verify you have enough ETH for gas

**2. "User not whitelisted" error**
- Contact admin to be added to whitelist
- Check if you're connected with correct wallet

**3. "Exceeds daily limit" error**
- Wait 24 hours since last interaction
- Limits reset after 24-hour period

**4. Transactions failing**
- Ensure sufficient ETH balance
- Check gas price settings
- Verify contract approvals

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: [Read the docs](https://docs.your-project.com)
- Discord: [Join community](https://discord.gg/your-server)

---

**Built with ❤️ using Hardhat, Solidity, React, and TypeScript**
