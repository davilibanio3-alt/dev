// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CalixtoStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 accruedReward;
    }

    mapping(address => Stake) public stakes;

    uint256 public rewardRate = 10; // 10% ao ano
    uint256 public totalStaked;
    uint256 public rewardPool;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 reward);
    event RewardRateUpdated(uint256 newRate);
    event RewardsDeposited(address indexed from, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    /// @notice Deposita tokens no pool de recompensas (somente owner)
    function depositRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        token.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardsDeposited(msg.sender, amount);
    }

    /// @notice Faz stake de tokens CALXT
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Liquida recompensas acumuladas antes de alterar o saldo
        if (stakes[msg.sender].amount > 0) {
            stakes[msg.sender].accruedReward += _pendingReward(msg.sender);
        }

        token.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].startTime = block.timestamp;

        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /// @notice Calcula recompensa pendente desde o ultimo startTime
    function _pendingReward(address user) internal view returns (uint256) {
        Stake memory s = stakes[user];
        if (s.amount == 0) return 0;

        uint256 duration = block.timestamp - s.startTime;
        return (s.amount * rewardRate * duration) / (365 days * 100);
    }

    /// @notice Retorna recompensa total (acumulada + pendente)
    function calculateReward(address user) public view returns (uint256) {
        return stakes[user].accruedReward + _pendingReward(user);
    }

    /// @notice Saca stake + recompensas
    function withdraw() external nonReentrant {
        Stake storage s = stakes[msg.sender];
        require(s.amount > 0, "No active stake");

        uint256 reward = s.accruedReward + _pendingReward(msg.sender);
        require(reward <= rewardPool, "Insufficient reward pool");

        uint256 stakedAmount = s.amount;
        uint256 total = stakedAmount + reward;

        // Zera tudo antes da transferencia (CEI pattern)
        s.amount = 0;
        s.startTime = 0;
        s.accruedReward = 0;

        totalStaked -= stakedAmount;
        rewardPool -= reward;

        token.safeTransfer(msg.sender, total);

        emit Withdrawn(msg.sender, stakedAmount, reward);
    }

    /// @notice Atualiza taxa de recompensa (somente owner)
    function setRewardRate(uint256 newRate) external onlyOwner {
        require(newRate <= 50, "Max 50% ao ano");
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    /// @notice Saque de emergencia — somente o excedente do reward pool
    function emergencyWithdraw() external onlyOwner {
        uint256 excess = token.balanceOf(address(this)) - totalStaked;
        require(excess > 0, "No excess to withdraw");
        token.safeTransfer(owner(), excess);
    }
}
