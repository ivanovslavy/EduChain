// EduChain certificates — the on-chain half.
//
// Two jobs, and they are kept apart on purpose:
//   issue()  — signs with the HOT issuer key, which can do nothing else (see CertificateRegistry).
//   read()   — a plain RPC read, used by the public /verify endpoint. The chain is AUTHORITATIVE for
//              whether a certificate is valid; the database only holds the readable fields and the
//              revocation reason that must never be written into a public chain.
//
// The issuer key is read from the environment at first use and never logged. If it is absent, the
// module says so loudly rather than quietly issuing certificates that exist only in our database —
// a certificate nobody can verify is worse than no certificate.
const { ethers } = require("ethers");

const RPCS = (process.env.CERT_RPC_URLS || "https://rpc1.gembascan.io,https://rpc2.gembascan.io")
  .split(",").map((s) => s.trim()).filter(Boolean);
const CHAIN_ID = parseInt(process.env.CERT_CHAIN_ID || "821207", 10);
const REGISTRY = process.env.CERT_REGISTRY_ADDRESS || "";
const ISSUER_PK = process.env.CERT_ISSUER_PRIVATE_KEY || "";

const ABI = [
  "function issue(address holder, bytes32 dataHash, uint16 courseId, uint16 scorePct) returns (uint256)",
  "function getCertificate(uint256 tokenId) view returns (address holder, bytes32 dataHash, uint64 issuedAt, uint16 courseId, uint16 scorePct, bool revoked, uint8 reasonCode, uint64 revokedAt)",
  "function isValid(uint256 tokenId) view returns (bool)",
  "function serialOfHash(bytes32 dataHash) view returns (uint256)",
  "function totalIssued() view returns (uint256)",
  "function validCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function issuer() view returns (address)",
  "event CertificateIssued(uint256 indexed tokenId, address indexed holder, bytes32 indexed dataHash, uint16 courseId, uint16 scorePct, uint64 issuedAt)",
];

let provider = null;

function getProvider() {
  if (provider) return provider;
  // FallbackProvider over the configured endpoints: one RPC going down must not stop verification.
  const configs = RPCS.map((url, i) => ({
    provider: new ethers.JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true }),
    priority: i + 1,
    stallTimeout: 4000,
    weight: 1,
  }));
  provider = configs.length > 1 ? new ethers.FallbackProvider(configs, CHAIN_ID, { quorum: 1 }) : configs[0].provider;
  return provider;
}

function configured() {
  return Boolean(REGISTRY) && ethers.isAddress(REGISTRY);
}
function canIssue() {
  return configured() && Boolean(ISSUER_PK);
}

function readContract() {
  if (!configured()) throw new Error("CERT_REGISTRY_ADDRESS is not set");
  return new ethers.Contract(REGISTRY, ABI, getProvider());
}

function writeContract() {
  if (!canIssue()) throw new Error("CERT_ISSUER_PRIVATE_KEY or CERT_REGISTRY_ADDRESS is missing");
  return new ethers.Contract(REGISTRY, ABI, new ethers.Wallet(ISSUER_PK, getProvider()));
}

/**
 * The hash that ties the PDF to the chain. Everything printed on the certificate goes in, in a
 * fixed order, so a changed name or a changed score produces a different hash and the chain
 * disagrees with the paper.
 */
function dataHash(c) {
  return ethers.keccak256(ethers.toUtf8Bytes([
    "educhain-certificate-v1",
    c.fullName,
    c.position,
    c.organisation,
    String(c.courseId),
    String(c.scorePct),
    c.issuedDate,
    c.lang,
    c.holder.toLowerCase(),
  ].join("")));
}

/** Issue on-chain. Returns {serial, txHash}. Throws if the chain refuses — the caller must not
 *  pretend a certificate exists when it does not. */
async function issue({ holder, hash, courseId, scorePct }) {
  const c = writeContract();
  const tx = await c.issue(holder, hash, courseId, scorePct);
  const rc = await tx.wait();
  // The serial comes from the event, not from a guess about the counter.
  const parsed = rc.logs
    .map((l) => { try { return c.interface.parseLog(l); } catch { return null; } })
    .find((p) => p && p.name === "CertificateIssued");
  if (!parsed) throw new Error("issue() mined but no CertificateIssued event was found");
  return { serial: Number(parsed.args.tokenId), txHash: tx.hash, blockNumber: rc.blockNumber };
}

/** What the chain says about a serial. Returns null when the serial does not exist on-chain. */
async function read(serial) {
  const c = readContract();
  try {
    const r = await c.getCertificate(serial);
    return {
      holder: r.holder,
      dataHash: r.dataHash,
      issuedAt: Number(r.issuedAt),
      courseId: Number(r.courseId),
      scorePct: Number(r.scorePct),
      revoked: r.revoked,
      reasonCode: Number(r.reasonCode),
      revokedAt: Number(r.revokedAt),
    };
  } catch {
    return null; // UnknownCertificate, or the RPC could not answer — the caller decides what to say
  }
}

async function health() {
  const out = { configured: configured(), canIssue: canIssue(), registry: REGISTRY, chainId: CHAIN_ID };
  if (!configured()) return out;
  try {
    const c = readContract();
    out.blockNumber = await getProvider().getBlockNumber();
    out.totalIssued = Number(await c.totalIssued());
    out.validCount = Number(await c.validCount());
    out.onChainIssuer = await c.issuer();
    out.owner = await c.owner();
    if (ISSUER_PK) {
      const me = new ethers.Wallet(ISSUER_PK).address;
      out.issuerAddress = me;
      out.issuerMatches = me.toLowerCase() === String(out.onChainIssuer).toLowerCase();
      out.issuerBalance = ethers.formatEther(await getProvider().getBalance(me));
    }
  } catch (e) {
    out.error = e.shortMessage || e.message;
  }
  return out;
}

/** Is this address the contract owner (the only key that may revoke)? */
async function isOwner(address) {
  if (!configured() || !ethers.isAddress(address)) return false;
  try {
    const o = await readContract().owner();
    return String(o).toLowerCase() === String(address).toLowerCase();
  } catch { return false; }
}

module.exports = { dataHash, issue, read, health, isOwner, configured, canIssue, REGISTRY, CHAIN_ID };
