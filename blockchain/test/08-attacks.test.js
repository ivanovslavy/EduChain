const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem, buyGame } = require("./helpers/fixtures");

// ═══════════════════════════════════════════════════════════════════════════
// ADVERSARIAL SUITE — real attacker contracts vs the live contract logic.
// Two classes of result:
//   • DEFEATED  — the attack reverts / cannot double-spend (guard works).
//   • CONFIRMED — the attack SUCCEEDS → a real finding; the test proves it and
//                 logs it so the audit report can cite an executed exploit.
// ═══════════════════════════════════════════════════════════════════════════

describe("ATTACKS — reentrancy (must be DEFEATED)", () => {
  it("reentrant SELLER cannot re-enter purchaseListing on payout", async () => {
    const { marketplace, owner, whitelist, bob } = await loadFixture(deployEcosystem);
    const Mock20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await Mock20.deploy();
    const Seller = await ethers.getContractFactory("ReentrantSeller");
    const seller = await Seller.deploy(await marketplace.getAddress());
    await whitelist.connect(owner).addToWhitelist(await seller.getAddress());
    await erc20.mint(await seller.getAddress(), ethers.parseEther("100"));
    const price = ethers.parseEther("1");
    await seller.list(await erc20.getAddress(), ethers.parseEther("100"), price);
    await seller.arm(1); // re-purchase on payout

    await marketplace.connect(bob).purchaseListing(1, { value: price });
    expect(await seller.reenterAttempts()).to.equal(1n);
    expect(await seller.reenterReverted()).to.equal(true); // guard fired
    expect(await erc20.balanceOf(bob.address)).to.equal(ethers.parseEther("100")); // delivered once
  });

  it("reentrant BUYER cannot re-enter on the overpay refund", async () => {
    const { marketplace, owner, whitelist, alice } = await loadFixture(deployEcosystem);
    const Mock20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await Mock20.deploy();
    await erc20.mint(alice.address, ethers.parseEther("50"));
    await erc20.connect(alice).approve(await marketplace.getAddress(), ethers.parseEther("50"));
    const price = ethers.parseEther("1");
    await marketplace.connect(alice).createERC20Listing(await erc20.getAddress(), ethers.parseEther("50"), price, ethers.ZeroAddress);

    const Buyer = await ethers.getContractFactory("ReentrantBuyer");
    const buyer = await Buyer.deploy(await marketplace.getAddress(), { value: ethers.parseEther("5") });
    await whitelist.connect(owner).addToWhitelist(await buyer.getAddress());
    await buyer.buy(1, price, ethers.parseEther("1")); // overpay by 1 → refund path
    expect(await buyer.reenterAttempts()).to.equal(1n);
    expect(await buyer.reenterReverted()).to.equal(true);
    expect(await erc20.balanceOf(await buyer.getAddress())).to.equal(ethers.parseEther("50"));
  });

  it("reentrant FAUCET claimer gets exactly one claimAmount", async () => {
    const { faucet, owner, whitelist } = await loadFixture(deployEcosystem);
    const Claimer = await ethers.getContractFactory("ReentrantClaimer");
    const claimer = await Claimer.deploy(await faucet.getAddress());
    await whitelist.connect(owner).addToWhitelist(await claimer.getAddress());
    await claimer.arm();
    await claimer.go();
    expect(await claimer.reenterAttempts()).to.equal(1n);
    expect(await claimer.reenterReverted()).to.equal(true);
    expect(await claimer.received()).to.equal(await faucet.claimAmount()); // exactly one
  });

  it("reentrant ERC-20 cannot double-mint via mintWithTokens", async () => {
    const { nftCustom, owner, whitelist, mallory } = await loadFixture(deployEcosystem);
    const Ren = await ethers.getContractFactory("ReentrantERC20");
    const ren = await Ren.deploy();
    await nftCustom.connect(owner).setPaymentToken(await ren.getAddress());
    const cost = await nftCustom.tokenMintPrice();
    await ren.mint(mallory.address, cost * 10n);
    await ren.connect(mallory).approve(await nftCustom.getAddress(), ethers.MaxUint256);
    await ren.configure(await nftCustom.getAddress(), mallory.address, "u");
    await ren.arm();
    await nftCustom.connect(mallory).mintWithTokens(mallory.address, 1, "u");
    expect(await ren.reenterAttempts()).to.equal(1n);
    expect(await ren.reenterReverted()).to.equal(true);   // nonReentrant blocked the nested mint
    expect(await nftCustom.balanceOf(mallory.address)).to.equal(1n); // minted once, not twice
  });
});

describe("ATTACKS — griefing / DoS via rejecting receiver (fail CLOSED)", () => {
  it("faucet claim by a contract that rejects ETH reverts (no silent loss)", async () => {
    const { faucet, owner, whitelist } = await loadFixture(deployEcosystem);
    const Rej = await ethers.getContractFactory("RejectingReceiver");
    const rej = await Rej.deploy();
    await rej.setFaucet(await faucet.getAddress());
    await whitelist.connect(owner).addToWhitelist(await rej.getAddress());
    await expect(rej.claim()).to.be.revertedWithCustomError(faucet, "TransferFailed");
  });

  it("marketplace payout to a rejecting seller reverts the purchase (asset stays escrowed)", async () => {
    const { marketplace, owner, whitelist, bob } = await loadFixture(deployEcosystem);
    const Mock20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await Mock20.deploy();
    const Rej = await ethers.getContractFactory("RejectingReceiver");
    const rej = await Rej.deploy();
    await rej.setMkt(await marketplace.getAddress());
    await whitelist.connect(owner).addToWhitelist(await rej.getAddress());
    await erc20.mint(await rej.getAddress(), ethers.parseEther("10"));
    await rej.listERC20(await erc20.getAddress(), ethers.parseEther("10"), ethers.parseEther("1"));
    await expect(marketplace.connect(bob).purchaseListing(1, { value: ethers.parseEther("1") }))
      .to.be.revertedWithCustomError(marketplace, "TransferFailed");
    // Note: this means a malicious seller can DoS purchases of its own listing — a griefing
    // vector (buyer wastes gas), though no funds are lost. Documented for the report.
  });
});

