const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = (a) => ethers.provider.getBalance(a);
  const faucetAt = (a) => ethers.getContractAt("ETHFaucet", a, deployer);

  const OLD_FAUCET = "0x6056Cb44e9C6A429D45BBaC254FbD2D8CDa40D47";
  const TEST_FAUCETS = [
    "0x8ae321e5e050E8ff41136BEbBD482E34dfD7963c",
    "0x36C6AF33C14a3373F807DCF82D57936d8C3a7cC9",
  ];
  const NEW_FAUCET = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed", "addresses.json"), "utf8")
  ).ethFaucet;

  console.log("deployer", deployer.address);
  console.log("new production faucet", NEW_FAUCET);

  const oldBal = await bal(OLD_FAUCET);
  console.log("\nold production faucet balance:", ethers.formatEther(oldBal), "GMB");
  if (oldBal > 0n) {
    await (await (await faucetAt(OLD_FAUCET)).emergencyWithdrawAll()).wait();
    console.log("  -> drained to deployer");
  }

  let recovered = 0n;
  for (const f of TEST_FAUCETS) {
    const b = await bal(f);
    if (b > 0n) {
      try { await (await (await faucetAt(f)).emergencyWithdrawAll()).wait(); recovered += b; console.log("recovered test faucet", f, ethers.formatEther(b), "GMB"); }
      catch (e) { console.log("skip", f, e.message.split("\n")[0]); }
    }
  }
  console.log("total test GMB recovered:", ethers.formatEther(recovered), "GMB");

  const target = ethers.parseEther("100.1"); // match the liquidity the old faucet held
  const cur = await bal(NEW_FAUCET);
  if (cur < target) {
    const top = target - cur;
    await (await deployer.sendTransaction({ to: NEW_FAUCET, value: top })).wait();
    console.log("\ntopped up new faucet by", ethers.formatEther(top), "GMB");
  }
  console.log("new faucet balance:", ethers.formatEther(await bal(NEW_FAUCET)), "GMB");
  console.log("old faucet balance:", ethers.formatEther(await bal(OLD_FAUCET)), "GMB");
}
main().catch((e) => { console.error(e); process.exit(1); });
