// Real on-chain adversarial run on the FRESH gemba-testnet deployment.
// The deployer (funded, owner of the fresh contracts) acts as the intermediate
// distributor: it provisions gas to freshly-generated actor wallets and
// whitelists them, then every scenario runs as real broadcast transactions.
//
// Prints DEFEATED (guard held) / CONFIRMED (exploit succeeded) per case, matching
// the local Hardhat suite (test/08-attacks.test.js).
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const P = (n) => ethers.parseEther(n);
const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? " — " + detail : ""}`);
}

async function fund(from, to, amount) {
  await (await from.sendTransaction({ to, value: amount })).wait();
}

async function main() {
  const dep = path.join(__dirname, "live-fire-deployed.json");
  const D = JSON.parse(fs.readFileSync(dep, "utf8")).contracts;
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  console.log(`network ${network.name}  distributor(deployer) ${deployer.address}`);

  const at = async (name, addr) => ethers.getContractAt(name, addr, deployer);
  const wl = await at("Whitelist", D.Whitelist);
  const gt = await at("GameToken", D.GameToken);
  const nc = await at("GameNFTCustom", D.GameNFTCustom);
  const mk = await at("TokenMarketplace", D.TokenMarketplace);
  const fa = await at("ETHFaucet", D.ETHFaucet);

  // ── actors: fresh wallets connected to the provider ──────────────────────
  const mk_ = (label) => { const w = ethers.Wallet.createRandom().connect(provider); w.label = label; return w; };
  const admin = mk_("admin"), alice = mk_("alice"), bob = mk_("bob"),
        mallory = mk_("mallory"), outsider = mk_("outsider");
  const GAS = P("0.05");
  for (const a of [admin, alice, bob, mallory, outsider]) await fund(deployer, a.address, GAS);
  console.log("funded 5 actor wallets");

  // ── on-chain actor setup ─────────────────────────────────────────────────
  await (await wl.addAdmin(admin.address)).wait();
  await (await wl.batchAddToWhitelist([alice.address, bob.address, mallory.address])).wait();
  record("actor setup", "OK", "admin + 3 whitelisted, outsider excluded");

  // ── ATTACK 1: outsider is locked out ─────────────────────────────────────
  try {
    await (await fa.connect(outsider).claim()).wait();
    record("outsider faucet claim", "CONFIRMED", "outsider claimed (unexpected!)");
  } catch { record("outsider locked out", "DEFEATED", "claim reverted for non-whitelisted"); }

  // ── ATTACK 2: bait-and-switch with a fake ERC721 (expected CONFIRMED) ─────
  {
    const Mal = await ethers.getContractFactory("MaliciousERC721", deployer);
    const mal = await Mal.deploy(); await mal.waitForDeployment();
    await (await mal.setFakeOwner(mallory.address)).wait();
    await (await mk.connect(mallory).createERC721Listing(await mal.getAddress(), 0, P("0.001"), ethers.ZeroAddress)).wait();
    const before = await provider.getBalance(mallory.address);
    const id = (await mk.nextListingId()) - 1n;
    await (await mk.connect(bob).purchaseListing(id, { value: P("0.001") })).wait();
    const after = await provider.getBalance(mallory.address);
    if (after > before) record("bait-and-switch (fake NFT)", "CONFIRMED", "buyer paid, got no asset");
    else record("bait-and-switch (fake NFT)", "DEFEATED", "attacker not paid");
  }

  // ── ATTACK 3: reentrant faucet claimer (expected DEFEATED) ───────────────
  {
    const C = await ethers.getContractFactory("ReentrantClaimer", deployer);
    const c = await C.deploy(await fa.getAddress()); await c.waitForDeployment();
    await (await wl.addToWhitelist(await c.getAddress())).wait();
    await (await c.arm()).wait();
    try {
      await (await c.go()).wait();
      const rev = await c.reenterReverted();
      const got = await c.received();
      if (rev && got === (await fa.claimAmount())) record("reentrant faucet claim", "DEFEATED", "exactly one claim, re-entry reverted");
      else record("reentrant faucet claim", "CONFIRMED", `rev=${rev} got=${got}`);
    } catch (e) { record("reentrant faucet claim", "DEFEATED", "outer tx reverted"); }
  }

  // ── ATTACK 4: reentrant ERC20 into mintWithTokens (expected DEFEATED) ─────
  {
    const R = await ethers.getContractFactory("ReentrantERC20", deployer);
    const r = await R.deploy(); await r.waitForDeployment();
    await (await nc.setPaymentToken(await r.getAddress())).wait();
    const cost = await nc.tokenMintPrice();
    await (await r.mint(mallory.address, cost * 10n)).wait();
    await (await r.connect(mallory).approve(await nc.getAddress(), ethers.MaxUint256)).wait();
    await (await r.configure(await nc.getAddress(), mallory.address, "u")).wait();
    await (await r.arm()).wait();
    await (await nc.connect(mallory).mintWithTokens(mallory.address, 1, "u")).wait();
    const rev = await r.reenterReverted();
    const bal = await nc.balanceOf(mallory.address);
    if (rev && bal === 1n) record("reentrant ERC20 mint", "DEFEATED", "nested mint reverted, minted once");
    else record("reentrant ERC20 mint", "CONFIRMED", `rev=${rev} bal=${bal}`);
    await (await nc.setPaymentToken(await gt.getAddress())).wait(); // restore
  }

  // ── ATTACK 5: griefing — rejecting seller DoSes purchase (expected revert) ─
  {
    const M20 = await ethers.getContractFactory("MockERC20", deployer);
    const m20 = await M20.deploy(); await m20.waitForDeployment();
    const Rej = await ethers.getContractFactory("RejectingReceiver", deployer);
    const rej = await Rej.deploy(); await rej.waitForDeployment();
    await (await rej.setMkt(await mk.getAddress())).wait();
    await (await wl.addToWhitelist(await rej.getAddress())).wait();
    await (await m20.mint(await rej.getAddress(), P("10"))).wait();
    await (await rej.listERC20(await m20.getAddress(), P("10"), P("0.001"))).wait();
    const id = (await mk.nextListingId()) - 1n;
    try {
      await (await mk.connect(bob).purchaseListing(id, { value: P("0.001") })).wait();
      record("rejecting-seller griefing", "CONFIRMED", "purchase unexpectedly succeeded");
    } catch { record("rejecting-seller griefing", "DEFEATED", "purchase reverted (fail-closed); griefing noted"); }
  }

  // ── ATTACK 6: fee-on-transfer escrow drain (expected CONFIRMED) ──────────
  {
    const Fee = await ethers.getContractFactory("FeeOnTransferERC20", deployer);
    const fee = await Fee.deploy(1000); await fee.waitForDeployment(); // 10% fee
    const feeAddr = await fee.getAddress();
    const mkAddr = await mk.getAddress();
    // two whitelisted sellers escrow 100 each; mint is fee-free (from==0)
    for (const s of [alice, bob]) {
      await (await fee.mint(s.address, P("100"))).wait();
      await (await fee.connect(s).approve(mkAddr, P("100"))).wait();
      await (await mk.connect(s).createERC20Listing(feeAddr, P("100"), P("0.001"), ethers.ZeroAddress)).wait();
    }
    const bobListingId = (await mk.nextListingId()) - 1n;
    const aliceListingId = bobListingId - 1n;
    const escrow = await fee.balanceOf(mkAddr);
    const drift = escrow < P("200");
    // first purchase drains escrow further (outbound fee); second cannot be paid out
    await (await mk.connect(mallory).purchaseListing(aliceListingId, { value: P("0.001") })).wait();
    let secondReverted = false;
    try { await (await mk.connect(mallory).purchaseListing(bobListingId, { value: P("0.001") })).wait(); }
    catch { secondReverted = true; }
    if (drift && secondReverted)
      record("fee-on-transfer drain", "CONFIRMED", `escrow ${ethers.formatEther(escrow)} < 200 claimed; 2nd listing unredeemable`);
    else
      record("fee-on-transfer drain", "DEFEATED", `drift=${drift} secondReverted=${secondReverted}`);
  }

  // ── ATTACK 7: NFT sent directly into the marketplace is stuck (expected CONFIRMED) ─
  {
    const M721 = await ethers.getContractFactory("MockERC721", deployer);
    const nft = await M721.deploy(); await nft.waitForDeployment();
    const mkAddr = await mk.getAddress();
    await (await nft.mint(alice.address)).wait(); // token 0 to alice
    // alice safeTransfers it straight into the marketplace (no listing)
    await (await nft.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, mkAddr, 0)).wait();
    const owner0 = await nft.ownerOf(0);
    const activeAfter = await mk.activeListingsCount();
    const stuck = owner0.toLowerCase() === mkAddr.toLowerCase();
    // no listing exists for it and there is no owner rescue/sweep function → locked
    if (stuck) record("stuck NFT (no rescue)", "CONFIRMED", `NFT held by marketplace, activeListings=${activeAfter}, no sweep fn`);
    else record("stuck NFT (no rescue)", "DEFEATED", `owner=${owner0}`);
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) console.log(`  ${r.status.padEnd(10)} ${r.name}`);
  const out = path.join(__dirname, "attack-results.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
