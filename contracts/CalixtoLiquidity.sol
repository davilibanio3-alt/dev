// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CalixtoLiquidity — Lock de liquidez com lastro BNB
/// @notice Trava LP tokens do PancakeSwap para dar lastro real ao CALXT
/// @dev Sobe pontuação em auditorias (GoPlus, TokenSniffer, DexScreener)
contract CalixtoLiquidity is Ownable {
    using SafeERC20 for IERC20;

    struct LockInfo {
        address lpToken;
        uint256 amount;
        uint256 unlockTime;
        bool withdrawn;
    }

    LockInfo[] public locks;
    uint256 public totalLocks;

    event LiquidityLocked(
        uint256 indexed lockId,
        address lpToken,
        uint256 amount,
        uint256 unlockTime
    );
    event LiquidityUnlocked(uint256 indexed lockId, uint256 amount);
    event LockExtended(uint256 indexed lockId, uint256 newUnlockTime);

    constructor() Ownable(msg.sender) {}

    /// @notice Trava LP tokens por um período mínimo
    /// @param lpToken Endereço do par LP (ex: CALXT/BNB do PancakeSwap)
    /// @param amount Quantidade de LP tokens para travar
    /// @param lockDays Dias de lock (mínimo 90 para boa pontuação)
    function lockLiquidity(
        address lpToken,
        uint256 amount,
        uint256 lockDays
    ) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        require(lockDays >= 90, "Min 90 days lock");
        require(lpToken != address(0), "Invalid LP address");

        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 unlockTime = block.timestamp + (lockDays * 1 days);

        locks.push(LockInfo({
            lpToken: lpToken,
            amount: amount,
            unlockTime: unlockTime,
            withdrawn: false
        }));

        totalLocks++;

        emit LiquidityLocked(locks.length - 1, lpToken, amount, unlockTime);
    }

    /// @notice Estende o lock (só pode aumentar, nunca diminuir)
    function extendLock(uint256 lockId, uint256 extraDays) external onlyOwner {
        require(lockId < locks.length, "Invalid lock ID");
        require(extraDays > 0, "Must extend by > 0 days");
        require(!locks[lockId].withdrawn, "Already withdrawn");

        locks[lockId].unlockTime += extraDays * 1 days;

        emit LockExtended(lockId, locks[lockId].unlockTime);
    }

    /// @notice Saca LP tokens após o período de lock
    function unlock(uint256 lockId) external onlyOwner {
        require(lockId < locks.length, "Invalid lock ID");
        LockInfo storage info = locks[lockId];
        require(!info.withdrawn, "Already withdrawn");
        require(block.timestamp >= info.unlockTime, "Still locked");

        info.withdrawn = true;

        IERC20(info.lpToken).safeTransfer(owner(), info.amount);

        emit LiquidityUnlocked(lockId, info.amount);
    }

    /// @notice Retorna info de um lock específico
    function getLock(uint256 lockId) external view returns (
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        bool withdrawn,
        uint256 daysRemaining
    ) {
        require(lockId < locks.length, "Invalid lock ID");
        LockInfo memory info = locks[lockId];
        uint256 remaining = 0;
        if (block.timestamp < info.unlockTime) {
            remaining = (info.unlockTime - block.timestamp) / 1 days;
        }
        return (info.lpToken, info.amount, info.unlockTime, info.withdrawn, remaining);
    }

    /// @notice Retorna total de locks ativos
    function activeLocks() external view returns (uint256 count) {
        for (uint256 i = 0; i < locks.length; i++) {
            if (!locks[i].withdrawn) count++;
        }
    }
}
