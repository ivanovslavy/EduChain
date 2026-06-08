const hre = require("hardhat");
async function main() {
  const ADDR = "0xba17A76635B4069BF8ca9E3516225a6A1a6e15a3"; // GameNFTCustom
  const nft = await hre.ethers.getContractAt("GameNFTCustom", ADDR);
  const [s] = await hre.ethers.getSigners();
  console.log("signer:", await s.getAddress(), "owner:", await nft.owner());
  console.log("maxBatchSize before:", (await nft.maxBatchSize()).toString());
  const tx = await nft.setMaxBatchSize(3); console.log("tx:", tx.hash); await tx.wait();
  console.log("maxBatchSize AFTER:", (await nft.maxBatchSize()).toString());
}
main().catch((e)=>{console.error(e.message||e);process.exit(1);});
