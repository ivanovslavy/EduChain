const hre = require("hardhat");
async function main() {
  const ADDR = "0x1113D032460A55Fb91808BD07566397502185012";
  const TARGET = 10000n; // match the Sepolia collection cap
  const nft = await hre.ethers.getContractAt("GameNFTPredefined", ADDR);
  const [signer] = await hre.ethers.getSigners();
  const me = await signer.getAddress();
  const owner = await nft.owner();
  console.log("signer:", me, "| owner:", owner, "| match:", me.toLowerCase() === owner.toLowerCase());
  console.log("maxSupply before:", (await nft.maxSupply()).toString(), "| totalMinted:", (await nft.totalSupply()).toString());
  if (me.toLowerCase() !== owner.toLowerCase()) { console.log("NOT OWNER — aborting"); process.exit(2); }
  const tx = await nft.setMaxSupply(TARGET);
  console.log("tx:", tx.hash); await tx.wait();
  console.log("maxSupply AFTER:", (await nft.maxSupply()).toString());
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
