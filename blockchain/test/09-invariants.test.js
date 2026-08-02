const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem, buyGame } = require("./helpers/fixtures");

// Stateful invariant checks run after realistic action sequences. The Foundry
// layer (test-forge/) fuzzes these same properties across thousands of random
// sequences; these are the readable, deterministic anchors.

describe("INVARIANTS", () => {
  it("GameToken: totalTokensSold*1e18 + poolBalance == totalSupply (no mint leak)", async () => {
    const { gameToken, alice, bob, carol } = await loadFixture(deployEcosystem);
    await buyGame(gameToken, alice, 3);
    await buyGame(gameToken, bob, 2);
    await buyGame(gameToken, carol, 1);
    const sold = await gameToken.totalTokensSold();
    const pool = await gameToken.balanceOf(await gameToken.getAddress());
    const supply = await gameToken.totalSupply();
    expect(sold * ethers.parseEther("1") + pool).to.equal(supply);
  });

  it("GameToken: sum of user balances + pool == totalSupply", async () => {
    const { gameToken, alice, bob } = await loadFixture(deployEcosystem);
    await buyGame(gameToken, alice, 3);
    await buyGame(gameToken, bob, 3);
    const pool = await gameToken.balanceOf(await gameToken.getAddress());
    const a = await gameToken.balanceOf(alice.address);
    const b = await gameToken.balanceOf(bob.address);
    expect(a + b + pool).to.equal(await gameToken.totalSupply());
  });

  it("Marketplace: every ACTIVE ERC721 listing's token is really escrowed here", async () => {
    const base = await loadFixture(deployEcosystem);
    const { marketplace, alice, bob } = base;
    const Mock721 = await ethers.getContractFactory("MockERC721");
    const erc721 = await Mock721.deploy();
    const mAddr = await marketplace.getAddress();
    for (const u of [alice, bob]) {
      await erc721.mint(u.address);
    }
    await erc721.connect(alice).approve(mAddr, 0);
    await erc721.connect(bob).approve(mAddr, 1);
    await marketplace.connect(alice).createERC721Listing(await erc721.getAddress(), 0, ethers.parseEther("1"), ethers.ZeroAddress);
    await marketplace.connect(bob).createERC721Listing(await erc721.getAddress(), 1, ethers.parseEther("1"), ethers.ZeroAddress);

    const [ids] = await marketplace.getActiveListingIds(0, 500);
    for (const id of ids) {
      const l = await marketplace.listings(id);
      if (l.isActive && l.tokenType === 1n /* ERC721 */) {
        expect(await erc721.ownerOf(l.tokenId)).to.equal(mAddr);
      }
    }
  });

  it("Marketplace: well-behaved ERC20 escrow >= sum of active listing amounts", async () => {
    const base = await loadFixture(deployEcosystem);
    const { marketplace, alice, bob } = base;
    const Mock20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await Mock20.deploy();
    const mAddr = await marketplace.getAddress();
    for (const u of [alice, bob]) {
      await erc20.mint(u.address, ethers.parseEther("100"));
      await erc20.connect(u).approve(mAddr, ethers.parseEther("100"));
      await marketplace.connect(u).createERC20Listing(await erc20.getAddress(), ethers.parseEther("100"), ethers.parseEther("1"), ethers.ZeroAddress);
    }
    const [ids] = await marketplace.getActiveListingIds(0, 500);
    let owed = 0n;
    for (const id of ids) {
      const l = await marketplace.listings(id);
      if (l.isActive && l.tokenType === 0n) owed += l.amount;
    }
    expect(await erc20.balanceOf(mAddr)).to.be.gte(owed); // holds for standard tokens
  });

  it("Faucet: contract balance only ever decreases by claimAmount per successful claim", async () => {
    const { faucet, alice, bob } = await loadFixture(deployEcosystem);
    const amt = await faucet.claimAmount();
    const before = await ethers.provider.getBalance(await faucet.getAddress());
    await faucet.connect(alice).claim();
    await faucet.connect(bob).claim();
    const after = await ethers.provider.getBalance(await faucet.getAddress());
    expect(before - after).to.equal(amt * 2n);
  });

  it("Whitelist: an active member is whitelisted AND not blacklisted", async () => {
    const { whitelist, owner, alice, bob } = await loadFixture(deployEcosystem);
    await whitelist.connect(owner).addToBlacklist(bob.address);
    for (const u of [alice, bob]) {
      const s = await whitelist.getUserStatus(u.address);
      expect(s.active).to.equal(s.whitelisted && !s.blacklisted);
    }
  });
});
