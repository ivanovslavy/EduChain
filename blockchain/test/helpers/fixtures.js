// Full EduChain ecosystem fixture — mirrors scripts/deploy.js 1:1 so the tests
// exercise the exact deployed configuration (same constructor args, same wiring).
const { ethers } = require("hardhat");

const CONFIG = {
  gameTokenName: "EduChain Game Token",
  gameTokenSymbol: "GAME",
  gameTokenPrice: ethers.parseEther("0.01"),

  predefinedName: "EduChain Predefined NFTs",
  predefinedSymbol: "EDUP",
  predefinedBaseURI: "ipfs://base-predefined/",
  predefinedPrice: ethers.parseEther("0.01"),
  predefinedMaxSupply: 50n,

  customName: "EduChain Custom NFTs",
  customSymbol: "EDUC",
  customBaseURI: "ipfs://base-custom/",
  customEthPrice: ethers.parseEther("0.03"),
  customTokenPrice: ethers.parseEther("1"), // 1 GAME per NFT

  faucetClaimAmount: ethers.parseEther("0.05"),
  faucetCooldown: 24n * 60n * 60n,
  faucetInitialFund: ethers.parseEther("0.1"),
};

/**
 * Deploys the whole ecosystem and returns every handle + named signers.
 * signers: owner (deployer/owner of all 7), admin (whitelist admin/teacher),
 * alice/bob/carol (whitelisted users), mallory (whitelisted attacker),
 * outsider (NOT whitelisted).
 */
async function deployEcosystem() {
  const [owner, admin, alice, bob, carol, mallory, outsider] = await ethers.getSigners();

  const Whitelist = await ethers.getContractFactory("Whitelist");
  const whitelist = await Whitelist.deploy(owner.address);

  const GameToken = await ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy(
    CONFIG.gameTokenName, CONFIG.gameTokenSymbol,
    await whitelist.getAddress(), owner.address, CONFIG.gameTokenPrice
  );

  const GameNFTPredefined = await ethers.getContractFactory("GameNFTPredefined");
  const nftPredefined = await GameNFTPredefined.deploy(
    CONFIG.predefinedName, CONFIG.predefinedSymbol, CONFIG.predefinedBaseURI,
    await whitelist.getAddress(), owner.address, CONFIG.predefinedPrice, CONFIG.predefinedMaxSupply
  );

  const GameNFTCustom = await ethers.getContractFactory("GameNFTCustom");
  const nftCustom = await GameNFTCustom.deploy(
    CONFIG.customName, CONFIG.customSymbol, CONFIG.customBaseURI,
    await whitelist.getAddress(), owner.address, CONFIG.customEthPrice, CONFIG.customTokenPrice
  );

  const TokenMarketplace = await ethers.getContractFactory("TokenMarketplace");
  const marketplace = await TokenMarketplace.deploy(await whitelist.getAddress(), owner.address);

  const TrackingContract = await ethers.getContractFactory("TrackingContract");
  const tracking = await TrackingContract.deploy(
    await whitelist.getAddress(), await gameToken.getAddress(),
    await nftPredefined.getAddress(), await nftCustom.getAddress(), owner.address
  );

  const ETHFaucet = await ethers.getContractFactory("ETHFaucet");
  const faucet = await ETHFaucet.deploy(
    await whitelist.getAddress(), owner.address, CONFIG.faucetClaimAmount, CONFIG.faucetCooldown
  );

  // Post-deploy wiring (exactly as deploy.js).
  await nftCustom.connect(owner).setPaymentToken(await gameToken.getAddress());
  await owner.sendTransaction({ to: await faucet.getAddress(), value: CONFIG.faucetInitialFund });

  // Actor setup: admin as teacher; alice/bob/carol/mallory whitelisted; outsider NOT.
  await whitelist.connect(owner).addAdmin(admin.address);
  await whitelist.connect(owner).batchAddToWhitelist([
    alice.address, bob.address, carol.address, mallory.address,
  ]);

  return {
    CONFIG, whitelist, gameToken, nftPredefined, nftCustom, marketplace, tracking, faucet,
    owner, admin, alice, bob, carol, mallory, outsider,
  };
}

/** Helper: whitelisted user buys `n` whole GAME tokens (n <= 3 per limits). */
async function buyGame(gameToken, user, n) {
  const price = await gameToken.tokenPrice();
  await gameToken.connect(user).buyTokens(n, { value: price * BigInt(n) });
}

module.exports = { deployEcosystem, buyGame, CONFIG };
