// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CalixtoStaking is ReentrancyGuard, Ownable {
    IERC20 public immutable token;
    
    struct Stake {
        uint256 amount;
        uint256 startTime;
    }
    
    mapping(address => Stake) public stakes;
    
    uint256 public rewardRate = 10; // 10% ao ano
    uint256 public totalStaked;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 reward);
    event RewardRateUpdated(uint256 newRate);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        token.transferFrom(msg.sender, address(this), amount);
        
        stakes[msg.sender].amount += amount;
        if (stakes[msg.sender].startTime == 0) {
            stakes[msg.sender].startTime = block.timestamp;
        }
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }

    function calculateReward(address user) public view returns (uint256) {
        Stake memory s = stakes[user];
        if (s.amount == 0) return 0;
        
        uint256 duration = block.timestamp - s.startTime;
        return (s.amount * rewardRate * duration) / (365 days * 100);
    }

    function withdraw() external nonReentrant {
        Stake memory s = stakes[msg.sender];
        require(s.amount > 0, "No active stake");
        
        uint256 reward = calculateReward(msg.sender);
        uint256 total = s.amount + reward;
        
        stakes[msg.sender].amount = 0;
        totalStaked -= s.amount;
        
        token.transfer(msg.sender, total);
        
        emit Withdrawn(msg.sender, s.amount, reward);
    }

    // Administração (só o dono)
    function setRewardRate(uint256 newRate) external onlyOwner {
        require(newRate <= 50, "Max 50% ao ano");
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    function emergencyWithdraw() external onlyOwner {
        token.transfer(owner(), token.balanceOf(address(this)));
    }
}
