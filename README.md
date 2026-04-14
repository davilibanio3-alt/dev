[2/4 03:33] Davi Calixto: https://20lab.app/token/bnb-smart-chain/0x4822e7d596772e58C567c5eD0510bb8f8f318d84
[9/4 00:31] Davi Calixto: 0x4822e7d596772e58C567c5eD0510bb8f8f318d84
[12/4 22:54] Davi Calixto: // SPDX-License-Identifier: MIT
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
[13/4 15:17] Davi Calixto: <!DOCTYPE html>
<html>
<head>
  <title>CalixtoSuper Exchange</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <script src="https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>

<body style="background:#0b0e11;color:white;font-family:Arial;text-align:center">

<h1>📊 Calixto Exchange</h1>

<button onclick="connectWallet()">Conectar</button>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">

<div>
  <h3>💰 Saldo</h3>
  <p id="balance">-</p>

  <h3>📦 Supply</h3>
  <p id="supply">-</p>

  <h3>🤖 IA</h3>
  <p id="ai">OFF</p>

  <button onclick="sendToken()">Enviar Token</button>
</div>

<div>
  <h3>📈 Gráfico</h3>
  <canvas id="chart"></canvas>
</div>

</div>

<h3>📜 Últimas Transações</h3>
<ul id="txs"></ul>

<script src="app.js"></script>

</body>
</html>
[13/4 15:18] Davi Calixto: const RPC = "https://bsc-dataseed.binance.org/";

const CONTRACT = "0x4822e7d596772e58C567c5eD0510bb8f8f318d84";

const ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint amount)"
];

let provider = new ethers.JsonRpcProvider(RPC);
let signer, user, contract;

// CONECTAR WALLET
async function connectWallet() {
  if (!window.ethereum) {
    alert("Abra no MetaMask ou Trust Wallet");
    return;
  }

  const browserProvider = new ethers.BrowserProvider(window.ethereum);

  await window.ethereum.request({ method: "eth_requestAccounts" });

  signer = await browserProvider.getSigner();
  user = await signer.getAddress();

  contract = new ethers.Contract(CONTRACT, ABI, signer);

  loadDashboard();
  loadChart();
  loadTxs();
  runAI();
}

// DASHBOARD
async function loadDashboard() {
  const [balance, supply, decimals, symbol] = await Promise.all([
    contract.balanceOf(user),
    contract.totalSupply(),
    contract.decimals(),
    contract.symbol()
  ]);

  document.getElementById("balance").innerText =
    ethers.formatUnits(balance, decimals) + " " + symbol;

  document.getElementById("supply").innerText =
    ethers.formatUnits(supply, decimals);
}

// ENVIAR TOKEN
async function sendToken() {
  if (!signer) return alert("Conecte a wallet");

  const tx = await contract.transfer(
    "0x000000000000000000000000000000000000dead",
    ethers.parseUnits("1", 18)
  );

  alert("TX: " + tx.hash);
}

// GRÁFICO
function loadChart() {
  const ctx = document.getElementById("chart");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: ["1","2","3","4","5","6"],
      datasets: [{
        label: "Preço CALXT",
        data: [1,2,1.5,3,2.5,4]
      }]
    }
  });
}

// TRANSAÇÕES
async function loadTxs() {
  try {
    const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${CONTRACT}&startblock=0&endblock=99999999&sort=desc`;

    const res = await fetch(url);
    const data = await res.json();

    const txList = document.getElementById("txs");
    txList.innerHTML = "";

    data.result.slice(0,5).forEach(tx => {
      let li = document.createElement("li");
      li.innerText = tx.hash.slice(0,12) + "...";
      txList.appendChild(li);
    });
  } catch (e) {
    console.log("Erro TX:", e);
  }
}

// IA
function runAI() {
  setInterval(async () => {
    const block = await provider.getBlockNumber();

    document.getElementById("ai").innerText =
      block % 2 === 0 ? "📈 Alta" : "📉 Baixa";

  }, 4000);
}

// EXPORTAR FUNÇÕES
window.connectWallet = connectWallet;
window.sendToken = sendToken;
