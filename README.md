# CalixtoSuper Staking & Exchange

Plataforma de staking e exchange para o token CALXT na BSC Mainnet.

## Token

- **Rede:** BNB Smart Chain (BSC)
- **Contrato CALXT:** `0x4822e7d596772e58C567c5eD0510bb8f8f318d84`
- **Explorer:** [BscScan](https://bscscan.com/token/0x4822e7d596772e58C567c5eD0510bb8f8f318d84)

## Estrutura do Projeto

```
contracts/
  CalixtoStaking.sol      # Contrato de staking com recompensas
  CalixtoLiquidity.sol    # Lock de LP tokens (lastro BNB real)
  MockERC20.sol           # Token mock para testes
frontend/
  index.html              # Interface web da exchange
  app.js                  # Lógica de conexão wallet e dashboard
scripts/
  deploy.js               # Deploy individual do staking
  deploy-full.js          # Deploy completo: staking + liquidez + lock LP
  post-deploy.js          # Pós-deploy: recompensas + liquidez
test/
  CalixtoStaking.test.js  # 16 testes automatizados
hardhat.config.js         # Configuração Hardhat (BSC mainnet + testnet)
package.json              # Dependências
```

## Instalação

```bash
npm install
```

## Compilar Contratos

```bash
npx hardhat compile
```

## Testes

```bash
npx hardhat test
```

## Deploy na BSC Mainnet

1. Crie um arquivo `.env`:
```
PRIVATE_KEY=sua_chave_privada_aqui
BSCSCAN_API_KEY=sua_api_key_bscscan
```

2. Deploy:
```bash
npx hardhat run scripts/deploy.js --network bsc
```

3. Verificar no BscScan:
```bash
npx hardhat verify --network bsc ENDERECO_DO_CONTRATO "0x4822e7d596772e58C567c5eD0510bb8f8f318d84"
```

## Deploy Completo (1 comando)

Faz tudo de uma vez: deploy staking, deploy lock, recompensas, liquidez BNB, lock LP:

```bash
npx hardhat run scripts/deploy-full.js --network bsc
```

Isso executa 5 TX reais na mainnet:
1. Deploy `CalixtoStaking` → contrato de staking
2. Deploy `CalixtoLiquidity` → contrato de lock de LP
3. `depositRewards()` → deposita CALXT no pool de recompensas
4. `addLiquidityETH()` → cria par CALXT/BNB no PancakeSwap com BNB real
5. `lockLiquidity()` → trava LP tokens por 365 dias (lastro real)

## Pontuação do Contrato

O que sobe a pontuação em GoPlus / TokenSniffer / DexScreener:

- ✅ Liquidez com BNB real (lastro)
- ✅ LP tokens travados 365 dias (anti-rugpull)
- ✅ Contratos verificados no BscScan
- ✅ SafeERC20 + ReentrancyGuard
- ✅ emergencyWithdraw não toca fundos dos users
- ✅ Código open-source no GitHub

## Frontend

Abra `frontend/index.html` no navegador ou sirva com:

```bash
npx http-server frontend
```

## Segurança

- Contrato usa `SafeERC20` para transferências seguras
- `ReentrancyGuard` protege contra reentrância
- Recompensas são liquidadas automaticamente ao adicionar stake
- `emergencyWithdraw` limitado ao excedente (não toca fundos dos usuários)
- Reward rate máximo: 50% ao ano
