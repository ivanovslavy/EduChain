const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem, buyGame } = require("./helpers/fixtures");

describe("TrackingContract", () => {
  it("computes points + tier live from balances", async () => {
    const { tracking, gameToken, nftPredefined, owner, alice } = await loadFixture(deployEcosystem);
    await buyGame(gameToken, alice, 3); // 3 whole GAME → 3 * pointsPerERC20(1) = 3
    await nftPredefined.connect(owner).setMaxMintsPer24Hours(1000);
    const price = await nftPredefined.mintPrice();
    await nftPredefined.connect(alice).mint(alice.address, 1, { value: price }); // +10
    const e = await tracking.getUserEntry(alice.address);
    expect(e.erc20Whole).to.equal(3n);
    expect(e.predefinedCount).to.equal(1n);
    expect(e.totalPoints).to.equal(13n);
    expect(e.tier).to.equal(1); // Bronze >=10
    expect(e.isCurrentlyWhitelisted).to.equal(true);
  });

  it("paginated leaderboard covers the ever-whitelisted set", async () => {
    const { tracking } = await loadFixture(deployEcosystem);
    const [entries, total] = await tracking.getLeaderboardPaginated(0, 100);
    expect(total).to.equal(4n);
    expect(entries.length).to.equal(4);
  });

  it("getEntriesBatch caps at MAX_BATCH_VIEW", async () => {
    const { tracking } = await loadFixture(deployEcosystem);
    const many = Array.from({ length: 501 }, () => ethers.Wallet.createRandom().address);
    await expect(tracking.getEntriesBatch(many)).to.be.revertedWithCustomError(tracking, "BatchTooLarge");
  });

  it("setTierThresholds enforces strict ordering", async () => {
    const { tracking, owner } = await loadFixture(deployEcosystem);
    await expect(tracking.connect(owner).setTierThresholds(10, 10, 20, 30))
      .to.be.revertedWithCustomError(tracking, "InvalidTierOrdering");
    await expect(tracking.connect(owner).setTierThresholds(1, 2, 3, 4)).to.not.be.reverted;
  });

  describe("A7 FIX — setPointsFormula bounds each weight", () => {
    it("a weight above MAX_POINTS_WEIGHT reverts; a bounded weight is accepted", async () => {
      const { tracking, owner } = await loadFixture(deployEcosystem);
      const cap = await tracking.MAX_POINTS_WEIGHT();
      await expect(tracking.connect(owner).setPointsFormula(2n ** 255n, 10, 30))
        .to.be.revertedWithCustomError(tracking, "InvalidWeight");
      await expect(tracking.connect(owner).setPointsFormula(cap + 1n, 1, 1))
        .to.be.revertedWithCustomError(tracking, "InvalidWeight");
      await expect(tracking.connect(owner).setPointsFormula(cap, 10, 30))
        .to.emit(tracking, "PointsFormulaChanged");
    });
  });

  it("owner-only config; renounce disabled", async () => {
    const { tracking, owner, alice } = await loadFixture(deployEcosystem);
    await expect(tracking.connect(alice).setPointsFormula(1, 1, 1))
      .to.be.revertedWithCustomError(tracking, "OwnableUnauthorizedAccount");
    await expect(tracking.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(tracking, "OwnershipNotRenounceable");
  });
});
