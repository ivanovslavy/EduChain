const hre = require("hardhat");
const { ethers } = hre;
async function main() {
  const d = require("../deployed/latest.json");
  const a = d.addresses || Object.fromEntries(Object.entries(d.contracts).map(([k,v])=>[k,v.address]));
  const customArgs = d.contracts.GameNFTCustom.args; // same constructor args
  const [signer] = await ethers.getSigners();
  console.log("deployer:", await signer.getAddress());

  // 1) new GameNFTCustom
  const Custom = await ethers.getContractFactory("GameNFTCustom");
  const custom = await Custom.deploy(...customArgs);
  await custom.waitForDeployment();
  const customAddr = await custom.getAddress();
  console.log("NEW GameNFTCustom:", customAddr);

  // post-deploy wiring (mirror deploy.js)
  await (await custom.setPaymentToken(a.GameToken)).wait();
  console.log("  setPaymentToken(GameToken) ok");
  await (await custom.setMaxBatchSize(3)).wait();
  console.log("  setMaxBatchSize(3) ok");

  // 2) new TrackingContract pointing at the new custom (gameNFTCustom is immutable there)
  const trackArgs = [a.Whitelist, a.GameToken, a.GameNFTPredefined, customAddr, await signer.getAddress()];
  const Track = await ethers.getContractFactory("TrackingContract");
  const track = await Track.deploy(...trackArgs);
  await track.waitForDeployment();
  const trackAddr = await track.getAddress();
  console.log("NEW TrackingContract:", trackAddr);

  console.log("RESULT_JSON " + JSON.stringify({
    GameNFTCustom: { address: customAddr, args: customArgs },
    TrackingContract: { address: trackAddr, args: trackArgs },
  }));
}
main().catch((e)=>{console.error(e.message||e);process.exit(1);});
