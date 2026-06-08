const hre = require("hardhat");
async function main() {
  const ADDR = "0x1113D032460A55Fb91808BD07566397502185012";
  const NEW = "ipfs://bafybeiaoqjtxd7ptabsz67afmenvuf45tgqlwgorjttkaz7zxkmvjuoeqa/";
  const nft = await hre.ethers.getContractAt("GameNFTPredefined", ADDR);
  const [s] = await hre.ethers.getSigners();
  console.log("signer:", await s.getAddress(), "owner:", await nft.owner());
  console.log("baseURI before:", await nft.baseURI());
  const tx = await nft.setBaseURI(NEW); console.log("tx:", tx.hash); await tx.wait();
  console.log("baseURI AFTER:", await nft.baseURI());
  console.log("tokenURI(1) AFTER:", await nft.tokenURI(1));
}
main().catch((e)=>{console.error(e.message||e);process.exit(1);});
