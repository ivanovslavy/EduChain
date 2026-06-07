const hre = require("hardhat");
const { ethers } = hre;
const d = require("../deployed/latest.json");

const ABI = (n) => { const j = require(`../abi/${n}.json`); return Array.isArray(j) ? j : j.abi; };

(async () => {
  const [owner] = await ethers.getSigners();
  const provider = ethers.provider;
  console.log("owner (founder):", owner.address);

  const whitelist = new ethers.Contract(d.contracts.Whitelist.address, ABI("Whitelist"), owner);
  const faucetAddr = d.contracts.ETHFaucet.address;
  const nftAddr = d.contracts.GameNFTPredefined.address;

  // fresh student wallet with ZERO GMB
  const student = ethers.Wallet.createRandom().connect(provider);
  console.log("student:", student.address, "balance:", ethers.formatEther(await provider.getBalance(student.address)), "GMB");

  console.log("1) owner whitelists student...");
  await (await whitelist.addToWhitelist(student.address, { gasPrice: 0n })).wait();
  console.log("   whitelisted:", await whitelist.isWhitelisted(student.address));

  console.log("2) student claims faucet with 0 GMB (free gas)...");
  const faucet = new ethers.Contract(faucetAddr, ABI("ETHFaucet"), student);
  await (await faucet.claim({ gasPrice: 0n })).wait();
  const bal = await provider.getBalance(student.address);
  console.log("   student balance after claim:", ethers.formatEther(bal), "GMB");

  console.log("3) student mints a predefined NFT...");
  const nft = new ethers.Contract(nftAddr, ABI("GameNFTPredefined"), student);
  const price = await nft.mintPrice();
  console.log("   mintPrice:", ethers.formatEther(price), "GMB");
  await (await nft.mint(student.address, 1n, { value: price, gasPrice: 0n })).wait();
  const nftBal = await nft.balanceOf(student.address);
  console.log("   student NFT balance:", nftBal.toString());

  console.log(nftBal >= 1n && bal > 0n ? "\n✅ E2E PASSED: 0-GMB student whitelisted → claimed → minted (free gas)" : "\n❌ FAIL");
  process.exit(nftBal >= 1n ? 0 : 1);
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
