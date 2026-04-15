const hre = require("hardhat");

// ============================================================
// PÓS-DEPLOY: Depositar recompensas + Criar liquidez real
// ============================================================
// USO:
//   1. Edite STAKING_ADDRESS com o endereço retornado pelo deploy.js
//   2. Execute: npx hardhat run scripts/post-deploy.js --network bsc
// ============================================================

const CALXT_TOKEN = "0x4822e7d596772e58C567c5eD0510bb8f8f318d84";

// >>> COLOQUE AQUI o endereço do contrato de staking após o deploy <<<
const STAKING_ADDRESS = "COLOQUE_O_ENDERECO_DO_STAKING_AQUI";

// Quantidade de CALXT para depositar como recompensas (ajuste conforme necessário)
const REWARD_AMOUNT = "10000"; // 10.000 CALXT

// PancakeSwap V2 Router na BSC
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const STAKING_ABI = [
  "function depositRewards(uint256 amount)",
  "function rewardPool() view returns (uint256)",
  "function totalStaked() view returns (uint256)"
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)"
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Wallet:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("BNB disponível:", hre.ethers.formatEther(balance), "BNB\n");

  if (STAKING_ADDRESS === "COLOQUE_O_ENDERECO_DO_STAKING_AQUI") {
    console.log("❌ ERRO: Edite STAKING_ADDRESS neste arquivo com o endereço do deploy!");
    console.log("   Rode primeiro: npx hardhat run scripts/deploy.js --network bsc");
    process.exit(1);
  }

  const token = new hre.ethers.Contract(CALXT_TOKEN, ERC20_ABI, deployer);
  const staking = new hre.ethers.Contract(STAKING_ADDRESS, STAKING_ABI, deployer);
  const decimals = await token.decimals();

  const tokenBalance = await token.balanceOf(deployer.address);
  console.log("CALXT disponível:", hre.ethers.formatUnits(tokenBalance, decimals), "\n");

  // ============================================================
  // PASSO 1: Depositar recompensas no contrato de staking
  // ============================================================
  console.log("=== PASSO 1: Depositar recompensas ===");
  const rewardAmount = hre.ethers.parseUnits(REWARD_AMOUNT, decimals);

  if (tokenBalance < rewardAmount) {
    console.log("❌ Saldo CALXT insuficiente para depositar recompensas");
    console.log("   Necessário:", REWARD_AMOUNT, "CALXT");
    console.log("   Disponível:", hre.ethers.formatUnits(tokenBalance, decimals), "CALXT");
    process.exit(1);
  }

  console.log("Aprovando", REWARD_AMOUNT, "CALXT para o staking...");
  const approveTx1 = await token.approve(STAKING_ADDRESS, rewardAmount);
  await approveTx1.wait();
  console.log("✅ Aprovado. TX:", approveTx1.hash);

  console.log("Depositando recompensas...");
  const depositTx = await staking.depositRewards(rewardAmount);
  await depositTx.wait();
  console.log("✅ Recompensas depositadas. TX:", depositTx.hash);

  const pool = await staking.rewardPool();
  console.log("   Reward pool agora:", hre.ethers.formatUnits(pool, decimals), "CALXT\n");

  // ============================================================
  // PASSO 2: Criar liquidez CALXT/BNB no PancakeSwap
  // ============================================================
  console.log("=== PASSO 2: Criar liquidez no PancakeSwap ===");

  const LIQUIDITY_CALXT = "50000"; // 50.000 CALXT para liquidez
  const LIQUIDITY_BNB = "0.1";     // 0.1 BNB para liquidez (ajuste conforme necessário)

  const liquidityAmount = hre.ethers.parseUnits(LIQUIDITY_CALXT, decimals);
  const bnbAmount = hre.ethers.parseEther(LIQUIDITY_BNB);

  const currentBalance = await token.balanceOf(deployer.address);
  if (currentBalance < liquidityAmount) {
    console.log("⚠️  Saldo CALXT insuficiente para liquidez. Pulando...");
    console.log("   Necessário:", LIQUIDITY_CALXT, "CALXT");
    console.log("   Disponível:", hre.ethers.formatUnits(currentBalance, decimals), "CALXT");
    console.log("   Crie liquidez manualmente em: https://pancakeswap.finance/add/BNB/" + CALXT_TOKEN);
  } else if (balance < bnbAmount) {
    console.log("⚠️  Saldo BNB insuficiente para liquidez. Pulando...");
    console.log("   Necessário:", LIQUIDITY_BNB, "BNB");
    console.log("   Disponível:", hre.ethers.formatEther(balance), "BNB");
    console.log("   Crie liquidez manualmente em: https://pancakeswap.finance/add/BNB/" + CALXT_TOKEN);
  } else {
    const router = new hre.ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, deployer);

    console.log("Aprovando", LIQUIDITY_CALXT, "CALXT para PancakeSwap Router...");
    const approveTx2 = await token.approve(PANCAKE_ROUTER, liquidityAmount);
    await approveTx2.wait();
    console.log("✅ Aprovado. TX:", approveTx2.hash);

    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutos

    console.log("Adicionando liquidez:", LIQUIDITY_CALXT, "CALXT +", LIQUIDITY_BNB, "BNB...");
    const liqTx = await router.addLiquidityETH(
      CALXT_TOKEN,
      liquidityAmount,
      0, // amountTokenMin (0 = aceita qualquer slippage — ajuste para produção)
      0, // amountETHMin
      deployer.address,
      deadline,
      { value: bnbAmount }
    );
    await liqTx.wait();
    console.log("✅ Liquidez criada! TX:", liqTx.hash);
    console.log("   Veja no PancakeSwap: https://pancakeswap.finance/info/v2/pairs/" + CALXT_TOKEN);
  }

  // ============================================================
  // RESUMO
  // ============================================================
  console.log("\n========================================");
  console.log("✅ DEPLOY COMPLETO — BSC MAINNET");
  console.log("========================================");
  console.log("Token CALXT:    ", CALXT_TOKEN);
  console.log("Staking:        ", STAKING_ADDRESS);
  console.log("Reward Pool:    ", hre.ethers.formatUnits(await staking.rewardPool(), decimals), "CALXT");
  console.log("BscScan Token:   https://bscscan.com/token/" + CALXT_TOKEN);
  console.log("BscScan Staking: https://bscscan.com/address/" + STAKING_ADDRESS);
  console.log("PancakeSwap:     https://pancakeswap.finance/swap?outputCurrency=" + CALXT_TOKEN);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
