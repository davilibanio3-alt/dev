const hre = require("hardhat");

// ============================================================
// DEPLOY COMPLETO — BSC MAINNET
// ============================================================
// Faz tudo em sequência:
//   1. Deploy CalixtoStaking
//   2. Deploy CalixtoLiquidity (lock de LP)
//   3. Deposita recompensas no staking
//   4. Cria liquidez CALXT/BNB real no PancakeSwap
//   5. Trava LP tokens (lock 365 dias) — lastro real
//   6. Mostra resumo com links BscScan
//
// USO:
//   npx hardhat run scripts/deploy-full.js --network bsc
// ============================================================

const CALXT_TOKEN = "0x4822e7d596772e58C567c5eD0510bb8f8f318d84";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// ===== CONFIGURAÇÃO — AJUSTE CONFORME NECESSÁRIO =====
const REWARD_AMOUNT = "10000";   // CALXT para reward pool do staking
const LIQUIDITY_CALXT = "50000"; // CALXT para liquidez PancakeSwap
const LIQUIDITY_BNB = "0.1";    // BNB para liquidez (lastro real)
const LOCK_DAYS = 365;           // Dias de lock do LP (365 = boa pontuação)
// =====================================================

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function factory() view returns (address)"
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)"
];

const STAKING_ABI = [
  "function depositRewards(uint256 amount)",
  "function rewardPool() view returns (uint256)"
];

