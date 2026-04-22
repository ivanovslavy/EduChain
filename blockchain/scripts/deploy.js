const { ethers, run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ═════════════════════════════════════════════════════════════
//                     CONFIGURATION
// ═════════════════════════════════════════════════════════════

const CONFIG = {
  // GameToken (ERC-20)
  gameTokenName:   "EduChain Game Token",
  gameTokenSymbol: "GAME",
  gameTokenPrice:  ethers.parseEther("0.01"),   // 0.01 ETH per whole token

  // Predefined NFT
  predefinedName:     "EduChain Predefined NFTs",
  predefinedSymbol:   "EDUPRE",
  predefinedBaseURI:  "ipfs://bafybeiexamplepredefined/",
  predefinedPrice:    ethers.parseEther("0.01"),
  predefinedMaxSupply: 50n,

  // Custom NFT
  customName:       "EduChain Custom NFTs",
  customSymbol:     "EDUCUS",
  customBaseURI:    "ipfs://bafybeiexamplecustom/",
  customEthPrice:   ethers.parseEther("0.03"),
  customTokenPrice: ethers.parseEther("1"),     // 1 GAME per NFT (1e18 wei)

  // ETH Faucet
  faucetClaimAmount: ethers.parseEther("0.05"),
  faucetCooldown:    24n * 60n * 60n,           // 24 hours in seconds
  faucetInitialFund: ethers.parseEther("0.1"),  // initial deposit

  // Verification delay (Etherscan indexing lag)
  verifyDelaySeconds: 20,
};

// ═════════════════════════════════════════════════════════════
//                     HELPERS
// ═════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deploy(name, factory, args) {
  console.log(`\n📦 Deploying ${name}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();
  console.log(`   ✅ ${name} → ${address}`);
  console.log(`      tx: ${receipt.hash}`);
  console.log(`      gas: ${receipt.gasUsed.toString()}`);
  return { contract, address, args, txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function verify(name, address, args) {
  try {
    console.log(`   🔍 Verifying ${name}...`);
    await run("verify:verify", { address, constructorArguments: args });
    console.log(`   ✅ Verified`);
    return true;
  } catch (err) {
    if (err.message.toLowerCase().includes("already verified")) {
      console.log(`   ✓ Already verified`);
      return true;
    }
    console.warn(`   ⚠ Verification failed: ${err.message.split("\n")[0]}`);
    console.warn(`     Manual: npx hardhat verify --network ${network.name} ${address} ${args.map((a) => `"${a}"`).join(" ")}`);
    return false;
  }
}

function saveABI(contractName, abiDir) {
  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    console.warn(`   ⚠ Artifact not found: ${artifactPath}`);
    return;
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abiOnly = { contractName, abi: artifact.abi };
  const outPath = path.join(abiDir, `${contractName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(abiOnly, null, 2));
  console.log(`   💾 ABI → ${path.relative(path.join(__dirname, ".."), outPath)}`);
}

// ═════════════════════════════════════════════════════════════
//                     MAIN
// ═════════════════════════════════════════════════════════════

async function main() {
  console.log("═".repeat(72));
  console.log(" EduChain contracts v2 — unified deployment");
  console.log("═".repeat(72));

  // ── Network ──
  const net = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(` Network:  ${network.name} (chainId ${net.chainId})`);
  console.log(` Deployer: ${deployer.address}`);
  console.log(` Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Deployer has 0 ETH. Fund the wallet and retry.");
  }
  if (balance < ethers.parseEther("0.05")) {
    console.warn(" ⚠ Balance is low. Deployment may fail mid-way.");
  }

  // ── Ensure output directories ──
  const deployedDir = path.join(__dirname, "..", "deployed");
  const abiDir      = path.join(__dirname, "..", "abi");
  if (!fs.existsSync(deployedDir)) fs.mkdirSync(deployedDir, { recursive: true });
  if (!fs.existsSync(abiDir))      fs.mkdirSync(abiDir,      { recursive: true });

  // ═════════════════════════════════════════════════════════════
  //    PHASE 1 — Deploy (dependency order)
  // ═════════════════════════════════════════════════════════════

  console.log("\n" + "─".repeat(72));
  console.log(" PHASE 1 — Deployments");
  console.log("─".repeat(72));

  // 1. Whitelist (base, no dependencies)
  const WhitelistFactory = await ethers.getContractFactory("Whitelist");
  const whitelist = await deploy("Whitelist", WhitelistFactory, [deployer.address]);

  // 2. GameToken (needs whitelist)
  const GameTokenFactory = await ethers.getContractFactory("GameToken");
  const gameToken = await deploy("GameToken", GameTokenFactory, [
    CONFIG.gameTokenName,
    CONFIG.gameTokenSymbol,
    whitelist.address,
    deployer.address,
    CONFIG.gameTokenPrice,
  ]);

  // 3. GameNFTPredefined (needs whitelist)
  const GameNFTPredefinedFactory = await ethers.getContractFactory("GameNFTPredefined");
  const nftPredefined = await deploy("GameNFTPredefined", GameNFTPredefinedFactory, [
    CONFIG.predefinedName,
    CONFIG.predefinedSymbol,
    CONFIG.predefinedBaseURI,
    whitelist.address,
    deployer.address,
    CONFIG.predefinedPrice,
    CONFIG.predefinedMaxSupply,
  ]);

  // 4. GameNFTCustom (needs whitelist; GameToken linked later)
  const GameNFTCustomFactory = await ethers.getContractFactory("GameNFTCustom");
  const nftCustom = await deploy("GameNFTCustom", GameNFTCustomFactory, [
    CONFIG.customName,
    CONFIG.customSymbol,
    CONFIG.customBaseURI,
    whitelist.address,
    deployer.address,
    CONFIG.customEthPrice,
    CONFIG.customTokenPrice,
  ]);

  // 5. TokenMarketplace (needs whitelist)
  const TokenMarketplaceFactory = await ethers.getContractFactory("TokenMarketplace");
  const marketplace = await deploy("TokenMarketplace", TokenMarketplaceFactory, [
    whitelist.address,
    deployer.address,
  ]);

  // 6. TrackingContract (needs whitelist + game token + both NFTs)
  const TrackingFactory = await ethers.getContractFactory("TrackingContract");
  const tracking = await deploy("TrackingContract", TrackingFactory, [
    whitelist.address,
    gameToken.address,
    nftPredefined.address,
    nftCustom.address,
    deployer.address,
  ]);

  // 7. ETHFaucet (needs whitelist)
  const ETHFaucetFactory = await ethers.getContractFactory("ETHFaucet");
  const faucet = await deploy("ETHFaucet", ETHFaucetFactory, [
    whitelist.address,
    deployer.address,
    CONFIG.faucetClaimAmount,
    CONFIG.faucetCooldown,
  ]);

  // ═════════════════════════════════════════════════════════════
  //    PHASE 2 — Wire up (post-deploy configuration)
  // ═════════════════════════════════════════════════════════════

  console.log("\n" + "─".repeat(72));
  console.log(" PHASE 2 — Post-deploy configuration");
  console.log("─".repeat(72));

  // Link GameToken as payment currency in GameNFTCustom
  console.log("\n🔗 Setting GameToken as payment token in GameNFTCustom...");
  let tx = await nftCustom.contract.setPaymentToken(gameToken.address);
  let receipt = await tx.wait();
  console.log(`   ✅ setPaymentToken — gas ${receipt.gasUsed}`);

  // Fund the faucet
  console.log("\n💧 Funding ETHFaucet with", ethers.formatEther(CONFIG.faucetInitialFund), "ETH...");
  tx = await deployer.sendTransaction({
    to: faucet.address,
    value: CONFIG.faucetInitialFund,
  });
  receipt = await tx.wait();
  console.log(`   ✅ Faucet funded — gas ${receipt.gasUsed}`);

  // Whitelist the deployer (so you can test immediately)
  console.log("\n✍️  Whitelisting deployer...");
  tx = await whitelist.contract.addToWhitelist(deployer.address);
  receipt = await tx.wait();
  console.log(`   ✅ ${deployer.address} is whitelisted — gas ${receipt.gasUsed}`);

  // ═════════════════════════════════════════════════════════════
  //    PHASE 3 — Save ABIs and deployment JSON
  // ═════════════════════════════════════════════════════════════

  console.log("\n" + "─".repeat(72));
  console.log(" PHASE 3 — Saving artifacts");
  console.log("─".repeat(72));

  console.log("\n📂 Extracting ABIs to ./abi/");
  for (const name of [
    "Whitelist",
    "GameToken",
    "GameNFTPredefined",
    "GameNFTCustom",
    "TokenMarketplace",
    "TrackingContract",
    "ETHFaucet",
  ]) {
    saveABI(name, abiDir);
  }

  const timestamp = new Date().toISOString();
  const deployment = {
    network: { name: network.name, chainId: Number(net.chainId) },
    deployer: deployer.address,
    timestamp,
    config: {
      gameTokenName:       CONFIG.gameTokenName,
      gameTokenSymbol:     CONFIG.gameTokenSymbol,
      gameTokenPrice:      CONFIG.gameTokenPrice.toString(),
      predefinedBaseURI:   CONFIG.predefinedBaseURI,
      predefinedPrice:     CONFIG.predefinedPrice.toString(),
      predefinedMaxSupply: CONFIG.predefinedMaxSupply.toString(),
      customBaseURI:       CONFIG.customBaseURI,
      customEthPrice:      CONFIG.customEthPrice.toString(),
      customTokenPrice:    CONFIG.customTokenPrice.toString(),
      faucetClaimAmount:   CONFIG.faucetClaimAmount.toString(),
      faucetCooldown:      CONFIG.faucetCooldown.toString(),
      faucetInitialFund:   CONFIG.faucetInitialFund.toString(),
    },
    contracts: {
      Whitelist:         { address: whitelist.address,    args: whitelist.args,    txHash: whitelist.txHash,    blockNumber: whitelist.blockNumber },
      GameToken:         { address: gameToken.address,    args: gameToken.args.map(String), txHash: gameToken.txHash, blockNumber: gameToken.blockNumber },
      GameNFTPredefined: { address: nftPredefined.address,args: nftPredefined.args.map(String), txHash: nftPredefined.txHash, blockNumber: nftPredefined.blockNumber },
      GameNFTCustom:     { address: nftCustom.address,    args: nftCustom.args.map(String), txHash: nftCustom.txHash, blockNumber: nftCustom.blockNumber },
      TokenMarketplace:  { address: marketplace.address,  args: marketplace.args,  txHash: marketplace.txHash,  blockNumber: marketplace.blockNumber },
      TrackingContract:  { address: tracking.address,     args: tracking.args,     txHash: tracking.txHash,     blockNumber: tracking.blockNumber },
      ETHFaucet:         { address: faucet.address,       args: faucet.args.map(String), txHash: faucet.txHash, blockNumber: faucet.blockNumber },
    },
  };

  const datePart = timestamp.slice(0, 19).replace(/[:T]/g, "-");
  const deployFile = path.join(deployedDir, `deployment-${network.name}-${datePart}.json`);
  const latestFile = path.join(deployedDir, "latest.json");

  fs.writeFileSync(deployFile, JSON.stringify(deployment, null, 2));
  fs.writeFileSync(latestFile, JSON.stringify(deployment, null, 2));
  console.log(`\n💾 Deployment saved:`);
  console.log(`   ${path.relative(path.join(__dirname, ".."), deployFile)}`);
  console.log(`   ${path.relative(path.join(__dirname, ".."), latestFile)}`);

  // Frontend addresses.json (short-form)
  const addresses = {
    whitelist:         whitelist.address,
    gameToken:         gameToken.address,
    gameNFTPredefined: nftPredefined.address,
    gameNFTCustom:     nftCustom.address,
    marketplace:       marketplace.address,
    trackingContract:  tracking.address,
    ethFaucet:         faucet.address,
  };
  fs.writeFileSync(path.join(deployedDir, "addresses.json"), JSON.stringify(addresses, null, 2));
  console.log(`   deployed/addresses.json (frontend-ready)`);

  // ═════════════════════════════════════════════════════════════
  //    PHASE 4 — Etherscan verification (after delay)
  // ═════════════════════════════════════════════════════════════

  const isPublicNetwork = network.name === "sepolia" || network.name === "mainnet";
  if (isPublicNetwork) {
    console.log("\n" + "─".repeat(72));
    console.log(` PHASE 4 — Etherscan verification (waiting ${CONFIG.verifyDelaySeconds}s for indexing)`);
    console.log("─".repeat(72));
    await sleep(CONFIG.verifyDelaySeconds * 1000);

    await verify("Whitelist",         whitelist.address,    whitelist.args);
    await verify("GameToken",         gameToken.address,    gameToken.args);
    await verify("GameNFTPredefined", nftPredefined.address, nftPredefined.args);
    await verify("GameNFTCustom",     nftCustom.address,    nftCustom.args);
    await verify("TokenMarketplace",  marketplace.address,  marketplace.args);
    await verify("TrackingContract",  tracking.address,     tracking.args);
    await verify("ETHFaucet",         faucet.address,       faucet.args);
  } else {
    console.log("\n ℹ Local network — skipping Etherscan verification");
  }

  // ═════════════════════════════════════════════════════════════
  //    SUMMARY
  // ═════════════════════════════════════════════════════════════

  console.log("\n" + "═".repeat(72));
  console.log(" ✅ DEPLOYMENT COMPLETE");
  console.log("═".repeat(72));
  console.log(` Whitelist          ${whitelist.address}`);
  console.log(` GameToken          ${gameToken.address}`);
  console.log(` GameNFTPredefined  ${nftPredefined.address}`);
  console.log(` GameNFTCustom      ${nftCustom.address}`);
  console.log(` TokenMarketplace   ${marketplace.address}`);
  console.log(` TrackingContract   ${tracking.address}`);
  console.log(` ETHFaucet          ${faucet.address}`);
  console.log("═".repeat(72));

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(` Spent:      ${ethers.formatEther(balance - finalBalance)} ETH`);
  console.log(` Remaining:  ${ethers.formatEther(finalBalance)} ETH`);
  console.log("═".repeat(72));
  console.log("\n📋 Next steps:");
  console.log("   1. Copy ./deployed/addresses.json to /educhain/src/contracts/addresses.json");
  console.log("   2. Copy ABIs from ./abi/*.json to /educhain/src/contracts/abis/");
  console.log("   3. cd /educhain && npm run build && sudo systemctl restart educhain");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(err);
    process.exit(1);
  });
