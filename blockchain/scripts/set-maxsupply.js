const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Raises the Predefined NFT hard cap to match the Kotkata metadata collection
// (0.json..9999.json = 10,000). Address comes from deployed/latest.json.
const TARGET = 10000n;

async function main() {
  const latest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed", "latest.json"), "utf8")
  );
  const ADDR = latest.contracts.GameNFTPredefined.address;
  const nft = await hre.ethers.getContractAt("GameNFTPredefined", ADDR);
  const [signer] = await hre.ethers.getSigners();
  const me = await signer.getAddress();
  const owner = await nft.owner();
  console.log("Predefined:", ADDR, "| signer:", me, "| owner-match:", me.toLowerCase() === owner.toLowerCase());
  console.log("maxSupply before:", (await nft.maxSupply()).toString(), "| totalMinted:", (await nft.totalSupply()).toString());
  if (me.toLowerCase() !== owner.toLowerCase()) { console.log("NOT OWNER — aborting"); process.exit(2); }
  if ((await nft.maxSupply()) === TARGET) { console.log("already", TARGET.toString(), "— skip"); return; }
  const tx = await nft.setMaxSupply(TARGET);
  console.log("tx:", tx.hash); await tx.wait();
  console.log("maxSupply AFTER:", (await nft.maxSupply()).toString());
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
