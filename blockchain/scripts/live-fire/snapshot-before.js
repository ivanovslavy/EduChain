// Read-only pre-flight: proves the live-fire run does NOT touch production.
// Records chainId + the live EduChain contract addresses & owners.
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`network: ${network.name}  chainId: ${net.chainId}`);

  const deployedPath = path.join(__dirname, "..", "..", "deployed", "latest.json");
  const prod = JSON.parse(fs.readFileSync(deployedPath, "utf8"));

  const snap = { chainId: Number(net.chainId), network: network.name, production: {} };
  for (const [name, info] of Object.entries(prod.contracts)) {
    const row = { address: info.address };
    try {
      const c = await ethers.getContractAt("Whitelist", info.address); // any Ownable ABI exposes owner()
      row.owner = await c.owner();
    } catch (_) { row.owner = "n/a"; }
    snap.production[name] = row;
    console.log(`  ${name.padEnd(20)} ${info.address}  owner=${row.owner}`);
  }

  const out = path.join(__dirname, "snapshot-before.json");
  fs.writeFileSync(out, JSON.stringify(snap, null, 2));
  console.log(`\nwrote ${out}`);
  console.log("These production addresses must be byte-identical in snapshot-after.");
}

main().catch((e) => { console.error(e); process.exit(1); });
