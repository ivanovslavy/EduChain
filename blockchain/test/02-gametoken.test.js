const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem } = require("./helpers/fixtures");

const DAY = 24 * 60 * 60;

describe("GameToken", () => {
  it("initial supply minted to the contract; config sane", async () => {
    const { gameToken } = await loadFixture(deployEcosystem);
    expect(await gameToken.balanceOf(await gameToken.getAddress()))
      .to.equal(ethers.parseEther("1000000"));
    expect(await gameToken.maxTokensPerPurchase()).to.equal(3n);
  });

  describe("buyTokens happy path", () => {
    it("whitelisted user buys whole tokens, gets 1e18 units each, exact-pay", async () => {
      const { gameToken, alice } = await loadFixture(deployEcosystem);
      const price = await gameToken.tokenPrice();
      await expect(gameToken.connect(alice).buyTokens(2, { value: price * 2n }))
        .to.emit(gameToken, "TokensPurchased").withArgs(alice.address, 2, price * 2n);
      expect(await gameToken.balanceOf(alice.address)).to.equal(ethers.parseEther("2"));
    });
    it("refunds overpayment", async () => {
      const { gameToken, alice } = await loadFixture(deployEcosystem);
      const price = await gameToken.tokenPrice();
      const before = await ethers.provider.getBalance(alice.address);
      const tx = await gameToken.connect(alice).buyTokens(1, { value: price * 5n });
      const rc = await tx.wait();
      const after = await ethers.provider.getBalance(alice.address);
      // spent ≈ price + gas; refund of 4*price returned
      const spent = before - after;
      expect(spent).to.be.lt(price * 2n + rc.gasUsed * rc.gasPrice);
    });
  });

  describe("access & guards", () => {
    it("non-whitelisted cannot buy", async () => {
      const { gameToken, outsider } = await loadFixture(deployEcosystem);
      await expect(gameToken.connect(outsider).buyTokens(1, { value: await gameToken.tokenPrice() }))
        .to.be.revertedWithCustomError(gameToken, "NotWhitelisted");
    });
    it("zero amount / over per-purchase / underpay revert", async () => {
      const { gameToken, alice } = await loadFixture(deployEcosystem);
      const p = await gameToken.tokenPrice();
      await expect(gameToken.connect(alice).buyTokens(0, { value: 0 }))
        .to.be.revertedWithCustomError(gameToken, "ZeroAmount");
      await expect(gameToken.connect(alice).buyTokens(4, { value: p * 4n }))
        .to.be.revertedWithCustomError(gameToken, "ExceedsPerPurchaseLimit");
      await expect(gameToken.connect(alice).buyTokens(2, { value: p })) // underpay
        .to.be.revertedWithCustomError(gameToken, "InsufficientPayment");
    });
  });

  describe("rate limits (rolling 24h window)", () => {
    it("daily token cap blocks the 4th token; resets after 24h", async () => {
      const { gameToken, alice } = await loadFixture(deployEcosystem);
      const p = await gameToken.tokenPrice();
      await gameToken.connect(alice).buyTokens(3, { value: p * 3n }); // hits maxTokensPer24Hours=3
      await expect(gameToken.connect(alice).buyTokens(1, { value: p }))
        .to.be.revertedWithCustomError(gameToken, "ExceedsDailyTokenLimit");
      await time.increase(DAY + 1);
      await expect(gameToken.connect(alice).buyTokens(1, { value: p })).to.not.be.reverted;
    });
    it("daily BUY COUNT cap blocks the 4th tx even for 1-token buys", async () => {
      const { gameToken, owner, alice } = await loadFixture(deployEcosystem);
      // raise token cap so the buy-COUNT limit is the binding one
      await gameToken.connect(owner).setMaxTokensPer24Hours(100);
      const p = await gameToken.tokenPrice();
      for (let i = 0; i < 3; i++) await gameToken.connect(alice).buyTokens(1, { value: p });
      await expect(gameToken.connect(alice).buyTokens(1, { value: p }))
        .to.be.revertedWithCustomError(gameToken, "ExceedsDailyBuyCount");
    });
  });

  describe("owner config", () => {
    it("setters reject zero and are owner-gated; events fire", async () => {
      const { gameToken, owner, alice } = await loadFixture(deployEcosystem);
      await expect(gameToken.connect(owner).setTokenPrice(0)).to.be.revertedWithCustomError(gameToken, "InvalidPrice");
      await expect(gameToken.connect(alice).setTokenPrice(1)).to.be.revertedWithCustomError(gameToken, "OwnableUnauthorizedAccount");
      await expect(gameToken.connect(owner).setTokenPrice(123)).to.emit(gameToken, "TokenPriceChanged");
    });
    it("withdrawETH sends proceeds to owner; withdrawTokens moves pool tokens", async () => {
      const { gameToken, owner, alice } = await loadFixture(deployEcosystem);
      const p = await gameToken.tokenPrice();
      await gameToken.connect(alice).buyTokens(2, { value: p * 2n });
      await expect(gameToken.connect(owner).withdrawETH()).to.emit(gameToken, "EthWithdrawn");
      await expect(gameToken.connect(owner).withdrawTokens(ethers.parseEther("10")))
        .to.emit(gameToken, "TokensWithdrawn");
    });
  });

  describe("M1 FIX — mintToContract is capped by MAX_SUPPLY", () => {
    it("refills within the cap succeed; refills past MAX_SUPPLY revert", async () => {
      const { gameToken, owner } = await loadFixture(deployEcosystem);
      const cap = await gameToken.MAX_SUPPLY();
      const supply = await gameToken.totalSupply();
      // a modest refill within the cap works
      await expect(gameToken.connect(owner).mintToContract(ethers.parseEther("1000")))
        .to.emit(gameToken, "ContractRefilled");
      // minting past the cap reverts
      const over = cap - (await gameToken.totalSupply()) + 1n;
      await expect(gameToken.connect(owner).mintToContract(over))
        .to.be.revertedWithCustomError(gameToken, "ExceedsMaxSupply");
      // 1e12 tokens (the old exploit amount) is now firmly over the cap
      await expect(gameToken.connect(owner).mintToContract(ethers.parseEther("1000000000000")))
        .to.be.revertedWithCustomError(gameToken, "ExceedsMaxSupply");
      expect(cap).to.equal(ethers.parseEther("100000000"));
      expect(supply).to.equal(ethers.parseEther("1000000"));
    });
  });

  it("renounceOwnership is disabled", async () => {
    const { gameToken, owner } = await loadFixture(deployEcosystem);
    await expect(gameToken.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(gameToken, "NotWhitelisted");
  });
});
