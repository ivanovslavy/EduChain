// Deploys a FRESH, isolated copy of the whole ecosystem + test helpers to the
// gemba testnet. Does not touch the production EduChain contracts.
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const P = (n) => ethers.parseEther(n);
const CONFIG = {
  gameTokenPrice: P("0.01"),
  predefinedBaseURI: "ipfs://livefire-predefined/",
  predefinedPrice: P("0.01"),
  predefinedMaxSupply: 50n,
  customBaseURI: "ipfs://livefire-custom/",
  customEthPrice: P("0.03"),
  customTokenPrice: P("1"),
  faucetClaimAmount: P("0.001"),
  faucetCooldown: 60n,               // short cooldown for the run
  faucetInitialFund: P("0.02"),
};

async function dep(name, ...args) {
  const f = await ethers.getContractFactory(name);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  const a = await c.getAddress();
  console.log(`  ${name.padEnd(20)} ${a}`);
  return c;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`network ${network.name} chainId ${net.chainId}`);
  console.log(`deployer ${deployer.address}  balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))}`);

  const wl = await dep("Whitelist", deployer.address);
  const gt = await dep("GameToken", "LiveFire GAME", "LGAME", await wl.getAddress(), deployer.address, CONFIG.gameTokenPrice);
  const np = await dep("GameNFTPredefined", "LF Predefined", "LFP", CONFIG.predefinedBaseURI, await wl.getAddress(), deployer.address, CONFIG.predefinedPrice, CONFIG.predefinedMaxSupply);
  const nc = await dep("GameNFTCustom", "LF Custom", "LFC", CONFIG.customBaseURI, await wl.getAddress(), deployer.address, CONFIG.customEthPrice, CONFIG.customTokenPrice);
  const mk = await dep("TokenMarketplace", await wl.getAddress(), deployer.address);
  const tr = await dep("TrackingContract", await wl.getAddress(), await gt.getAddress(), await np.getAddress(), await nc.getAddress(), deployer.address);
  const fa = await dep("ETHFaucet", await wl.getAddress(), deployer.address, CONFIG.faucetClaimAmount, CONFIG.faucetCooldown);

  // Test helpers / attackers
  const m20 = await dep("MockERC20");
  const m721 = await dep("MockERC721");

  console.log("wiring...");
  await (await nc.setPaymentToken(await gt.getAddress())).wait();
  await (await deployer.sendTransaction({ to: await fa.getAddress(), value: CONFIG.faucetInitialFund })).wait();

  const out = {
    chainId: Number(net.chainId), deployer: deployer.address,
    contracts: {
      Whitelist: await wl.getAddress(), GameToken: await gt.getAddress(),
      GameNFTPredefined: await np.getAddress(), GameNFTCustom: await nc.getAddress(),
      TokenMarketplace: await mk.getAddress(), TrackingContract: await tr.getAddress(),
      ETHFaucet: await fa.getAddress(), MockERC20: await m20.getAddress(), MockERC721: await m721.getAddress(),
    },
  };
  const p = path.join(__dirname, "live-fire-deployed.json");
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${p}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
