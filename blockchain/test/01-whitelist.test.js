const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem } = require("./helpers/fixtures");

describe("Whitelist", () => {
  describe("admin management (onlyOwner)", () => {
    it("owner adds/removes admins; events fire", async () => {
      const { whitelist, owner, outsider } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(owner).addAdmin(outsider.address))
        .to.emit(whitelist, "AdminAdded").withArgs(outsider.address, owner.address);
      expect(await whitelist.isAdmin(outsider.address)).to.equal(true);
      await expect(whitelist.connect(owner).removeAdmin(outsider.address))
        .to.emit(whitelist, "AdminRemoved");
    });
    it("non-owner cannot add admins", async () => {
      const { whitelist, admin, outsider } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(admin).addAdmin(outsider.address))
        .to.be.revertedWithCustomError(whitelist, "OwnableUnauthorizedAccount");
    });
    it("addAdmin rejects zero + duplicate", async () => {
      const { whitelist, owner, admin } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(owner).addAdmin(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(whitelist, "ZeroAddress");
      await expect(whitelist.connect(owner).addAdmin(admin.address))
        .to.be.revertedWithCustomError(whitelist, "AlreadyAdmin");
    });
  });

  describe("whitelist management (owner or admin)", () => {
    it("admin (teacher) can add/remove whitelist entries", async () => {
      const { whitelist, admin, outsider } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(admin).addToWhitelist(outsider.address))
        .to.emit(whitelist, "Whitelisted");
      expect(await whitelist.checkWhitelist(outsider.address)).to.equal(true);
      await whitelist.connect(admin).removeFromWhitelist(outsider.address);
      expect(await whitelist.checkWhitelist(outsider.address)).to.equal(false);
    });
    it("a plain user cannot touch the whitelist", async () => {
      const { whitelist, alice, outsider } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(alice).addToWhitelist(outsider.address))
        .to.be.revertedWithCustomError(whitelist, "NotAuthorized");
    });
    it("batchAdd enforces MAX_BATCH_SIZE and rejects empty", async () => {
      const { whitelist, owner } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(owner).batchAddToWhitelist([]))
        .to.be.revertedWithCustomError(whitelist, "EmptyBatch");
      const tooMany = Array.from({ length: 201 }, () => ethers.Wallet.createRandom().address);
      await expect(whitelist.connect(owner).batchAddToWhitelist(tooMany))
        .to.be.revertedWithCustomError(whitelist, "BatchTooLarge");
    });
    it("batchAdd skips zero/blacklisted/duplicates and counts the rest", async () => {
      const { whitelist, owner, alice } = await loadFixture(deployEcosystem);
      const fresh = ethers.Wallet.createRandom().address;
      await whitelist.connect(owner).addToBlacklist(alice.address);
      // alice already blacklisted; alice again duplicate; zero; fresh new.
      await expect(whitelist.connect(owner).batchAddToWhitelist([alice.address, ethers.ZeroAddress, fresh]))
        .to.emit(whitelist, "BatchWhitelisted").withArgs(1, owner.address);
      expect(await whitelist.checkWhitelist(fresh)).to.equal(true);
      expect(await whitelist.isWhitelisted(alice.address)).to.equal(false);
    });
  });

  describe("blacklist (owner only) — override semantics", () => {
    it("blacklisting evicts from the active whitelist but keeps ever-whitelisted", async () => {
      const { whitelist, owner, alice } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(owner).addToBlacklist(alice.address))
        .to.emit(whitelist, "Unwhitelisted").and.to.emit(whitelist, "Blacklisted");
      expect(await whitelist.checkWhitelist(alice.address)).to.equal(false);
      expect(await whitelist.wasEverWhitelisted(alice.address)).to.equal(true);
    });
    it("un-blacklisting does NOT auto-restore whitelist", async () => {
      const { whitelist, owner, alice } = await loadFixture(deployEcosystem);
      await whitelist.connect(owner).addToBlacklist(alice.address);
      await whitelist.connect(owner).removeFromBlacklist(alice.address);
      expect(await whitelist.checkWhitelist(alice.address)).to.equal(false);
      expect(await whitelist.isWhitelisted(alice.address)).to.equal(false);
    });
    it("admin CANNOT blacklist (owner-only)", async () => {
      const { whitelist, admin, alice } = await loadFixture(deployEcosystem);
      await expect(whitelist.connect(admin).addToBlacklist(alice.address))
        .to.be.revertedWithCustomError(whitelist, "OwnableUnauthorizedAccount");
    });
    it("cannot whitelist a blacklisted user via addToWhitelist", async () => {
      const { whitelist, owner, admin, alice } = await loadFixture(deployEcosystem);
      await whitelist.connect(owner).addToBlacklist(alice.address);
      await expect(whitelist.connect(admin).addToWhitelist(alice.address))
        .to.be.revertedWithCustomError(whitelist, "IsBlacklisted");
    });
  });

  describe("A4 FIX — a blacklisted admin loses admin power", () => {
    it("a blacklisted admin can no longer modify the whitelist", async () => {
      const { whitelist, owner, admin, outsider } = await loadFixture(deployEcosystem);
      await whitelist.connect(owner).addToBlacklist(admin.address);
      await expect(whitelist.connect(admin).addToWhitelist(outsider.address))
        .to.be.revertedWithCustomError(whitelist, "NotAuthorized");
      // un-blacklisting restores the admin's power
      await whitelist.connect(owner).removeFromBlacklist(admin.address);
      await expect(whitelist.connect(admin).addToWhitelist(outsider.address)).to.not.be.reverted;
    });
  });

  describe("pagination + views", () => {
    it("getWhitelistedPaginated returns a gap-free page and total", async () => {
      const { whitelist } = await loadFixture(deployEcosystem);
      const [page, total] = await whitelist.getWhitelistedPaginated(0, 10);
      expect(total).to.equal(4n); // alice, bob, carol, mallory
      expect(page.length).to.equal(4);
    });
    it("getAdmins overflow (start+limit wraps) reverts — view DoS note", async () => {
      // Overflow only reachable when start < total; add a 2nd admin so start=1 < total=2.
      const { whitelist, owner, bob } = await loadFixture(deployEcosystem);
      await whitelist.connect(owner).addAdmin(bob.address);
      await expect(whitelist.getAdmins(1, ethers.MaxUint256)).to.be.reverted;
    });
  });

  it("renounceOwnership is disabled", async () => {
    const { whitelist, owner } = await loadFixture(deployEcosystem);
    await expect(whitelist.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(whitelist, "NotAuthorized");
  });
});
