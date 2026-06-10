// Import Vercel Analytics
import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject();

const RPC = "https://bsc-dataseed.binance.org/";

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
