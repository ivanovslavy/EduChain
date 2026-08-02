const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem, buyGame } = require("./helpers/fixtures");

const DAY = 24 * 60 * 60;

describe("GameNFTCustom", () => {
  it("mintWithETH stores per-token URI; empty URI falls back to baseURI", async () => {
    const { nftCustom, alice } = await loadFixture(deployEcosystem);
    const price = await nftCustom.ethMintPrice();
    await nftCustom.connect(alice).mintWithETH(alice.address, 1, "ipfs://custom-A", { value: price });
    expect(await nftCustom.tokenURI(0)).to.equal("ipfs://custom-A");
    await nftCustom.connect(alice).mintWithETH(alice.address, 1, "", { value: price });
    expect(await nftCustom.tokenURI(1)).to.equal("ipfs://base-custom/1.json");
  });

  it("mintWithETHMulti assigns a distinct URI per token", async () => {
    const { nftCustom, owner, alice } = await loadFixture(deployEcosystem);
    await nftCustom.connect(owner).setMaxMintsPer24Hours(100);
    const price = await nftCustom.ethMintPrice();
    await nftCustom.connect(alice).mintWithETHMulti(alice.address, ["a", "", "c"], { value: price * 3n });
    expect(await nftCustom.tokenURI(0)).to.equal("a");
    expect(await nftCustom.tokenURI(1)).to.equal("ipfs://base-custom/1.json");
    expect(await nftCustom.tokenURI(2)).to.equal("c");
  });

  it("mintWithTokens pulls GAME payment; requires paymentToken set + approval", async () => {
    const { nftCustom, gameToken, owner, alice } = await loadFixture(deployEcosystem);
    await buyGame(gameToken, alice, 3); // alice now holds 3 GAME
    const cost = await nftCustom.tokenMintPrice();
    await gameToken.connect(alice).approve(await nftCustom.getAddress(), cost);
    await expect(nftCustom.connect(alice).mintWithTokens(alice.address, 1, "u", ))
      .to.emit(nftCustom, "MintedWithTokens");
    expect(await nftCustom.balanceOf(alice.address)).to.equal(1n);
    // owner can withdraw the collected GAME
    await expect(nftCustom.connect(owner).withdrawTokens()).to.emit(nftCustom, "TokensWithdrawn");
  });

  it("access + limits: non-whitelisted blocked, batch + daily caps enforced", async () => {
    const { nftCustom, alice, outsider } = await loadFixture(deployEcosystem);
    const price = await nftCustom.ethMintPrice();
    await expect(nftCustom.connect(outsider).mintWithETH(outsider.address, 1, "u", { value: price }))
      .to.be.revertedWithCustomError(nftCustom, "NotWhitelisted");
    const batch = await nftCustom.maxBatchSize();
    await expect(nftCustom.connect(alice).mintWithETH(alice.address, batch + 1n, "u", { value: price * (batch + 1n) }))
      .to.be.revertedWithCustomError(nftCustom, "ExceedsBatchSize");
  });

  it("daily mint cap resets after 24h", async () => {
    const { nftCustom, alice } = await loadFixture(deployEcosystem);
    const price = await nftCustom.ethMintPrice();
    const cap = await nftCustom.maxMintsPer24Hours();
    await nftCustom.connect(alice).mintWithETH(alice.address, cap, "u", { value: price * cap });
    await expect(nftCustom.connect(alice).mintWithETH(alice.address, 1, "u", { value: price }))
      .to.be.revertedWithCustomError(nftCustom, "ExceedsDailyMintLimit");
    await time.increase(DAY + 1);
    await expect(nftCustom.connect(alice).mintWithETH(alice.address, 1, "u", { value: price })).to.not.be.reverted;
  });

  describe("A5 FIX — withdrawTokens(address) recovers a token stranded by a swap", () => {
    it("the old paymentToken balance is recoverable after the payment token changes", async () => {
      const { nftCustom, gameToken, owner, alice } = await loadFixture(deployEcosystem);
      await buyGame(gameToken, alice, 1);
      const cost = await nftCustom.tokenMintPrice();
      await gameToken.connect(alice).approve(await nftCustom.getAddress(), cost);
      await nftCustom.connect(alice).mintWithTokens(alice.address, 1, "u");
      const collected = await gameToken.balanceOf(await nftCustom.getAddress());
      expect(collected).to.equal(cost);

      // owner swaps the payment token → the no-arg withdrawTokens now targets the new token
      const Mock = await ethers.getContractFactory("MockERC20");
      const other = await Mock.deploy();
      await nftCustom.connect(owner).setPaymentToken(await other.getAddress());
      await expect(nftCustom.connect(owner).withdrawTokens())
        .to.be.revertedWithCustomError(nftCustom, "NothingToWithdraw");

      // A5: but sweepToken(address) recovers the stranded GAME
      const ownerBefore = await gameToken.balanceOf(owner.address);
      await expect(nftCustom.connect(owner).sweepToken(await gameToken.getAddress()))
        .to.emit(nftCustom, "TokensWithdrawn");
      expect(await gameToken.balanceOf(await nftCustom.getAddress())).to.equal(0n);
      expect(await gameToken.balanceOf(owner.address)).to.equal(ownerBefore + collected);
    });
  });

  it("renounceOwnership disabled", async () => {
    const { nftCustom, owner } = await loadFixture(deployEcosystem);
    await expect(nftCustom.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(nftCustom, "OwnershipNotRenounceable");
  });
});
