const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CalixtoLiquidity", function () {
  let lpToken, locker;
  let owner, user1;
  const LP_AMOUNT = ethers.parseUnits("1000", 18);

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Mock LP token
    const Token = await ethers.getContractFactory("MockERC20");
    lpToken = await Token.deploy("PancakeSwap LP", "CALXT-BNB-LP", ethers.parseUnits("100000", 18));
    await lpToken.waitForDeployment();

    // Deploy locker
    const Locker = await ethers.getContractFactory("CalixtoLiquidity");
    locker = await Locker.deploy();
    await locker.waitForDeployment();
  });

  describe("lockLiquidity", function () {
    it("deve travar LP tokens", async function () {
      await lpToken.approve(await locker.getAddress(), LP_AMOUNT);
      await locker.lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 90);

      expect(await locker.totalLocks()).to.equal(1);
      const info = await locker.getLock(0);
      expect(info[1]).to.equal(LP_AMOUNT); // amount
      expect(info[3]).to.equal(false);     // withdrawn
      expect(info[4]).to.be.gte(89);       // daysRemaining
    });

    it("deve rejeitar lock < 90 dias", async function () {
      await lpToken.approve(await locker.getAddress(), LP_AMOUNT);
      await expect(
        locker.lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 30)
      ).to.be.revertedWith("Min 90 days lock");
    });

    it("deve rejeitar amount = 0", async function () {
      await expect(
        locker.lockLiquidity(await lpToken.getAddress(), 0, 90)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("deve rejeitar non-owner", async function () {
      await lpToken.transfer(user1.address, LP_AMOUNT);
      await lpToken.connect(user1).approve(await locker.getAddress(), LP_AMOUNT);
      await expect(
        locker.connect(user1).lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 90)
      ).to.be.reverted;
    });
  });

  describe("unlock", function () {
    beforeEach(async function () {
      await lpToken.approve(await locker.getAddress(), LP_AMOUNT);
      await locker.lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 90);
    });

    it("deve rejeitar unlock antes do prazo", async function () {
      await expect(locker.unlock(0)).to.be.revertedWith("Still locked");
    });

    it("deve permitir unlock após o prazo", async function () {
      await time.increase(91 * 24 * 60 * 60);

      const balanceBefore = await lpToken.balanceOf(owner.address);
      await locker.unlock(0);
      const balanceAfter = await lpToken.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(LP_AMOUNT);

      const info = await locker.getLock(0);
      expect(info[3]).to.equal(true); // withdrawn
    });

    it("deve rejeitar unlock duplo", async function () {
      await time.increase(91 * 24 * 60 * 60);
      await locker.unlock(0);
      await expect(locker.unlock(0)).to.be.revertedWith("Already withdrawn");
    });
  });

  describe("extendLock", function () {
    beforeEach(async function () {
      await lpToken.approve(await locker.getAddress(), LP_AMOUNT);
      await locker.lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 90);
    });

    it("deve estender o lock", async function () {
      const infoBefore = await locker.getLock(0);
      await locker.extendLock(0, 30);
      const infoAfter = await locker.getLock(0);

      expect(infoAfter[2]).to.be.gt(infoBefore[2]); // unlockTime aumentou
    });

    it("deve rejeitar non-owner", async function () {
      await expect(
        locker.connect(user1).extendLock(0, 30)
      ).to.be.reverted;
    });
  });

  describe("activeLocks", function () {
    it("deve contar locks ativos", async function () {
      await lpToken.approve(await locker.getAddress(), LP_AMOUNT * 2n);
      await locker.lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 90);
      await locker.lockLiquidity(await lpToken.getAddress(), LP_AMOUNT, 180);

      expect(await locker.activeLocks()).to.equal(2);

      await time.increase(91 * 24 * 60 * 60);
      await locker.unlock(0);

      expect(await locker.activeLocks()).to.equal(1);
    });
  });
});