describe("ATTACKS — outsider (NOT whitelisted) is locked out everywhere", () => {
  it("every value path rejects a non-whitelisted caller", async () => {
    const { marketplace, faucet, gameToken, nftCustom, nftPredefined, outsider } = await loadFixture(deployEcosystem);
    await expect(faucet.connect(outsider).claim()).to.be.revertedWithCustomError(faucet, "NotWhitelisted");
    await expect(gameToken.connect(outsider).buyTokens(1, { value: await gameToken.tokenPrice() }))
      .to.be.revertedWithCustomError(gameToken, "NotWhitelisted");
    await expect(nftPredefined.connect(outsider).mint(outsider.address, 1, { value: await nftPredefined.mintPrice() }))
      .to.be.revertedWithCustomError(nftPredefined, "NotWhitelisted");
    await expect(nftCustom.connect(outsider).mintWithETH(outsider.address, 1, "u", { value: await nftCustom.ethMintPrice() }))
      .to.be.revertedWithCustomError(nftCustom, "NotWhitelisted");
    await expect(marketplace.connect(outsider).purchaseListing(1, { value: 1 }))
      .to.be.revertedWithCustomError(marketplace, "NotWhitelisted");
  });
});

describe("ATTACKS — CONFIRMED findings (attack SUCCEEDS)", () => {
  it("BAIT-AND-SWITCH: buyer pays for a fake ERC721 and receives nothing", async () => {
    const { marketplace, owner, whitelist, mallory, bob } = await loadFixture(deployEcosystem);
    const Mal = await ethers.getContractFactory("MaliciousERC721");
    const mal = await Mal.deploy();
    await mal.setFakeOwner(mallory.address);       // ownerOf() lies → mallory "owns" it
    const price = ethers.parseEther("1");
    await marketplace.connect(mallory).createERC721Listing(await mal.getAddress(), 0, price, ethers.ZeroAddress);

    const malloryBefore = await ethers.provider.getBalance(mallory.address);
    await marketplace.connect(bob).purchaseListing(1, { value: price });
    const malloryAfter = await ethers.provider.getBalance(mallory.address);

    expect(malloryAfter - malloryBefore).to.equal(price);  // attacker got paid
    expect(await mal.transferFromCalls()).to.equal(2n);    // both "transfers" were no-ops
    // bob paid `price` and received no real asset → CONFIRMED payment-for-nothing.
    console.log("      CONFIRMED: buyer paid 1 ETH for a fake NFT, received nothing");
  });

  it("FEE-ON-TRANSFER: escrow accounting drifts → later purchase cannot be paid out", async () => {
    const { marketplace, owner, whitelist, alice, bob, carol } = await loadFixture(deployEcosystem);
    const Fee = await ethers.getContractFactory("FeeOnTransferERC20");
    const fee = await Fee.deploy(1000); // 10% fee
    const mAddr = await marketplace.getAddress();
    for (const u of [alice, bob]) {
      await fee.mint(u.address, ethers.parseEther("100"));
      await fee.connect(u).approve(mAddr, ethers.parseEther("100"));
      await marketplace.connect(u).createERC20Listing(await fee.getAddress(), ethers.parseEther("100"), ethers.parseEther("1"), ethers.ZeroAddress);
    }
    const escrow = await fee.balanceOf(mAddr);
    // Two listings each RECORD 100, but escrow holds only ~180 (10% skimmed twice).
    expect(escrow).to.be.lt(ethers.parseEther("200"));
    console.log(`      escrow holds ${ethers.formatEther(escrow)} but listings claim 200`);

    // First buyer succeeds (drains escrow further via the outbound 10% fee).
    await marketplace.connect(carol).purchaseListing(1, { value: ethers.parseEther("1") });
    // Second buyer cannot be paid the full 100 → purchase reverts (funds locked).
    await expect(marketplace.connect(carol).purchaseListing(2, { value: ethers.parseEther("1") }))
      .to.be.reverted;
    console.log("      CONFIRMED: 2nd listing unredeemable — fee-on-transfer accounting drain");
  });

  it("STUCK NFT: a direct safeTransfer into the marketplace is accepted with no rescue path", async () => {
    const { marketplace, alice } = await loadFixture(deployEcosystem);
    const Mock721 = await ethers.getContractFactory("MockERC721");
    const erc721 = await Mock721.deploy();
    await erc721.mint(alice.address); // token 0
    const mAddr = await marketplace.getAddress();
    await erc721.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, mAddr, 0);
    expect(await erc721.ownerOf(0)).to.equal(mAddr);
    // No listing exists for it and there is no owner rescue function → permanently stuck.
    expect(await marketplace.activeListingsCount()).to.equal(0n);
    console.log("      CONFIRMED: NFT sent directly to marketplace is stuck forever (no sweep)");
  });
});
