require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Multiple private keys support
const PRIVATE_KEYS = [
  process.env.USER1_PRIVATE_KEY,
  process.env.USER2_PRIVATE_KEY,
  process.env.USER3_PRIVATE_KEY,
  process.env.USER4_PRIVATE_KEY,
  process.env.USER5_PRIVATE_KEY,
].filter((key) => key && key.length > 0);

const INFURA_API_KEY      = process.env.INFURA_API_KEY || "";
const ALCHEMY_API_KEY     = process.env.ALCHEMY_API_KEY || "";
const ETHERSCAN_API_KEY   = process.env.ETHERSCAN_API_KEY || "";
const BSCSCAN_API_KEY     = process.env.BSCSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },

    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : undefined,
    },

    // Sepolia — tiered RPC fallback
    sepolia: {
      url: ALCHEMY_API_KEY
        ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : INFURA_API_KEY
        ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
        : "https://rpc.sepolia.org",
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : [],
      chainId: 11155111,
      timeout: 60000,
    },

    // Ethereum Mainnet
    ethereum: {
      url: ALCHEMY_API_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : [],
      chainId: 1,
    },

    // BNB Smart Chain
    bsc: {
      url: "https://bsc-dataseed1.binance.org/",
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : [],
      chainId: 56,
      gasPrice: 5000000000, // 5 gwei
    },

    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : [],
      chainId: 97,
      gasPrice: 10000000000, // 10 gwei
    },

    // Polygon
    polygon: {
      url: ALCHEMY_API_KEY
        ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : `https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : [],
      chainId: 137,
      gasPrice: 30000000000, // 30 gwei
    },

    amoy: {
      url: ALCHEMY_API_KEY
        ? `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : "https://rpc-amoy.polygon.technology/",
      accounts: PRIVATE_KEYS.length > 0 ? PRIVATE_KEYS : [],
      chainId: 80002,
      gasPrice: 30000000000, // 30 gwei
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },

  etherscan: {
    apiKey: {
      mainnet:    ETHERSCAN_API_KEY,
      sepolia:    ETHERSCAN_API_KEY,
      bsc:        BSCSCAN_API_KEY,
      bscTestnet: BSCSCAN_API_KEY,
      polygon:    POLYGONSCAN_API_KEY,
      amoy:       POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 120000, // 2 min for slower networks
  },
};
