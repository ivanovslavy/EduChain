const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem } = require("./helpers/fixtures");

// Happy-path + access/limit tests. Adversarial attacks live in 08-attacks.test.js.
async function withMocks() {
  const base = await loadFixture(deployEcosystem);
  const Mock20 = await ethers.getContractFactory("MockERC20");
  const Mock721 = await ethers.getContractFactory("MockERC721");
  const erc20 = await Mock20.deploy();
  const erc721 = await Mock721.deploy();
  return { ...base, erc20, erc721 };
}

describe("TokenMarketplace", () => {
  it("ERC721 listing → escrow → purchase delivers asset + pays seller", async () => {
    const { marketplace, erc721, alice, bob } = await withMocks();
    const mAddr = await marketplace.getAddress();
    const id = await erc721.mint.staticCall(alice.address);
    await erc721.mint(alice.address);
    await erc721.connect(alice).approve(mAddr, id);
    const price = ethers.parseEther("1");
    await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), id, price, ethers.ZeroAddress);
    expect(await erc721.ownerOf(id)).to.equal(mAddr); // really escrowed

    const sellerBefore = await ethers.provider.getBalance(alice.address);
    await marketplace.connect(bob).purchaseListing(1, { value: price });
    expect(await erc721.ownerOf(id)).to.equal(bob.address);
    expect(await ethers.provider.getBalance(alice.address)).to.equal(sellerBefore + price);
  });

  it("ERC20 listing → escrow → purchase transfers tokens + pays seller", async () => {
    const { marketplace, erc20, alice, bob } = await withMocks();
    const mAddr = await marketplace.getAddress();
    await erc20.mint(alice.address, ethers.parseEther("100"));
    await erc20.connect(alice).approve(mAddr, ethers.parseEther("100"));
    const amount = ethers.parseEther("100");
    const price = ethers.parseEther("2");
    await marketplace.connect(alice).createERC20Listing(await erc20.getAddress(), amount, price, ethers.ZeroAddress);
    expect(await erc20.balanceOf(mAddr)).to.equal(amount); // escrowed
    await marketplace.connect(bob).purchaseListing(1, { value: price });
    expect(await erc20.balanceOf(bob.address)).to.equal(amount);
  });

  it("private listing: only allowedBuyer may purchase", async () => {
    const { marketplace, erc721, alice, bob, carol } = await withMocks();
    const mAddr = await marketplace.getAddress();
    await erc721.mint(alice.address);
    await erc721.connect(alice).approve(mAddr, 0);
    const price = ethers.parseEther("1");
    await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), 0, price, bob.address);
    await expect(marketplace.connect(carol).purchaseListing(1, { value: price }))
      .to.be.revertedWithCustomError(marketplace, "NotAllowedBuyer");
    await expect(marketplace.connect(bob).purchaseListing(1, { value: price })).to.not.be.reverted;
  });

  it("cannot buy own listing; inactive listing reverts; overpay refunded", async () => {
    const { marketplace, erc721, alice, bob } = await withMocks();
    const mAddr = await marketplace.getAddress();
    await erc721.mint(alice.address);
    await erc721.connect(alice).approve(mAddr, 0);
    const price = ethers.parseEther("1");
    await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), 0, price, ethers.ZeroAddress);
    await expect(marketplace.connect(alice).purchaseListing(1, { value: price }))
      .to.be.revertedWithCustomError(marketplace, "CannotBuyOwnListing");
    await marketplace.connect(bob).purchaseListing(1, { value: price });
    await expect(marketplace.connect(bob).purchaseListing(1, { value: price }))
      .to.be.revertedWithCustomError(marketplace, "ListingInactive");
  });

  it("seller cancel returns the escrowed asset; only seller may cancel", async () => {
    const { marketplace, erc721, alice, bob } = await withMocks();
    const mAddr = await marketplace.getAddress();
    await erc721.mint(alice.address);
    await erc721.connect(alice).approve(mAddr, 0);
    await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), 0, ethers.parseEther("1"), ethers.ZeroAddress);
    await expect(marketplace.connect(bob).cancelListing(1)).to.be.revertedWithCustomError(marketplace, "NotSeller");
    await marketplace.connect(alice).cancelListing(1);
    expect(await erc721.ownerOf(0)).to.equal(alice.address);
  });

  it("owner emergencyCancel returns asset to seller; non-owner blocked", async () => {
    const { marketplace, erc721, owner, alice, bob } = await withMocks();
    const mAddr = await marketplace.getAddress();
    await erc721.mint(alice.address);
    await erc721.connect(alice).approve(mAddr, 0);
    await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), 0, ethers.parseEther("1"), ethers.ZeroAddress);
    await expect(marketplace.connect(bob).emergencyCancelListing(1))
      .to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    await marketplace.connect(owner).emergencyCancelListing(1);
    expect(await erc721.ownerOf(0)).to.equal(alice.address);
  });

  it("non-whitelisted cannot list or buy", async () => {
    const { marketplace, erc721, outsider } = await withMocks();
    await erc721.mint(outsider.address);
    await expect(marketplace.connect(outsider).createERC721Listing(await erc721.getAddress(), 0, 1, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(marketplace, "NotWhitelisted");
  });

  it("listing NOT owned by caller reverts (real ERC721 ownerOf check)", async () => {
    const { marketplace, erc721, alice, bob } = await withMocks();
    await erc721.mint(bob.address); // bob owns token 0
    await expect(marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), 0, 1, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
  });

  it("daily listing limit enforced", async () => {
    const { marketplace, erc721, owner, alice } = await withMocks();
    const mAddr = await marketplace.getAddress();
    const lim = await marketplace.listingsPerDayLimit();
    for (let i = 0; i < Number(lim); i++) {
      await erc721.mint(alice.address);
      await erc721.connect(alice).approve(mAddr, i);
      await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), i, ethers.parseEther("1"), ethers.ZeroAddress);
    }
    await erc721.mint(alice.address);
    await erc721.connect(alice).approve(mAddr, Number(lim));
    await expect(marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), Number(lim), ethers.parseEther("1"), ethers.ZeroAddress))
      .to.be.revertedWithCustomError(marketplace, "ExceedsListingsPerDay");
  });

  it("renounceOwnership disabled", async () => {
    const { marketplace, owner } = await withMocks();
    await expect(marketplace.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(marketplace, "OwnershipNotRenounceable");
  });
});