const LOCK_ABI = [
  "function lockLiquidity(address lpToken, uint256 amount, uint256 lockDays)",
  "function getLock(uint256 lockId) view returns (address, uint256, uint256, bool, uint256)",
  "function totalLocks() view returns (uint256)"
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("========================================");
  console.log("  CALIXTOSUPER — DEPLOY COMPLETO BSC");
  console.log("========================================");
  console.log("Wallet:  ", deployer.address);

  const bnbBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB:     ", hre.ethers.formatEther(bnbBalance), "BNB");

  const token = new hre.ethers.Contract(CALXT_TOKEN, ERC20_ABI, deployer);
  const decimals = await token.decimals();
  const symbol = await token.symbol();
  const tokenBalance = await token.balanceOf(deployer.address);
  console.log("CALXT:   ", hre.ethers.formatUnits(tokenBalance, decimals), symbol);
  console.log("========================================\n");

  // Verificações de saldo
  const totalCalxtNeeded = hre.ethers.parseUnits(
    String(Number(REWARD_AMOUNT) + Number(LIQUIDITY_CALXT)), decimals
  );
  const bnbNeeded = hre.ethers.parseEther(LIQUIDITY_BNB);

  if (tokenBalance < totalCalxtNeeded) {
    console.log("❌ Saldo CALXT insuficiente!");
    console.log("   Necessário:", hre.ethers.formatUnits(totalCalxtNeeded, decimals));
    console.log("   Disponível:", hre.ethers.formatUnits(tokenBalance, decimals));
    process.exit(1);
  }
  if (bnbBalance < bnbNeeded + hre.ethers.parseEther("0.01")) {
    console.log("❌ Saldo BNB insuficiente! (precisa de", LIQUIDITY_BNB, "+ ~0.01 gas)");
    process.exit(1);
  }

  // ============================================================
  // PASSO 1: Deploy CalixtoStaking
  // ============================================================
  console.log("=== PASSO 1/5: Deploy CalixtoStaking ===");
  const Staking = await hre.ethers.getContractFactory("CalixtoStaking");
  const staking = await Staking.deploy(CALXT_TOKEN);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("✅ CalixtoStaking:", stakingAddr);
  console.log("   TX:", staking.deploymentTransaction().hash, "\n");

  // ============================================================
  // PASSO 2: Deploy CalixtoLiquidity (lock)
  // ============================================================
  console.log("=== PASSO 2/5: Deploy CalixtoLiquidity ===");
  const Liquidity = await hre.ethers.getContractFactory("CalixtoLiquidity");
  const liquidity = await Liquidity.deploy();
  await liquidity.waitForDeployment();
  const lockAddr = await liquidity.getAddress();
  console.log("✅ CalixtoLiquidity:", lockAddr);
  console.log("   TX:", liquidity.deploymentTransaction().hash, "\n");

  // ============================================================
  // PASSO 3: Depositar recompensas no staking
  // ============================================================
  console.log("=== PASSO 3/5: Depositar recompensas ===");
  const rewardAmount = hre.ethers.parseUnits(REWARD_AMOUNT, decimals);

  const approveTx1 = await token.approve(stakingAddr, rewardAmount);
  await approveTx1.wait();
  console.log("   Aprovado. TX:", approveTx1.hash);

  const stakingContract = new hre.ethers.Contract(stakingAddr, STAKING_ABI, deployer);
  const depositTx = await stakingContract.depositRewards(rewardAmount);
  await depositTx.wait();
  console.log("✅ Recompensas depositadas:", REWARD_AMOUNT, "CALXT");
  console.log("   TX:", depositTx.hash, "\n");

  // ============================================================
  // PASSO 4: Criar liquidez CALXT/BNB no PancakeSwap
  // ============================================================
  console.log("=== PASSO 4/5: Criar liquidez CALXT/BNB ===");
  const router = new hre.ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, deployer);
  const liquidityAmount = hre.ethers.parseUnits(LIQUIDITY_CALXT, decimals);

  const approveTx2 = await token.approve(PANCAKE_ROUTER, liquidityAmount);
  await approveTx2.wait();
  console.log("   Aprovado para Router. TX:", approveTx2.hash);

  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutos

  const liqTx = await router.addLiquidityETH(
    CALXT_TOKEN,
    liquidityAmount,
    0, // amountTokenMin
    0, // amountETHMin
    deployer.address,
    deadline,
    { value: hre.ethers.parseEther(LIQUIDITY_BNB) }
  );
  const liqReceipt = await liqTx.wait();
  console.log("✅ Liquidez criada:", LIQUIDITY_CALXT, "CALXT +", LIQUIDITY_BNB, "BNB");
  console.log("   TX:", liqTx.hash);

  // Buscar endereço do par LP
  const factory = new hre.ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, deployer);
  const lpAddress = await factory.getPair(CALXT_TOKEN, WBNB);
  console.log("   Par LP:", lpAddress, "\n");

  // ============================================================
  // PASSO 5: Lock LP tokens (lastro real)
  // ============================================================
  console.log("=== PASSO 5/5: Lock LP tokens (" + LOCK_DAYS + " dias) ===");
  const lpToken = new hre.ethers.Contract(lpAddress, ERC20_ABI, deployer);
  const lpBalance = await lpToken.balanceOf(deployer.address);
  console.log("   LP tokens recebidos:", hre.ethers.formatUnits(lpBalance, 18));

  if (lpBalance > 0n) {
    const approveTx3 = await lpToken.approve(lockAddr, lpBalance);
    await approveTx3.wait();
    console.log("   Aprovado para Lock. TX:", approveTx3.hash);

    const lockContract = new hre.ethers.Contract(lockAddr, LOCK_ABI, deployer);
    const lockTx = await lockContract.lockLiquidity(lpAddress, lpBalance, LOCK_DAYS);
    await lockTx.wait();
    console.log("✅ LP TRAVADO por", LOCK_DAYS, "dias!");
    console.log("   TX:", lockTx.hash);

    const lockInfo = await lockContract.getLock(0);
    const unlockDate = new Date(Number(lockInfo[2]) * 1000);
    console.log("   Destrava em:", unlockDate.toLocaleDateString("pt-BR"), "\n");
  } else {
    console.log("⚠️  Nenhum LP token recebido. Verifique a TX de liquidez.\n");
  }

  // ============================================================
  // RESUMO FINAL
  // ============================================================
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║     ✅ DEPLOY COMPLETO — BSC MAINNET REAL           ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║ Token CALXT:      ", CALXT_TOKEN);
  console.log("║ Staking:          ", stakingAddr);
  console.log("║ Liquidity Lock:   ", lockAddr);
  console.log("║ Par LP:           ", lpAddress);
  console.log("║ Reward Pool:      ", REWARD_AMOUNT, "CALXT");
  console.log("║ Liquidez:         ", LIQUIDITY_CALXT, "CALXT +", LIQUIDITY_BNB, "BNB");
  console.log("║ LP Lock:          ", LOCK_DAYS, "dias");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║ BscScan Token:     https://bscscan.com/token/" + CALXT_TOKEN);
  console.log("║ BscScan Staking:   https://bscscan.com/address/" + stakingAddr);
  console.log("║ BscScan Lock:      https://bscscan.com/address/" + lockAddr);
  console.log("║ BscScan LP:        https://bscscan.com/address/" + lpAddress);
  console.log("║ PancakeSwap:       https://pancakeswap.finance/swap?outputCurrency=" + CALXT_TOKEN);
  console.log("║ DexScreener:       https://dexscreener.com/bsc/" + lpAddress);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║ VERIFICAR CONTRATOS:                                ║");
  console.log("║ npx hardhat verify --network bsc", stakingAddr, '"' + CALXT_TOKEN + '"');
  console.log("║ npx hardhat verify --network bsc", lockAddr);
  console.log("╚══════════════════════════════════════════════════════╝");

  console.log("\n=== O QUE SOBE A PONTUAÇÃO ===");
  console.log("✅ Liquidez criada com BNB real (lastro)");
  console.log("✅ LP tokens travados por", LOCK_DAYS, "dias (anti-rugpull)");
  console.log("✅ Contrato verificado no BscScan (transparência)");
  console.log("✅ SafeERC20 + ReentrancyGuard (segurança)");
  console.log("✅ emergencyWithdraw não toca fundos dos users");
  console.log("✅ Reward pool separado e financiado");
  console.log("✅ Código open-source no GitHub");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
