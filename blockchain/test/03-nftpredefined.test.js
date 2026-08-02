const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem } = require("./helpers/fixtures");

const DAY = 24 * 60 * 60;

describe("GameNFTPredefined", () => {
  it("mints to a whitelisted user, first tokenId = 0, baseURI scheme", async () => {
    const { nftPredefined, alice } = await loadFixture(deployEcosystem);
    const price = await nftPredefined.mintPrice();
    await expect(nftPredefined.connect(alice).mint(alice.address, 1, { value: price }))
      .to.emit(nftPredefined, "Minted");
    expect(await nftPredefined.ownerOf(0)).to.equal(alice.address);
    expect(await nftPredefined.tokenURI(0)).to.equal("ipfs://base-predefined/0.json");
  });

  it("non-whitelisted cannot mint; underpay + zero revert", async () => {
    const { nftPredefined, alice, outsider } = await loadFixture(deployEcosystem);
    const price = await nftPredefined.mintPrice();
    await expect(nftPredefined.connect(outsider).mint(outsider.address, 1, { value: price }))
      .to.be.revertedWithCustomError(nftPredefined, "NotWhitelisted");
    await expect(nftPredefined.connect(alice).mint(alice.address, 1, { value: 0 }))
      .to.be.revertedWithCustomError(nftPredefined, "InsufficientPayment");
    await expect(nftPredefined.connect(alice).mint(alice.address, 0, { value: 0 }))
      .to.be.revertedWithCustomError(nftPredefined, "ZeroAmount");
  });

  it("enforces maxSupply hard cap", async () => {
    const { nftPredefined, owner, alice } = await loadFixture(deployEcosystem);
    const price = await nftPredefined.mintPrice();
    const batch = await nftPredefined.maxBatchSize();
    await nftPredefined.connect(owner).setMaxMintsPer24Hours(1000);
    await nftPredefined.connect(owner).setMaxSupply(2);
    await expect(nftPredefined.connect(alice).mint(alice.address, 3, { value: price * 3n }))
      .to.be.revertedWithCustomError(nftPredefined, "ExceedsMaxSupply");
    expect(batch).to.be.gt(0n);
  });

  it("daily mint limit resets after 24h", async () => {
    const { nftPredefined, owner, alice } = await loadFixture(deployEcosystem);
    const price = await nftPredefined.mintPrice();
    const cap = await nftPredefined.maxMintsPer24Hours();
    await nftPredefined.connect(owner).setMaxSupply(1000);
    await nftPredefined.connect(alice).mint(alice.address, cap, { value: price * cap });
    await expect(nftPredefined.connect(alice).mint(alice.address, 1, { value: price }))
      .to.be.revertedWithCustomError(nftPredefined, "ExceedsDailyMintLimit");
    await time.increase(DAY + 1);
    await expect(nftPredefined.connect(alice).mint(alice.address, 1, { value: price })).to.not.be.reverted;
  });

  it("transfer gating: mint/burn always allowed, user transfer blocked when disabled", async () => {
    const { nftPredefined, owner, alice, bob } = await loadFixture(deployEcosystem);
    const price = await nftPredefined.mintPrice();
    await nftPredefined.connect(alice).mint(alice.address, 1, { value: price });
    await nftPredefined.connect(owner).setTransfersEnabled(false);
    await expect(nftPredefined.connect(alice).transferFrom(alice.address, bob.address, 0))
      .to.be.revertedWithCustomError(nftPredefined, "TransfersDisabled");
    await nftPredefined.connect(owner).setTransfersEnabled(true);
    await expect(nftPredefined.connect(alice).transferFrom(alice.address, bob.address, 0)).to.not.be.reverted;
  });

  it("tokenURI of a nonexistent token reverts", async () => {
    const { nftPredefined } = await loadFixture(deployEcosystem);
    await expect(nftPredefined.tokenURI(999)).to.be.revertedWithCustomError(nftPredefined, "NonexistentToken");
  });

  it("owner-only setters; setMaxSupply below minted reverts; renounce disabled", async () => {
    const { nftPredefined, owner, alice } = await loadFixture(deployEcosystem);
    const price = await nftPredefined.mintPrice();
    await expect(nftPredefined.connect(alice).setMintPrice(1))
      .to.be.revertedWithCustomError(nftPredefined, "OwnableUnauthorizedAccount");
    // mint 2, then try to set maxSupply below what's already minted
    await nftPredefined.connect(owner).setMaxMintsPer24Hours(1000);
    await nftPredefined.connect(alice).mint(alice.address, 2, { value: price * 2n });
    await expect(nftPredefined.connect(owner).setMaxSupply(1))
      .to.be.revertedWithCustomError(nftPredefined, "InvalidMaxSupply");
    await expect(nftPredefined.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(nftPredefined, "NotWhitelisted");
  });
});
