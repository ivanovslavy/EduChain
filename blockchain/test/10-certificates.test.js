// CertificateRegistry — unit, access-control, attack and invariant tests (2026-10-31).
//
// What these tests are defending:
//   · a certificate that can be transferred or sold certifies nothing  → soulbound, every path
//   · a hot server key must not be able to revoke or re-point anything → role separation
//   · the same certificate must not exist twice                         → dataHash uniqueness
//   · no personal data on-chain                                         → only a hash is stored
//   · a verifier must get a straight answer for unknown serials too     → isValid/getCertificate
const { expect } = require("chai");
const { ethers } = require("hardhat");

const hashOf = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
const BASE = "https://educhain.gembait.com/api/certificates/token/";

describe("CertificateRegistry", function () {
  let owner, issuer, learner, other, attacker, reg;

  beforeEach(async function () {
    [owner, issuer, learner, other, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("CertificateRegistry");
    reg = await F.deploy(owner.address, issuer.address, BASE);
    await reg.waitForDeployment();
  });

  // ── 1. construction and roles ───────────────────────────────────────────────────────────────
  describe("construction", function () {
    it("sets the owner, the issuer and the base URI", async function () {
      expect(await reg.owner()).to.equal(owner.address);
      expect(await reg.issuer()).to.equal(issuer.address);
      expect(await reg.baseURI()).to.equal(BASE);
    });

    it("starts empty", async function () {
      expect(await reg.totalIssued()).to.equal(0n);
      expect(await reg.validCount()).to.equal(0n);
      expect(await reg.isValid(1)).to.equal(false);
    });

    it("has a name and a symbol", async function () {
      expect(await reg.name()).to.equal("EduChain Certificate");
      expect(await reg.symbol()).to.equal("EDUCERT");
    });
  });

  // ── 2. issuing ──────────────────────────────────────────────────────────────────────────────
  describe("issue", function () {
    it("the issuer can issue, and the serial starts at 1", async function () {
      const h = hashOf("cert-1");
      await expect(reg.connect(issuer).issue(learner.address, h, 1, 90))
        .to.emit(reg, "CertificateIssued");
      expect(await reg.totalIssued()).to.equal(1n);
      expect(await reg.ownerOf(1)).to.equal(learner.address);
      expect(await reg.isValid(1)).to.equal(true);
      expect(await reg.serialOfHash(h)).to.equal(1n);
    });

    it("records exactly the fields it should, and nothing else", async function () {
      const h = hashOf("cert-fields");
      await reg.connect(issuer).issue(learner.address, h, 7, 85);
      const c = await reg.getCertificate(1);
      expect(c.holder).to.equal(learner.address);
      expect(c.dataHash).to.equal(h);
      expect(c.courseId).to.equal(7n);
      expect(c.scorePct).to.equal(85n);
      expect(c.revoked).to.equal(false);
      expect(c.reasonCode).to.equal(0n);
      expect(c.revokedAt).to.equal(0n);
      expect(c.issuedAt).to.be.greaterThan(0n);
    });

    it("the OWNER cannot issue — the roles are separate", async function () {
      await expect(reg.connect(owner).issue(learner.address, hashOf("x"), 1, 90))
        .to.be.revertedWithCustomError(reg, "NotIssuer");
    });

    it("a stranger cannot issue", async function () {
      await expect(reg.connect(attacker).issue(attacker.address, hashOf("y"), 1, 100))
        .to.be.revertedWithCustomError(reg, "NotIssuer");
    });

    it("refuses the zero holder, the zero hash and a score above 100", async function () {
      await expect(reg.connect(issuer).issue(ethers.ZeroAddress, hashOf("a"), 1, 90))
        .to.be.revertedWithCustomError(reg, "ZeroHolder");
      await expect(reg.connect(issuer).issue(learner.address, ethers.ZeroHash, 1, 90))
        .to.be.revertedWithCustomError(reg, "ZeroHash");
      await expect(reg.connect(issuer).issue(learner.address, hashOf("b"), 1, 101))
        .to.be.revertedWithCustomError(reg, "ScoreOutOfRange");
    });

    it("refuses the SAME certificate twice and names the existing serial", async function () {
      const h = hashOf("the-same-certificate");
      await reg.connect(issuer).issue(learner.address, h, 1, 90);
      await expect(reg.connect(issuer).issue(other.address, h, 1, 90))
        .to.be.revertedWithCustomError(reg, "HashAlreadyIssued").withArgs(1n);
      expect(await reg.totalIssued()).to.equal(1n);
    });

    it("serials are sequential and never reused", async function () {
      for (let i = 1; i <= 5; i++) await reg.connect(issuer).issue(learner.address, hashOf("s" + i), 1, 80 + i);
      expect(await reg.totalIssued()).to.equal(5n);
      expect(await reg.balanceOf(learner.address)).to.equal(5n);
      for (let i = 1; i <= 5; i++) expect(await reg.ownerOf(i)).to.equal(learner.address);
    });

    it("a score of exactly 100 and of exactly 0 are both accepted", async function () {
      await reg.connect(issuer).issue(learner.address, hashOf("full"), 1, 100);
      await reg.connect(issuer).issue(learner.address, hashOf("zero"), 1, 0);
      expect((await reg.getCertificate(1)).scorePct).to.equal(100n);
      expect((await reg.getCertificate(2)).scorePct).to.equal(0n);
    });

    it("issuing is switched off when the issuer is address(0)", async function () {
      await reg.connect(owner).setIssuer(ethers.ZeroAddress);
      await expect(reg.connect(issuer).issue(learner.address, hashOf("off"), 1, 90))
        .to.be.revertedWithCustomError(reg, "NotIssuer");
    });
  });

  // ── 3. soulbound ────────────────────────────────────────────────────────────────────────────
  describe("soulbound", function () {
    beforeEach(async function () {
      await reg.connect(issuer).issue(learner.address, hashOf("soul"), 1, 90);
    });

    it("the holder cannot transfer it", async function () {
      await expect(reg.connect(learner).transferFrom(learner.address, other.address, 1))
        .to.be.revertedWithCustomError(reg, "SoulboundNonTransferable");
    });

    it("the holder cannot safeTransfer it either", async function () {
      await expect(reg.connect(learner)["safeTransferFrom(address,address,uint256)"](learner.address, other.address, 1))
        .to.be.revertedWithCustomError(reg, "SoulboundNonTransferable");
    });

    it("approve and setApprovalForAll are refused outright", async function () {
      await expect(reg.connect(learner).approve(other.address, 1))
        .to.be.revertedWithCustomError(reg, "SoulboundNonTransferable");
      await expect(reg.connect(learner).setApprovalForAll(other.address, true))
        .to.be.revertedWithCustomError(reg, "SoulboundNonTransferable");
      expect(await reg.isApprovedForAll(learner.address, other.address)).to.equal(false);
      expect(await reg.getApproved(1)).to.equal(ethers.ZeroAddress);
    });

    it("not even the owner of the contract can move it", async function () {
      await expect(reg.connect(owner).transferFrom(learner.address, other.address, 1))
        .to.be.reverted;
    });

    it("a marketplace that got an approval before (impossible) still could not pull it", async function () {
      // There is no path to an approval, so the test asserts the absence itself.
      await expect(reg.connect(other).transferFrom(learner.address, other.address, 1)).to.be.reverted;
      expect(await reg.ownerOf(1)).to.equal(learner.address);
    });
  });

  // ── 4. revocation ───────────────────────────────────────────────────────────────────────────
  describe("revoke / reinstate", function () {
    beforeEach(async function () {
      await reg.connect(issuer).issue(learner.address, hashOf("rev"), 3, 95);
    });

    it("the owner can revoke with a reason code, and the verifier sees it", async function () {
      await expect(reg.connect(owner).revoke(1, 2)).to.emit(reg, "CertificateRevoked");
      expect(await reg.isValid(1)).to.equal(false);
      const c = await reg.getCertificate(1);
      expect(c.revoked).to.equal(true);
      expect(c.reasonCode).to.equal(2n);
      expect(c.revokedAt).to.be.greaterThan(0n);
      expect(await reg.validCount()).to.equal(0n);
    });

    it("the certificate still EXISTS after revocation — it is invalid, not erased", async function () {
      await reg.connect(owner).revoke(1, 1);
      expect(await reg.ownerOf(1)).to.equal(learner.address);
      expect(await reg.totalIssued()).to.equal(1n);
      expect((await reg.getCertificate(1)).dataHash).to.equal(hashOf("rev"));
    });

    it("the ISSUER cannot revoke — a compromised hot key cannot erase history", async function () {
      await expect(reg.connect(issuer).revoke(1, 1))
        .to.be.revertedWithCustomError(reg, "OwnableUnauthorizedAccount");
    });

    it("the holder cannot revoke their own certificate", async function () {
      await expect(reg.connect(learner).revoke(1, 1)).to.be.reverted;
    });

    it("a reason code is required, and double revocation is refused", async function () {
      await expect(reg.connect(owner).revoke(1, 0)).to.be.revertedWithCustomError(reg, "ReasonRequired");
      await reg.connect(owner).revoke(1, 1);
      await expect(reg.connect(owner).revoke(1, 1)).to.be.revertedWithCustomError(reg, "AlreadyRevoked");
    });

    it("an unknown serial cannot be revoked", async function () {
      await expect(reg.connect(owner).revoke(999, 1)).to.be.revertedWithCustomError(reg, "UnknownCertificate");
    });

    it("the owner can reinstate, and both events stay in the log", async function () {
      await reg.connect(owner).revoke(1, 4);
      await expect(reg.connect(owner).reinstate(1)).to.emit(reg, "CertificateReinstated");
      expect(await reg.isValid(1)).to.equal(true);
      expect(await reg.validCount()).to.equal(1n);
      const c = await reg.getCertificate(1);
      expect(c.revoked).to.equal(false);
      expect(c.reasonCode).to.equal(0n);
      const issued = await reg.queryFilter(reg.filters.CertificateIssued());
      const revoked = await reg.queryFilter(reg.filters.CertificateRevoked());
      const back = await reg.queryFilter(reg.filters.CertificateReinstated());
      expect([issued.length, revoked.length, back.length]).to.deep.equal([1, 1, 1]);
    });

    it("reinstating something that is not revoked is refused", async function () {
      await expect(reg.connect(owner).reinstate(1)).to.be.revertedWithCustomError(reg, "NotRevoked");
    });
  });

  // ── 5. administration ───────────────────────────────────────────────────────────────────────
  describe("administration", function () {
    it("only the owner can change the issuer, and the event names both keys", async function () {
      await expect(reg.connect(attacker).setIssuer(attacker.address)).to.be.reverted;
      await expect(reg.connect(owner).setIssuer(other.address))
        .to.emit(reg, "IssuerChanged").withArgs(issuer.address, other.address);
      expect(await reg.issuer()).to.equal(other.address);
      await expect(reg.connect(issuer).issue(learner.address, hashOf("old-issuer"), 1, 90))
        .to.be.revertedWithCustomError(reg, "NotIssuer");
      await reg.connect(other).issue(learner.address, hashOf("new-issuer"), 1, 90);
      expect(await reg.totalIssued()).to.equal(1n);
    });

    it("only the owner can change the base URI, and tokenURI follows it", async function () {
      await reg.connect(issuer).issue(learner.address, hashOf("uri"), 1, 90);
      expect(await reg.tokenURI(1)).to.equal(BASE + "1");
      await expect(reg.connect(issuer).setBaseURI("https://evil/")).to.be.reverted;
      await reg.connect(owner).setBaseURI("https://educhain.gembait.com/api/certificates/token/v2/");
      expect(await reg.tokenURI(1)).to.equal("https://educhain.gembait.com/api/certificates/token/v2/1");
    });

    it("tokenURI of an unknown serial reverts rather than returning a guess", async function () {
      await expect(reg.tokenURI(42)).to.be.reverted;
    });

    it("an empty base URI yields an empty tokenURI, not a broken one", async function () {
      await reg.connect(owner).setBaseURI("");
      await reg.connect(issuer).issue(learner.address, hashOf("nouri"), 1, 90);
      expect(await reg.tokenURI(1)).to.equal("");
    });
  });

  // ── 6. what a verifier sees ─────────────────────────────────────────────────────────────────
  describe("verification", function () {
    it("getCertificate reverts for an unknown serial instead of returning zeros", async function () {
      await expect(reg.getCertificate(1)).to.be.revertedWithCustomError(reg, "UnknownCertificate");
    });

    it("isValid is false for unknown and for revoked alike", async function () {
      expect(await reg.isValid(0)).to.equal(false);
      expect(await reg.isValid(12345)).to.equal(false);
      await reg.connect(issuer).issue(learner.address, hashOf("v"), 1, 90);
      expect(await reg.isValid(1)).to.equal(true);
      await reg.connect(owner).revoke(1, 1);
      expect(await reg.isValid(1)).to.equal(false);
    });

    it("the content hash finds its serial — a presented PDF can be matched", async function () {
      const h = hashOf("Ivan Ivanov|Teacher|School 5|course-1|92|2026-10-31|bg|1");
      await reg.connect(issuer).issue(learner.address, h, 1, 92);
      expect(await reg.serialOfHash(h)).to.equal(1n);
      expect(await reg.serialOfHash(hashOf("tampered"))).to.equal(0n);
    });
  });

  // ── 7. invariants ───────────────────────────────────────────────────────────────────────────
  describe("invariants", function () {
    it("validCount always equals issued minus currently-revoked", async function () {
      const n = 8;
      for (let i = 1; i <= n; i++) await reg.connect(issuer).issue(learner.address, hashOf("inv" + i), 1, 80 + (i % 20));
      await reg.connect(owner).revoke(2, 1);
      await reg.connect(owner).revoke(5, 2);
      await reg.connect(owner).revoke(7, 3);
      await reg.connect(owner).reinstate(5);
      let valid = 0;
      for (let i = 1; i <= n; i++) if (await reg.isValid(i)) valid += 1;
      expect(await reg.validCount()).to.equal(BigInt(valid));
      expect(await reg.totalIssued()).to.equal(BigInt(n));
    });

    it("every issued serial has an owner and a non-zero hash", async function () {
      for (let i = 1; i <= 6; i++) await reg.connect(issuer).issue(i % 2 ? learner.address : other.address, hashOf("own" + i), 2, 90);
      const total = Number(await reg.totalIssued());
      for (let i = 1; i <= total; i++) {
        const c = await reg.getCertificate(i);
        expect(c.holder).to.not.equal(ethers.ZeroAddress);
        expect(c.dataHash).to.not.equal(ethers.ZeroHash);
        expect(await reg.ownerOf(i)).to.equal(c.holder);
      }
    });

    it("balanceOf never decreases — no transfer, no burn", async function () {
      await reg.connect(issuer).issue(learner.address, hashOf("b1"), 1, 90);
      await reg.connect(issuer).issue(learner.address, hashOf("b2"), 1, 90);
      const before = await reg.balanceOf(learner.address);
      await reg.connect(owner).revoke(1, 1);
      expect(await reg.balanceOf(learner.address)).to.equal(before);
      await expect(reg.connect(learner).transferFrom(learner.address, other.address, 2)).to.be.reverted;
      expect(await reg.balanceOf(learner.address)).to.equal(before);
    });

    it("hash -> serial and serial -> hash agree for every certificate", async function () {
      const hs = [];
      for (let i = 1; i <= 5; i++) { const h = hashOf("pair" + i); hs.push(h); await reg.connect(issuer).issue(learner.address, h, 1, 90); }
      for (let i = 0; i < hs.length; i++) {
        const serial = await reg.serialOfHash(hs[i]);
        expect(serial).to.equal(BigInt(i + 1));
        expect((await reg.getCertificate(serial)).dataHash).to.equal(hs[i]);
      }
    });
  });

  // ── 8. no personal data on-chain ────────────────────────────────────────────────────────────
  describe("privacy", function () {
    it("the whole storage of a certificate is a hash, two dates, a score and two small numbers", async function () {
      await reg.connect(issuer).issue(learner.address, hashOf("Ivan Ivanov"), 1, 90);
      const c = await reg.getCertificate(1);
      expect(Object.keys(c.toObject())).to.have.members(
        ["holder", "dataHash", "issuedAt", "courseId", "scorePct", "revoked", "reasonCode", "revokedAt"]);
    });

    it("no function accepts a string other than the base URI", async function () {
      const strTakers = reg.interface.fragments
        .filter((f) => f.type === "function" && f.inputs?.some((i) => i.type === "string"))
        .map((f) => f.name);
      expect(strTakers).to.deep.equal(["setBaseURI"]);
    });

    it("the raw storage slots of the record contain no readable text", async function () {
      const name = "Ivan Petrov Ivanov";
      await reg.connect(issuer).issue(learner.address, hashOf(name), 1, 90);
      const addr = await reg.getAddress();
      let found = false;
      for (let slot = 0; slot < 24; slot++) {
        const raw = await ethers.provider.getStorage(addr, slot);
        if (Buffer.from(raw.slice(2), "hex").toString("latin1").includes("Ivan")) found = true;
      }
      expect(found).to.equal(false);
    });
  });
});
