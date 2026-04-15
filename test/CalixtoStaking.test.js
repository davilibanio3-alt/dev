const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CalixtoStaking", function () {
  let token, staking;
  let owner, user1, user2;
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
  const STAKE_AMOUNT = ethers.parseUnits("1000", 18);
  const REWARD_DEPOSIT = ethers.parseUnits("10000", 18);

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC20
    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy("CalixtoSuper", "CALXT", INITIAL_SUPPLY);
    await token.waitForDeployment();

    // Deploy staking
    const Staking = await ethers.getContractFactory("CalixtoStaking");
    staking = await Staking.deploy(await token.getAddress());
    await staking.waitForDeployment();

    // Distribui tokens para users
    await token.transfer(user1.address, ethers.parseUnits("10000", 18));
    await token.transfer(user2.address, ethers.parseUnits("10000", 18));

    // Owner deposita recompensas
    await token.approve(await staking.getAddress(), REWARD_DEPOSIT);
    await staking.depositRewards(REWARD_DEPOSIT);
  });

  describe("Deployment", function () {
    it("deve setar o token correto", async function () {
      expect(await staking.token()).to.equal(await token.getAddress());
    });

    it("deve setar o owner correto", async function () {
      expect(await staking.owner()).to.equal(owner.address);
    });

    it("deve ter rewardRate = 10", async function () {
      expect(await staking.rewardRate()).to.equal(10);
    });

    it("deve ter reward pool com tokens depositados", async function () {
      expect(await staking.rewardPool()).to.equal(REWARD_DEPOSIT);
    });
  });

  describe("Stake", function () {
    it("deve permitir stake de tokens", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);

      const stake = await staking.stakes(user1.address);
      expect(stake.amount).to.equal(STAKE_AMOUNT);
      expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
    });

    it("deve rejeitar stake de 0", async function () {
      await expect(
        staking.connect(user1).stake(0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("deve emitir evento Staked", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await expect(staking.connect(user1).stake(STAKE_AMOUNT))
        .to.emit(staking, "Staked")
        .withArgs(user1.address, STAKE_AMOUNT);
    });

    it("deve liquidar recompensas ao adicionar stake", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT * 2n);
      await staking.connect(user1).stake(STAKE_AMOUNT);

      // Avança 180 dias
      await time.increase(180 * 24 * 60 * 60);

      // Adiciona mais stake — deve liquidar recompensas acumuladas
      await staking.connect(user1).stake(STAKE_AMOUNT);

      const stake = await staking.stakes(user1.address);
      expect(stake.accruedReward).to.be.gt(0);
      expect(stake.amount).to.equal(STAKE_AMOUNT * 2n);
    });
  });

  describe("Withdraw", function () {
    it("deve sacar stake + recompensas", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);

      // Avança 365 dias
      await time.increase(365 * 24 * 60 * 60);

      const balanceBefore = await token.balanceOf(user1.address);
      await staking.connect(user1).withdraw();
      const balanceAfter = await token.balanceOf(user1.address);

      // Deve receber stake + ~10% de recompensa
      const received = balanceAfter - balanceBefore;
      expect(received).to.be.gt(STAKE_AMOUNT);
    });

    it("deve zerar stake e startTime após withdraw", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);

      await time.increase(30 * 24 * 60 * 60);
      await staking.connect(user1).withdraw();

      const stake = await staking.stakes(user1.address);
      expect(stake.amount).to.equal(0);
      expect(stake.startTime).to.equal(0);
      expect(stake.accruedReward).to.equal(0);
    });

    it("deve rejeitar withdraw sem stake", async function () {
      await expect(
        staking.connect(user1).withdraw()
      ).to.be.revertedWith("No active stake");
    });

    it("deve rejeitar withdraw se reward pool insuficiente", async function () {
      // Deposita muito stake para exceder reward pool
      const bigStake = ethers.parseUnits("100000", 18);
      await token.transfer(user1.address, bigStake);
      await token.connect(user1).approve(await staking.getAddress(), bigStake);
      await staking.connect(user1).stake(bigStake);

      // Avança muito tempo para acumular recompensas maiores que o pool
      await time.increase(365 * 24 * 60 * 60 * 10); // 10 anos

      await expect(
        staking.connect(user1).withdraw()
      ).to.be.revertedWith("Insufficient reward pool");
    });
  });

  describe("Re-stake após withdraw (bug fix)", function () {
    it("não deve inflar recompensas ao re-stake", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT * 2n);

      // Primeiro stake
      await staking.connect(user1).stake(STAKE_AMOUNT);
      await time.increase(365 * 24 * 60 * 60);
      await staking.connect(user1).withdraw();

      // Re-stake
      await staking.connect(user1).stake(STAKE_AMOUNT);

      // startTime deve ser atual, não o antigo
      const stake = await staking.stakes(user1.address);
      const now = await time.latest();
      expect(stake.startTime).to.be.closeTo(now, 5);

      // Recompensa imediata deve ser ~0
      const reward = await staking.calculateReward(user1.address);
      expect(reward).to.be.lt(ethers.parseUnits("1", 18));
    });
  });

  describe("Admin", function () {
    it("deve permitir owner alterar rewardRate", async function () {
      await staking.setRewardRate(20);
      expect(await staking.rewardRate()).to.equal(20);
    });

    it("deve rejeitar rewardRate > 50", async function () {
      await expect(
        staking.setRewardRate(51)
      ).to.be.revertedWith("Max 50% ao ano");
    });

    it("deve rejeitar non-owner alterar rewardRate", async function () {
      await expect(
        staking.connect(user1).setRewardRate(20)
      ).to.be.reverted;
    });

    it("emergencyWithdraw deve sacar somente excedente", async function () {
      // Com reward pool depositado, excedente = rewardPool
      const balanceBefore = await token.balanceOf(owner.address);
      await staking.emergencyWithdraw();
      const balanceAfter = await token.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(REWARD_DEPOSIT);
    });

    it("emergencyWithdraw não deve tocar fundos dos users", async function () {
      await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);

      // Owner faz emergency withdraw
      await staking.emergencyWithdraw();

      // User ainda deve conseguir sacar seu stake (sem reward, pois pool foi drenado)
      // Mas o stake original está seguro no contrato
      const contractBalance = await token.balanceOf(await staking.getAddress());
      expect(contractBalance).to.be.gte(STAKE_AMOUNT);
    });
  });

  describe("depositRewards", function () {
    it("deve permitir owner depositar recompensas", async function () {
      const extra = ethers.parseUnits("5000", 18);
      await token.approve(await staking.getAddress(), extra);
      await staking.depositRewards(extra);

      expect(await staking.rewardPool()).to.equal(REWARD_DEPOSIT + extra);
    });

    it("deve rejeitar non-owner depositar", async function () {
      const extra = ethers.parseUnits("100", 18);
      await token.connect(user1).approve(await staking.getAddress(), extra);
      await expect(
        staking.connect(user1).depositRewards(extra)
      ).to.be.reverted;
    });
  });
});
