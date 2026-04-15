// ============================================================
// CalixtoSuper Exchange — Frontend (BSC Mainnet)
// ============================================================

const RPC = "https://bsc-dataseed.binance.org/";
const CONTRACT = "0x4822e7d596772e58C567c5eD0510bb8f8f318d84";

const ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

let provider = new ethers.JsonRpcProvider(RPC);
let signer, user, contract;
let tokenDecimals = 18;
let tokenSymbol = "CALXT";
let aiInterval = null;

// ---- CONECTAR WALLET ----
async function connectWallet() {
  if (!window.ethereum) {
    alert("Instale MetaMask ou abra no Trust Wallet");
    return;
  }

  try {
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });

    signer = await browserProvider.getSigner();
    user = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT, ABI, signer);

    document.getElementById("btn-connect").innerText = "Conectado ✓";
    document.getElementById("wallet-addr").innerText = user;

    await loadDashboard();
    loadChart();
    loadTxs();
  } catch (e) {
    console.error("Erro ao conectar:", e);
    alert("Erro ao conectar wallet: " + e.message);
  }
}

// ---- DASHBOARD ----
async function loadDashboard() {
  try {
    const [balance, supply, decimals, symbol] = await Promise.all([
      contract.balanceOf(user),
      contract.totalSupply(),
      contract.decimals(),
      contract.symbol()
    ]);

    tokenDecimals = decimals;
    tokenSymbol = symbol;

    document.getElementById("balance").innerText =
      ethers.formatUnits(balance, decimals) + " " + symbol;

    document.getElementById("supply").innerText =
      ethers.formatUnits(supply, decimals) + " " + symbol;
  } catch (e) {
    console.error("Erro ao carregar dashboard:", e);
  }
}

// ---- ENVIAR TOKEN ----
async function sendToken() {
  if (!signer) return alert("Conecte a wallet primeiro");

  const to = document.getElementById("send-to").value.trim();
  const amountStr = document.getElementById("send-amount").value.trim();

  if (!ethers.isAddress(to)) return alert("Endereço inválido");
  if (!amountStr || isNaN(amountStr) || Number(amountStr) <= 0) {
    return alert("Quantidade inválida");
  }

  try {
    const amount = ethers.parseUnits(amountStr, tokenDecimals);
    const tx = await contract.transfer(to, amount);
    alert("TX enviada: " + tx.hash);
    await tx.wait();
    alert("TX confirmada!");
    await loadDashboard();
  } catch (e) {
    console.error("Erro ao enviar:", e);
    alert("Erro: " + (e.reason || e.message));
  }
}

// ---- GRÁFICO ----
async function loadChart() {
  const ctx = document.getElementById("chart");

  let labels = [];
  let data = [];

  try {
    const url =
      "https://api.bscscan.com/api?module=account&action=tokentx" +
      "&contractaddress=" + CONTRACT +
      "&address=" + CONTRACT +
      "&page=1&offset=10&sort=desc&apikey=YourApiKeyToken";

    const res = await fetch(url);
    const json = await res.json();

    if (json.result && Array.isArray(json.result)) {
      const txs = json.result.reverse();
      txs.forEach(function (tx, i) {
        labels.push("#" + (i + 1));
        data.push(Number(ethers.formatUnits(tx.value, Number(tx.tokenDecimal))));
      });
    }
  } catch (e) {
    console.log("Erro ao buscar dados do gráfico:", e);
  }

  if (data.length === 0) {
    labels = ["1", "2", "3", "4", "5"];
    data = [0, 0, 0, 0, 0];
  }

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Volume " + tokenSymbol,
        data: data,
        borderColor: "#f0b90b",
        backgroundColor: "rgba(240,185,11,0.1)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { labels: { color: "#eee" } } },
      scales: {
        x: { ticks: { color: "#888" } },
        y: { ticks: { color: "#888" } }
      }
    }
  });
}

// ---- TRANSAÇÕES ----
async function loadTxs() {
  try {
    const url =
      "https://api.bscscan.com/api?module=account&action=tokentx" +
      "&contractaddress=" + CONTRACT +
      "&address=" + CONTRACT +
      "&page=1&offset=5&sort=desc&apikey=YourApiKeyToken";

    const res = await fetch(url);
    const data = await res.json();

    const txList = document.getElementById("txs");
    txList.innerHTML = "";

    if (data.result && Array.isArray(data.result)) {
      data.result.forEach(function (tx) {
        var li = document.createElement("li");
        var value = ethers.formatUnits(tx.value, Number(tx.tokenDecimal));
        li.innerText = tx.hash.slice(0, 16) + "... | " + value + " CALXT";
        li.style.cursor = "pointer";
        li.onclick = function () {
          window.open("https://bscscan.com/tx/" + tx.hash, "_blank");
        };
        txList.appendChild(li);
      });
    }
  } catch (e) {
    console.error("Erro TX:", e);
  }
}

// ---- EXPORTAR FUNÇÕES ----
window.connectWallet = connectWallet;
window.sendToken = sendToken;
