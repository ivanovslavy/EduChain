const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Sets the real metadata base URI on the live Predefined + Custom NFT contracts.
// Addresses come from deployed/latest.json so this always targets the current deploy.
// The Kotkata collection (10k Sphynx-cat metadata JSONs, <id>.json on IPFS/Filebase)
// matches the tokenURI scheme baseURI + tokenId + ".json".
const BASE_URI = "ipfs://bafybeiaoqjtxd7ptabsz67afmenvuf45tgqlwgorjttkaz7zxkmvjuoeqa/";

async function setOn(name, address) {
  const nft = await hre.ethers.getContractAt(name, address);
  const before = await nft.baseURI();
  if (before === BASE_URI) { console.log(`  ${name} @ ${address} already set — skip`); return; }
  const tx = await nft.setBaseURI(BASE_URI);
  await tx.wait();
  console.log(`  ${name} @ ${address}: baseURI -> ${await nft.baseURI()}  (tx ${tx.hash})`);
}

async function main() {
  const latest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed", "latest.json"), "utf8")
  );
  const c = latest.contracts;
  const [s] = await hre.ethers.getSigners();
  console.log("signer:", await s.getAddress());
  await setOn("GameNFTPredefined", c.GameNFTPredefined.address);
  await setOn("GameNFTCustom", c.GameNFTCustom.address);
  console.log("done.");
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
