// EduChain — deploy CertificateRegistry and wire the issuer key (2026-10-31).
//
//   npx hardhat run scripts/deploy-certificates.js --network gemba
//
// IDEMPOTENT by design: if deployed/latest.json already names a CertificateRegistry that really has
// code on-chain, the script changes nothing and exits 0. That is what makes it usable as part of the
// "the chain was restarted, bring everything back" procedure (see redeploy-all.sh) rather than a
// one-shot that nobody dares run twice.
//
// ROLES, kept apart on purpose:
//   owner  = the existing cold deployer/owner of the other seven contracts. Appoints the issuer,
//            revokes certificates, sets the base URI.
//   issuer = CERT_ISSUER_PRIVATE_KEY from blockchain/.env — a HOT key on the server whose only
//            power is issue(). It is funded with a small amount of GMB from the owner, because gas
//            on GembaBlockchain is negligible and a hot key should never hold a balance that would
//            hurt to lose.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

const ROOT = path.join(__dirname, "..");
const LATEST = path.join(ROOT, "deployed", "latest.json");
const FRONTEND_ADDRS = path.join(ROOT, "..", "src", "contracts", "addresses.json");
const BASE_URI = process.env.CERT_BASE_URI || "https://educhain.gembait.com/api/certificates/token/";
const ISSUER_TOPUP = ethers.parseEther(process.env.CERT_ISSUER_TOPUP || "50");
const ISSUER_FLOOR = ethers.parseEther(process.env.CERT_ISSUER_FLOOR || "10");

const log = (...a) => console.log(...a);

async function main() {
  const net = await ethers.provider.getNetwork();
  if (Number(net.chainId) !== 821207) {
    throw new Error(`refusing to run on chainId ${net.chainId} — this script is for GembaBlockchain testnet 821207 only`);
  }

  const [owner] = await ethers.getSigners();
  const issuerPk = process.env.CERT_ISSUER_PRIVATE_KEY;
  if (!issuerPk) throw new Error("CERT_ISSUER_PRIVATE_KEY is missing from blockchain/.env — run make-issuer first");
  const issuerAddr = new ethers.Wallet(issuerPk).address;

  log(`network  gemba (${net.chainId})`);
  log(`owner    ${owner.address}  ${ethers.formatEther(await ethers.provider.getBalance(owner.address))} GMB`);
  log(`issuer   ${issuerAddr}  ${ethers.formatEther(await ethers.provider.getBalance(issuerAddr))} GMB`);

  const deployed = JSON.parse(fs.readFileSync(LATEST, "utf8"));

  // ── already there? ──────────────────────────────────────────────────────────────────────────
  const existing = deployed.contracts?.CertificateRegistry?.address;
  if (existing && (await ethers.provider.getCode(existing)) !== "0x") {
    log(`\nCertificateRegistry is already deployed at ${existing} and has code — nothing to do.`);
    const reg = await ethers.getContractAt("CertificateRegistry", existing);
    log(`  owner  ${await reg.owner()}`);
    log(`  issuer ${await reg.issuer()}`);
    log(`  issued ${await reg.totalIssued()} · valid ${await reg.validCount()}`);
    await topUpIssuer(owner, issuerAddr);
    return;
  }
  if (existing) log(`\ndeployed/latest.json names ${existing} but it has NO code (chain restarted?) — deploying afresh.`);

  // ── fund the hot key BEFORE it is needed ────────────────────────────────────────────────────
  await topUpIssuer(owner, issuerAddr);

  // ── deploy ──────────────────────────────────────────────────────────────────────────────────
  log(`\ndeploying CertificateRegistry(owner=${owner.address}, issuer=${issuerAddr}, baseURI=${BASE_URI})`);
  const F = await ethers.getContractFactory("CertificateRegistry");
  const reg = await F.deploy(owner.address, issuerAddr, BASE_URI);
  await reg.waitForDeployment();
  const addr = await reg.getAddress();
  const tx = reg.deploymentTransaction();
  const rc = await tx.wait();
  log(`  deployed at ${addr}`);
  log(`  tx ${tx.hash}  block ${rc.blockNumber}`);

  // ── prove it, from the chain, before writing anything down ──────────────────────────────────
  const checks = {
    code: (await ethers.provider.getCode(addr)) !== "0x",
    owner: (await reg.owner()) === owner.address,
    issuer: (await reg.issuer()) === issuerAddr,
    baseURI: (await reg.baseURI()) === BASE_URI,
    empty: (await reg.totalIssued()) === 0n,
    name: (await reg.name()) === "EduChain Certificate",
  };
  log("  on-chain checks:", JSON.stringify(checks));
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length) throw new Error(`post-deploy verification failed: ${bad.join(", ")}`);

  // ── record it ───────────────────────────────────────────────────────────────────────────────
  deployed.contracts.CertificateRegistry = {
    address: addr,
    args: [owner.address, issuerAddr, BASE_URI],
    txHash: tx.hash,
    blockNumber: rc.blockNumber,
    type: "soulbound ERC-721 + public registry — course certificates; only a content HASH on-chain, no personal data",
    verified: `https://testnet.gembascan.io/address/${addr}#code`,
  };
  deployed.configuration = deployed.configuration || {};
  deployed.configuration.certificateIssuer =
    `${issuerAddr} — HOT key on the server (blockchain/.env CERT_ISSUER_PRIVATE_KEY); may ONLY call issue(). Revocation and role changes are owner-only.`;
  deployed.configuration.certificateBaseURI = BASE_URI;
  fs.writeFileSync(LATEST, JSON.stringify(deployed, null, 2) + "\n");
  log(`  recorded in ${LATEST}`);

  if (fs.existsSync(FRONTEND_ADDRS)) {
    const fa = JSON.parse(fs.readFileSync(FRONTEND_ADDRS, "utf8"));
    fa.certificateRegistry = addr;
    fs.writeFileSync(FRONTEND_ADDRS, JSON.stringify(fa, null, 2) + "\n");
    log(`  recorded in ${FRONTEND_ADDRS}`);
  }

  // ── verify the source on GembaScan (Blockscout) ─────────────────────────────────────────────
  try {
    log("\nverifying on GembaScan…");
    await hre.run("verify:verify", { address: addr, constructorArguments: [owner.address, issuerAddr, BASE_URI] });
    log("  verified");
  } catch (e) {
    log(`  verification did not complete: ${e.message.split("\n")[0]}`);
    log("  (re-runnable: npx hardhat verify --network gemba " + addr + " " + owner.address + " " + issuerAddr + ' "' + BASE_URI + '"');
  }

  log(`\nDONE. CertificateRegistry ${addr}`);
}

async function topUpIssuer(owner, issuerAddr) {
  const bal = await ethers.provider.getBalance(issuerAddr);
  if (bal >= ISSUER_FLOOR) {
    log(`issuer balance ${ethers.formatEther(bal)} GMB >= floor ${ethers.formatEther(ISSUER_FLOOR)} — no top-up needed`);
    return;
  }
  log(`topping the issuer up with ${ethers.formatEther(ISSUER_TOPUP)} GMB (balance was ${ethers.formatEther(bal)})`);
  const tx = await owner.sendTransaction({ to: issuerAddr, value: ISSUER_TOPUP });
  const rc = await tx.wait();
  log(`  tx ${tx.hash}  block ${rc.blockNumber}  new balance ${ethers.formatEther(await ethers.provider.getBalance(issuerAddr))} GMB`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
