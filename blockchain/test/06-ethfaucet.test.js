const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deployEcosystem } = require("./helpers/fixtures");

describe("ETHFaucet", () => {
  it("whitelisted user claims exactly claimAmount; cooldown blocks 2nd; resets after cooldown", async () => {
    const { faucet, alice } = await loadFixture(deployEcosystem);
    const amt = await faucet.claimAmount();
    const cd = await faucet.cooldown();
    const before = await ethers.provider.getBalance(alice.address);
    const tx = await faucet.connect(alice).claim();
    const rc = await tx.wait();
    const after = await ethers.provider.getBalance(alice.address);
    expect(after).to.equal(before + amt - rc.gasUsed * rc.gasPrice);
    await expect(faucet.connect(alice).claim()).to.be.revertedWithCustomError(faucet, "CooldownActive");
    await time.increase(Number(cd) + 1);
    await expect(faucet.connect(alice).claim()).to.not.be.reverted;
  });

  it("non-whitelisted cannot claim", async () => {
    const { faucet, outsider } = await loadFixture(deployEcosystem);
    await expect(faucet.connect(outsider).claim()).to.be.revertedWithCustomError(faucet, "NotWhitelisted");
  });

  it("claim reverts when faucet is underfunded", async () => {
    const { faucet, owner, alice } = await loadFixture(deployEcosystem);
    // drain the faucet first
    await faucet.connect(owner).emergencyWithdrawAll();
    await expect(faucet.connect(alice).claim()).to.be.revertedWithCustomError(faucet, "InsufficientFaucetBalance");
  });

  it("funding via fundFaucet + receive emits Funded", async () => {
    const { faucet, alice } = await loadFixture(deployEcosystem);
    await expect(faucet.connect(alice).fundFaucet({ value: ethers.parseEther("0.01") }))
      .to.emit(faucet, "Funded");
    await expect(alice.sendTransaction({ to: await faucet.getAddress(), value: ethers.parseEther("0.01") }))
      .to.emit(faucet, "Funded");
  });

  it("bounds: claimAmount <= 1 ETH, cooldown <= 7 days (constructor + setters)", async () => {
    const { faucet, owner } = await loadFixture(deployEcosystem);
    await expect(faucet.connect(owner).setClaimAmount(ethers.parseEther("1.01")))
      .to.be.revertedWithCustomError(faucet, "ClaimAmountTooHigh");
    await expect(faucet.connect(owner).setCooldown(7 * 24 * 60 * 60 + 1))
      .to.be.revertedWithCustomError(faucet, "CooldownOutOfRange");
    await expect(faucet.connect(owner).setClaimAmount(ethers.parseEther("1"))).to.not.be.reverted;
  });

  it("owner withdraw + emergencyWithdrawAll; non-owner blocked", async () => {
    const { faucet, owner, alice } = await loadFixture(deployEcosystem);
    await expect(faucet.connect(alice).withdraw(alice.address, 1))
      .to.be.revertedWithCustomError(faucet, "OwnableUnauthorizedAccount");
    await expect(faucet.connect(owner).withdraw(owner.address, ethers.parseEther("0.01")))
      .to.emit(faucet, "Withdrawn");
    await expect(faucet.connect(owner).emergencyWithdrawAll()).to.emit(faucet, "Withdrawn");
    await expect(faucet.connect(owner).emergencyWithdrawAll())
      .to.be.revertedWithCustomError(faucet, "NothingToWithdraw");
  });

  describe("SECURITY PROBE — fallback() swallows mistaken ETH-bearing calls", () => {
    it("a call with bad calldata + ETH is accepted as a donation (funds lost to sender)", async () => {
      const { faucet, alice } = await loadFixture(deployEcosystem);
      await expect(alice.sendTransaction({
        to: await faucet.getAddress(),
        data: "0xdeadbeef",
        value: ethers.parseEther("0.02"),
      })).to.emit(faucet, "Funded");
      console.log("      fallback() accepted a mistyped ETH-bearing call as a donation");
    });
  });

  it("renounceOwnership disabled", async () => {
    const { faucet, owner } = await loadFixture(deployEcosystem);
    await expect(faucet.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(faucet, "OwnershipNotRenounceable");
  });
});
