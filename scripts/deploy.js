const hre = require("hardhat");

async function main() {
  const CALXT_TOKEN = "0x4822e7d596772e58C567c5eD0510bb8f8f318d84";

  console.log("Deploying CalixtoStaking na rede:", hre.network.name);
  console.log("Token CALXT:", CALXT_TOKEN);

  const CalixtoStaking = await hre.ethers.getContractFactory("CalixtoStaking");
  const staking = await CalixtoStaking.deploy(CALXT_TOKEN);

  await staking.waitForDeployment();

  const address = await staking.getAddress();
  console.log("CalixtoStaking deployed em:", address);

  console.log("\n--- Próximos passos ---");
  console.log("1. Verificar no BscScan:");
  console.log("   npx hardhat verify --network bsc " + address + ' "' + CALXT_TOKEN + '"');
  console.log("2. Depositar tokens de recompensa:");
  console.log("   Chame depositRewards() com tokens CALXT aprovados");
  console.log("3. Adicionar liquidez no PancakeSwap:");
  console.log("   https://pancakeswap.finance/add/" + CALXT_TOKEN + "/BNB");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
