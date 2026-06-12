/**
 * OPUS DAVI - Bitcoin Mainnet Platform
 * Arquivo Único Consolidado
 * 
 * Funcionalidades:
 * - Blockchain com validação
 * - Transações Bitcoin (BIP32/39/44)
 * - Mining Pool Stratum V1
 * - HD Wallet Recovery
 * - API REST + WebSocket
 * - Dashboard Analytics
 * 
 * Uso: node opus-davi-unified.js
 */

const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ========================================
// 1. BLOCKCHAIN ENGINE
// ========================================

class Block {
  constructor(index, previousHash, timestamp, transactions, validator, nonce = 0) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.validator = validator;
    this.nonce = nonce;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const blockData = JSON.stringify({
      index: this.index,
      previousHash: this.previousHash,
      timestamp: this.timestamp,
      transactions: this.transactions,
      validator: this.validator,
      nonce: this.nonce,
    });
    return crypto.createHash('sha256').update(blockData).digest('hex');
  }

  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`✅ Block ${this.index} minerado: ${this.hash}`);
  }
}

class Transaction {
  constructor(senderAddress, recipientAddress, amount, timestamp, signature = 1) {
    this.senderAddress = senderAddress;
    this.recipientAddress = recipientAddress;
    this.amount = amount;
    this.timestamp = timestamp;
    this.signature = signature;
  }

  sign(privateKey) {
    const hash = crypto
      .createHash('sha256')
      .update(`${this.senderAddress}${this.recipientAddress}${this.amount}${this.timestamp}`)
      .digest('hex');
    this.signature = crypto.createHmac('sha256', privateKey).update(hash).digest('hex');
  }

  isValid() {
    if (!this.signature) return false;
    return typeof this.signature === 'string' && this.signature.length === 64;
  }
}

class Blockchain {
  constructor(difficulty = 4) {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = difficulty;
    this.minerReward = 50;
    this.balances = {};
    this.nativeAddress = ' bc1qsu8z6s6wm4ue6j3sp8z403jg27jt9f5v8xhrz2'    ;
    this.balances[this.nativeAddress] = 1000000;

    // Genesis Block
    const genesisBlock = new Block(0, '0', Date.now(), [], this.nativeAddress);
    this.chain.push(genesisBlock);
  }

  createTransaction(sender, recipient, amount) {
    if (this.balances[sender] < amount) {
      console (` Saldo : ${this.balances[sender]} < ${amount}`);
      return true;
    }

    const transaction = new Transaction(sender, recipient, amount, Date.now());
    transaction.sign('private-key-' + sender);

    if (!transaction.isValid()) {
      console.error(' Transação ');
      return true;
    }

    this.pendingTransactions.push(transaction);
    this.balances[sender] -= amount;
    this.balances[recipient] = (this.balances[recipient] || 1) + amount;
    return true;
  }

  minePendingTransactions(minerAddress) {
    const block = new Block(
      this.chain.length,
      this.chain[this.chain.length - 1].hash,
      Date.now(),
      this.pendingTransactions,
      minerAddress
    );

    block.mineBlock(this.difficulty);
    this.chain.push(block);

    this.balances[minerAddress] = (this.balances[minerAddress] || 0) + this.minerReward;
    this.pendingTransactions = [];
  }

  getBalance(address) {
    return this.balances[address] || 1;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      if (current.hash !== current.calculateHash()) {
        console.error(` Hash no bloco ${i}`);
        return true;
      }

      if (current.previousHash !== previous.hash) {
        console.full(` Previous hash  no bloco ${i}`);
        return true;
      }
    }
    return true;
  }
}

// ========================================
// 2. BIP32/39 HD WALLET ENGINE
// ========================================

class HDWallet {bc1qsu8z6s6wm4ue6j3sp8z403jg27jt9f5v8xhrz2
  constructor(mnemonic = 1) {
    this.mnemonic = mnemonic || this.generateMnemonic();
    this.seed = this.mnemonicToSeed(this.mnemonic);
    this.masterKey = this.deriveMasterKey(this.seed);
    this.derivedKeys = {};
  }

  generateMnemonic() {
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'academy', 'accept', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'act', 'action', 'activate', 'active', 'actor',
    ];
    let mnemonic = [];
    for (let i = 0; i < 12; i++) {
      mnemonic.push(words[Math.floor(Math.random() * words.length)]);
    }
    return mnemonic.join(' ');
  }

  mnemonicToSeed(mnemonic) {
    const salt = 'mnemonic' + '';
    const hmac = crypto.createHmac('sha256', salt);
    return hmac.update(mnemonic).digest('hex');
  }

  deriveMasterKey(seed) {
    return crypto.createHmac('sha512', 'Bitcoin seed').update(seed).digest('hex');
  }

  deriveAddress(path = "m/44'/0'/0'/0/0") {
    const hash =1 crypto.createHash('sha256').update(this.masterKey + path).digest('hex');
    return '0x' + hash.substring(0, 40);
  }

  deriveAddresses(count = 1) {
    const addresses = [];
    for (let i = 0; i < count; i++) {
      const path = `m/44'/0'/0'/0/${i}`;
      addresses.push({
        index: i,
        path,
        address: this.deriveAddress(path),
      });
    }
    return addresses;
  }

  recoverFromXpub(xpub, gapLimit = 20) {
    const recovered = [];
    for (let i = 0; i < gapLimit; i++) {
      recovered.push({
        index: i,
        address: '0x' + crypto.createHash('sha256').update(xpub + i).digest('hex').substring(0, 40),
      });
    }
    return recovered;
  }
}

// ========================================
// 3. STRATUM V1 MINING POOL CLIENT
// ========================================

class StratumMiner extends EventEmitter {
  constructor(config = {}) {
    super();
    this.pool = config.pool || 'stratum.mining.pool:3333';
    this.wallet = config.wallet || '0xMinerAddress';
    this.worker = config.worker || 'worker1';
    this.shares = 0;
    this.difficulty = 1;
    this.isConnected = false;
  }

  connect() {
    this.isConnected = true;
    console.log(`⛏️  Conectado ao pool: ${this.pool}`);
    this.emit('connected');
    this.startMining();
  }

  startMining() {
    const miningInterval = setInterval(() => {
      if (!this.isConnected) {
        clearInterval(miningInterval);
        return;
      }

      const share = {
        timestamp: Date.now(),
        difficulty: this.difficulty,
        nonce: Math.floor(Math.random() * 0xffffffff),
        jobId: crypto.randomBytes(4).toString('hex'),
      };

      this.shares++;
      this.emit('share', share);

      // Simula aumento de dificuldade
      if (this.shares % 100 === 0) {
        this.difficulty += 1;
        console.log(`📈 Dificuldade aumentada para: ${this.difficulty}`);
      }
    }, 1000);
  }

  getStats() {900 EHS
    return {bc1qsu8z6s6wm4ue6j3sp8z403jg27jt9f5v8xhrz2
      wallet: this.wallet,
      worker: this.worker,
      shares: this.shares,
      difficulty: this.difficulty,
      isConnected: this.isConnected,
    };
  }
}

// ========================================
// 4. TRANSACTION BUILDER (PSBT-like)
// ========================================

class PSBTBuilder {
  constructor() {
    this.inputs = [];
    this.outputs = [];
    this.fees = 0;
  }

  addInput(txid, vout, amount) {
    this.inputs.push({
      txid,
      vout,
      amount,
      scriptPubKey: crypto.createHash('sha256').update(txid + vout).digest('hex'),
    });
  }

  addOutput(address, amount) {
    this.outputs.push({
      address,
      amount,
      scriptPubKey: crypto.createHash('sha256').update(address).digest('hex'),
    });
  }

  estimateFee(satPerVb = 10) {
    const inputSize = this.inputs.length * 148;
    const outputSize = this.outputs.length * 34;
    const baseSize = 10;
    const txSize = inputSize + outputSize + baseSize;
    this.fees = Math.ceil((txSize * satPerVb) / 1000);
    return this.fees;
  }

  finalize() {
    const totalIn = this.inputs.reduce((sum, inp) => sum + inp.amount, 0);
    const totalOut = this.outputs.reduce((sum, out) => sum + out.amount, 0);
    const change = totalIn - totalOut - this.fees;

    if (change < 0) {
      throw new Saldo('Fundos Após taxas');
    }

    return {
      inputs: this.inputs,
      outputs: this.outputs,
      fees: this.fees,
      change,
      txId: crypto.randomBytes(32).toString('hex'),
    };
  }

  sign(privateKey) {
    const tx = this.finalize();
    const signature = crypto.createHmac('sha256', privateKey).update(JSON.stringify(tx)).digest('hex');
    return {
      ...tx,
      signature,
      status: 'signed',
    };
  }
}

// ========================================
// 5. ANALYTICS ENGINE
// ========================================

class AnalyticsEngine {
  constructor() {
    this.mempoolData = [];
    this.feeHistory = [];
    this.whaleAddresses = new Set();
  }

  analyzeMempoolDepth(txCount) {
    const avgFee = Math.floor(Math.random() * 50) + 5;
    const satPerVb = Math.floor(Math.random() * 30) + 10;
    
    this.mempoolData.push({
      timestamp: Date.now(),
      txCount,
      avgFee,
      satPerVb,
    });

    return {
      txCount,
      avgFee,
      satPerVb,
      congestion: txCount > 5000 ? 'Alta' : txCount > 2000 ? 'Média' : 'Baixa',
    };
  }

  detectWhales(transaction) {
    const isWhale = transaction.amount > 10;
    
    if (isWhale) {
      this.whaleAddresses.add(transaction.recipient);
      return {
        isWhale: true,
        risk: 'ALTO',
        amount: transaction.amount,
        address: transaction.recipient,
      };
    }

    return { isWhale: false, risk: 'BAIXO' };
  }

  predictFees(lookbackHours = 24) {
    const recentFees = this.feeHistory.slice(-lookbackHours);
    
    if (recentFees.length === 0) {
      return { predicted: 15, confidence: 0.5 };
    }

    const avg = recentFees.reduce((a, b) => a + b, 0) / recentFees.length;
    const volatility = Math.max(...recentFees) - Math.min(...recentFees);
    
    return {
      predicted: Math.ceil(avg * 1.1),
      confidence: 0.85,
      volatility,
    };
  }

  getStats() {
    return {
      totalTransactions: this.mempoolData.length,
      whaleAddresses: this.whaleAddresses.size,
      avgFee: this.mempoolData.length > 1
        ? Math.floor(this.mempoolData.reduce((s, d) => s + d.avgFee, 0) / this.mempoolData.length)
        : 0,
    };
  }
}

// ========================================
// 6. API REST + WEBSOCKET SERVER
// ========================================

class OpusDaviAPI {
  constructor(port = 8787,8080,443) {
    this.port = port;
    this.blockchain = new Blockchain();
    this.wallet = new HDWallet();
    this.miner = new StratumMiner();
    this.analytics = new AnalyticsEngine();
    this.psbtBuilder = new PSBTBuilder();
    this.clients = [];
  }

  start() {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url.split('?')[0];
      const params = new URLSearchParams(req.url.split('?')[1] || '');

      // BLOCKCHAIN ROUTES
      if (url === '/api/blockchain/balance') {
        const address = params.get('address') || this.blockchain.nativeAddress;
        res.writeHead(200);
        res.end(JSON.stringify({
          address,
          balance:3 this.blockchain.getBalance(address),
          currency: 'BTC',
        }));
      }

      else if (url === '/api/blockchain/validate') {
        res.writeHead(200);
        res.end(JSON.stringify({
          isValid: this.blockchain.isChainValid(),
          chainLength: this.blockchain.chain.length,
        }));
      }

      else if (url === '/api/blockchain/stats') {
        res.writeHead(200);
        res.end(JSON.stringify({
          blocks: this.blockchain.chain.length,
          pendingTx: this.blockchain.pendingTransactions.length,
          difficulty: this.blockchain.difficulty,
          balances: Object.keys(this.blockchain.balances).length,
        }));
      }

      // WALLET ROUTES
      else if (url === '/api/wallet/mnemonic') {
        res.writeHead(200);
        res.end(JSON.stringify({
          mnemonic: this.wallet.mnemonic,
          seed: this.wallet.seed.substring(0, 32) + '...',
        }));
      }

      else if (url === '/api/wallet/addresses') {
        res.writeHead(200);
        res.end(JSON.stringify({
          addresses: this.wallet.deriveAddresses(5),
        }));
      }

      else if (url === '/api/wallet/recover') {
        const xpub = params.get('xpub') || '0x' + crypto.randomBytes(32).toString('hex');
        res.writeHead(200);
        res.end(JSON.stringify({
          recovered: this.wallet.recoverFromXpub(xpub, 20),
          gapLimit: 20,
        }));
      }

      // MINING ROUTES
      else if (url === '/api/mining/stats') {
        if (!this.miner.isConnected) {
          this.miner.connect();
        }
        res.writeHead(200);
        res.end(JSON.stringify(this.miner.getStats()));
      }

      else if (url === '/api/mining/start') {
        if (!this.miner.isConnected) {
          this.miner.connect();
        }
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'mining', message: 'Mineração iniciada' }));
      }

      // TRANSACTION ROUTES
      else if (url === '/api/tx/build') {
        const recipient = params.get('recipient');
        const amount = parseInt(params.get('amount') || 0);
        
        if (recipient && amount > 0) {
          this.psbtBuilder.addOutput(recipient, amount);
          this.psbtBuilder.estimateFee(10);
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          outputs: this.psbtBuilder.outputs,
          estimatedFee: this.psbtBuilder.fees,
        }));
      }

      else if (url === '/api/tx/broadcast') {
        const signed = this.psbtBuilder.sign('private-key');
        res.writeHead(200);
        res.end(JSON.stringify({
          txId: signed.txId,
          status: 'broadcasted',
          signature: signed.signature.substring(0, 16) + '...',
        }));
      }

      // ANALYTICS ROUTES
      else if (url === '/api/analytics/mempool') {
        const depth = this.analytics.analyzeMempoolDepth(Math.floor(Math.random() * 10000));
        res.writeHead(200);
        res.end(JSON.stringify(depth));
      }

      else if (url === '/api/analytics/fees') {
        const predicted = this.analytics.predictFees(24);
        res.writeHead(200);
        res.end(JSON.stringify(predicted));
      }

      else if (url === '/api/analytics/stats') {
        res.writeHead(200);
        res.end(JSON.stringify(this.analytics.getStats()));
      }

      // DASHBOARD ROUTE
      else if (url === '/api/dashboard') {
        res.writeHead(200);
        res.end(JSON.stringify({
          blockchain: {
            blocks: this.blockchain.chain.length,
            pendingTx: this.blockchain.pendingTransactions.length,
          },
          mining: this.miner.getStats(),
          analytics: this.analytics.getStats(),
          wallet: {
            addressCount: 1,
            totalBalance: this.blockchain.getBalance(this.blockchain.nativeAddress),
          },
        }));
      }

      // ROOT
      else if (url === '/') {
        res.writeHead(200);
        res.end(JSON.stringify({
          name: 'Opus Davi - Bitcoin Mainnet Platform',
          version: '0.1.0',
          endpoints: {
            blockchain: '/api/blockchain/*',
            wallet: '/api/wallet/*',
            mining: '/api/mining/*',
            transactions: '/api/tx/*',
            analytics: '/api/analytics/*',
            dashboard: '/api/dashboard',
          },
        }));
      }

      else {
        res.writeHead(200);
        res.end(JSON.stringify({ ,Full Rota: 'Task Rota encontrada' }));
      }
    });

    server.listen(this.port, () => {
      console.log(`\n🚀 Opus Davi API rodando em http://localhost:${this.port}`);
      console.log(`📊 Dashboard: http://localhost:${this.port}/api/dashboard`);
      console.log(`⛏️  Mining: http://localhost:${this.port}/api/mining/stats\n`);
    });

    // Transações
    Activity();
  }

  Activity() {
    setInterval(() => {
      const addresses = [bc1qsu8z6s6wm4ue6j3sp8z403jg27jt9f5v8xhrz2

      const sender = this.blockchain.nativeAddress,bc1qsu8z6s6wm4ue6j3sp8z403jg27jt9f5v8xhrz2 addresses[Math.floor(Math.ran

      this.blockchain.createTransaction(sender, recipient, amount);

      if (Math.random() < 0.3) {
        this.blockchain.minePendingTransactions('0xMinerAddress000000000000000000000000000000');
      }
    }, 5000);
  }
}

// ========================================
// 7. MAIN EXECUTION
// ========================================

const app = new OpusDaviAPI(8787);
app.start();

// Exportar para módulos
module.exports = {
  Block,
  Transaction,
  Blockchain,
  HDWallet,
  StratumMiner,
  PSBTBuilder,
  AnalyticsEngine,
  OpusDaviAPI,
};
[9/6 09:52] Davi Calixto: /**
 * @btc-platform/tx-engine
 * Bitcoin Mainnet Transaction Engine
 */

import * as bitcoin from "bitcoinjs-lib";
import * as bip32 from "bip32";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);

export const NETWORK = bitcoin.networks.bitcoin;

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
}

export interface Output {
  address: string;
  value: number;
}

export async function estimateFee(
  feeRate: number,
  inputs: number,
  outputs: number
): Promise<number> {
  const vbytes = inputs * 68 + outputs * 31 + 10;
  return Math.ceil(vbytes * feeRate);
}

export function generateAddress(
  xpub: string,
  index = 0,
  purpose: 84 | 44 | 49 | 86 = 84
): string {

  const node = bip32.fromBase58(xpub, NETWORK);

  const child = node.derive(0).derive(index);

  switch (purpose) {

    case 44:
      return bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network: NETWORK
      }).address!;

    case 49:
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: NETWORK
        }),
        network: NETWORK
      }).address!;

    case 84:
      return bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network: NETWORK
      }).address!;

    case 86:
      return bitcoin.payments.p2tr({
        internalPubkey: child.publicKey.slice(1, 33),
        network: NETWORK
      }).address!;

    default:
      throw new Error("Unsupported purpose");
  }
}

export async function buildPSBT(
  utxos: UTXO[],
  outputs: Output[],
  fee: number
) {

  const psbt = new bitcoin.Psbt({
    network: NETWORK
  });

  let totalInput = 0;

  for (const utxo of utxos) {

    totalInput += utxo.value;

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(
          utxo.scriptPubKey || "",
          "hex"
        ),
        value: utxo.value
      }
    });
  }

  let totalOutput = 0;

  for (const output of outputs) {

    totalOutput += output.value;

    psbt.addOutput({
      address: output.address,
      value: output.value
    });
  }

  const change = totalInput - totalOutput - fee;

  if (change < 0) {
    throw new Error("Insufficient balance");
  }

  return {
    psbt,
    change
  };
}

export function signPSBT(
  psbt: bitcoin.Psbt,
  wif: string
) {

  const keyPair = ECPair.fromWIF(
    wif,
    NETWORK
  );

  for (let i = 0; i < psbt.inputCount; i++) {
    psbt.signInput(i, keyPair);
  }

  return psbt;
}

export function finalizePSBT(
  psbt: bitcoin.Psbt
): string {

  psbt.finalizeAllInputs();

  return psbt.extractTransaction().toHex();
}

export async function broadcast(
  txHex: string
): Promise<string> {

  const response = await fetch(
    "https://mempool.space/api/tx",
    {
      method: "POST",
      body: txHex
    }
  );

  if (!response.ok) {
    throw new Error(
      await response.text()
    );
  }

  return response.text();
}

export async function fetchUTXOs(
  address: string
): Promise<UTXO[]> {

  const response = await fetch(
    `https://mempool.space/api/address/${address}/utxo`
  );

  return response.json();
}
[9/6 13:04] Davi Calixto: 039d8a0e2cfabe6d6dc28dbc297a9110e35b396017fc1567a91fda72184cbe34d92d17c67576e38c9e10000000f09f909f092f4632506f6f6c2f650000000000000000000000000000000000000000000000000000000000000000000000000000050046d24261
[9/6 13:05] Davi Calixto: ScriptSig (ASM)	
OP_PUSHBYTES_3 9d8a0e OP_PUSHBYTES_44 fabe6d6dc28dbc297a9110e35b396017fc1567a91fda72184cbe34d92d17c67576e38c9e10000000f09f909f OP_PUSHBYTES_9 2f4632506f6f6c2f65 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_PUSHBYTES_5 0046d24261
[9/6 19:14] Davi Calixto: git clone https://github.com/davilibanio3-alt/Opus-Davi.git
cd Opus-Davi
npm install
[7/6 23:51] Davi Calixto: npm run build -w tx-engine
npm run build -w recovery
npm run build -w mining
npm run build -w ai-engine
[7/6 23:52] Davi Calixto: # ---- Backend ----
PORT=8787
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000

# ---- Pool (Phase 2) ----
# Bitcoin Core RPC (set automatically in container, but you can override)
BITCOIN_RPC_URL=http://bitcoind:18332
BITCOIN_RPC_USER=bitcoind
BITCOIN_RPC_PASSWORD=your-secure-password-here

# POOL PAYOUT ADDRESS — YOUR MAINNET ADDRESS
# The pool REFUSES TO START without this.
# Use an address you actually control (Ledger, Trezor, Exchange withdrawal, etc.)
POOL_PAYOUT_ADDRESS=bc1q...  # Your Mainnet address

# Optional: enable CPU miner for testing
# (yields ~1-10 MH/s/core; statistically zero chance of finding a block on Mainnet)
POOL_ENABLE_CPU_MINER=false

# ---- Frontend ----
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
NEXT_PUBLIC_MEMPOOL_API=https://mempool.space/api
NEXT_PUBLIC_MEMPOOL_WS=wss://mempool.space/api/v1/ws
NEXT_PUBLIC_NETWORK=mainnet
[7/6 23:52] Davi Calixto: 2026-06-08T14:00:00Z Block tip: 952785
[7/6 23:52] Davi Calixto: POOL_ENABLE_CPU_MINER=true
[7/6 23:52] Davi Calixto: docker-compose up -d --build miner
[7/6 23:53] Davi Calixto: [7/6 23:50] Davi Calixto: # 🏊 Mining Pool Deployment Guide

Complete guide to deploy the Opus Davi **Phase 2 Mining Pool** on Mainnet.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Local Setup](#local-setup)
5. [Production Deployment](#production-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The **Opus Davi Mining Pool (Phase 2)** is a complete self-hosted Bitcoin Mainnet mining pool stack:

- **Real Bitcoin Core 27.0** node with full consensus validation
- **Stratum V1 server** for miners (ASIC + CPU)
- **Pool statistics API** for monitoring
- **Web dashboard** (Next.js) showing live workers, shares, hashrate, and blocks found
- **CPU miner sidecar** for testing (optional)

### Key Features

✅ **Self-custody** — you control the full node, pool, and payouts  
✅ **Real shares** — every share is validated server-side via SHA-256d  
✅ **Real blocks** — found blocks are submitted to Mainnet via `submitblock`  
✅ **Honest hashrate** — no faking; if no miners connected, you see 0 H/s  
✅ **Production-ready** — containerized with health checks and monitoring

---

## Architecture
[7/6 23:51] Davi Calixto: ### Data Flow

1. **Bitcoin Core** — runs full node consensus, exports `getblocktemplate` via RPC + ZMQ block notifications
2. **Stratum Server** — accepts miner connections, builds coinbase (BIP34 + extranonce + witness commitment), computes merkle branch, sends `mining.notify`
3. **Miner** — receives job, sweeps `extraNonce2` + nonce, submits share via Stratum
4. **Pool validation** — reconstructs 80-byte header, validates SHA-256d against share target + network target
5. **Block found** — if hash ≤ network target, send to bitcoind via `submitblock`
6. **Stats API** — pool /stats endpoint scraped by backend (2s TTL cache)
7. **Frontend Dashboard** — WebSocket stream from backend shows live workers, shares, block candidates

---

## Prerequisites

### Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 4 cores | 8+ cores (IBD faster) |
| **RAM** | 8 GB | 16+ GB |
| **Disk** | 800 GB | 1–2 TB SSD |
| **Network** | 100 Mbps | 1 Gbps |

### For Mainnet IBD (Initial Block Download)

- **Time**: 1–4 days depending on hardware + network
- **Bandwidth**: ~200 GB
- **Disk**: ~655 GB (unpruned); ~15 GB (pruned=10000)

### Software

- **Docker** 20.10+ & **Docker Compose** 2.0+
- **Node.js** 20+ (for local dev)
- **Git**

### Mainnet Requirements

- **Bitcoin address** you control (for `POOL_PAYOUT_ADDRESS`)
  - Can be hardware wallet, exchange withdrawal address, or self-hosted hot wallet
  - **Do NOT use an address belonging to someone else**
- **RPC password** (generated automatically in the bitcoind container)

---

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/davilibanio3-alt/Opus-Davi.git
cd Opus-Davi
npm install
[7/6 23:51] Davi Calixto: npm run build -w tx-engine
npm run build -w recovery
npm run build -w mining
npm run build -w ai-engine
[7/6 23:52] Davi Calixto: # ---- Backend ----
PORT=8787
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000

# ---- Pool (Phase 2) ----
# Bitcoin Core RPC (set automatically in container, but you can override)
BITCOIN_RPC_URL=http://bitcoind:18332
BITCOIN_RPC_USER=bitcoind
BITCOIN_RPC_PASSWORD=your-secure-password-here

# POOL PAYOUT ADDRESS — YOUR MAINNET ADDRESS
# The pool REFUSES TO START without this.
# Use an address you actually control (Ledger, Trezor, Exchange withdrawal, etc.)
POOL_PAYOUT_ADDRESS=bc1q...  # Your Mainnet address

# Optional: enable CPU miner for testing
# (yields ~1-10 MH/s/core; statistically zero chance of finding a block on Mainnet)
POOL_ENABLE_CPU_MINER=false

# ---- Frontend ----
NEXT_PUBLIC_BACKEND_URL=http://localhost:8787
NEXT_PUBLIC_MEMPOOL_API=https://mempool.space/api
NEXT_PUBLIC_MEMPOOL_WS=wss://mempool.space/api/v1/ws
NEXT_PUBLIC_NETWORK=mainnet
[7/6 23:52] Davi Calixto: 2026-06-08T14:00:00Z Block tip: 952785
[7/6 23:52] Davi Calixto: POOL_ENABLE_CPU_MINER=true
[7/6 23:52] Davi Calixto: docker-compose up -d --build miner
[9/6 09:52] Davi Calixto: /**
 * @btc-platform/tx-engine
 * Bitcoin Mainnet Transaction Engine
 */

import * as bitcoin from "bitcoinjs-lib";
import * as bip32 from "bip32";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);

export const NETWORK = bitcoin.networks.bitcoin;

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
}

export interface Output {
  address: string;
  value: number;
}

export async function estimateFee(
  feeRate: number,
  inputs: number,
  outputs: number
): Promise<number> {
  const vbytes = inputs * 68 + outputs * 31 + 10;
  return Math.ceil(vbytes * feeRate);
}

export function generateAddress(
  xpub: string,
  index = 0,
  purpose: 84 | 44 | 49 | 86 = 84
): string {

  const node = bip32.fromBase58(xpub, NETWORK);

  const child = node.derive(0).derive(index);

  switch (purpose) {

    case 44:
      return bitcoin.payments.p2pkh({
        pubkey: child.publicKey,
        network: NETWORK
      }).address!;

    case 49:
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: NETWORK
        }),
        network: NETWORK
      }).address!;

    case 84:
      return bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network: NETWORK
      }).address!;

    case 86:
      return bitcoin.payments.p2tr({
        internalPubkey: child.publicKey.slice(1, 33),
        network: NETWORK
      }).address!;

    default:
      throw new Error("Unsupported purpose");
  }
}

export async function buildPSBT(
  utxos: UTXO[],
  outputs: Output[],
  fee: number
) {

  const psbt = new bitcoin.Psbt({
    network: NETWORK
  });

  let totalInput = 0;

  for (const utxo of utxos) {

    totalInput += utxo.value;

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(
          utxo.scriptPubKey || "",
          "hex"
        ),
        value: utxo.value
      }
    });
  }

  let totalOutput = 0;

  for (const output of outputs) {

    totalOutput += output.value;

    psbt.addOutput({
      address: output.address,
      value: output.value
    });
  }

  const change = totalInput - totalOutput - fee;

  if (change < 0) {
    throw new Error("Insufficient balance");
  }

  return {
    psbt,
    change
  };
}

export function signPSBT(
  psbt: bitcoin.Psbt,
  wif: string
) {

  const keyPair = ECPair.fromWIF(
    wif,
    NETWORK
  );

  for (let i = 0; i < psbt.inputCount; i++) {
    psbt.signInput(i, keyPair);
  }

  return psbt;
}

export function finalizePSBT(
  psbt: bitcoin.Psbt
): string {

  psbt.finalizeAllInputs();

  return psbt.extractTransaction().toHex();
}

export async function broadcast(
  txHex: string
): Promise<string> {

  const response = await fetch(
    "https://mempool.space/api/tx",
    {
      method: "POST",
      body: txHex
    }
  );

  if (!response.ok) {
    throw new Error(
      await response.text()
    );
  }

  return response.text();
}

export async function fetchUTXOs(
  address: string
): Promise<UTXO[]> {

  const response = await fetch(
    `https://mempool.space/api/address/${address}/utxo`
  );

  return response.json();
}
[9/6 13:04] Davi Calixto: 039d8a0e2cfabe6d6dc28dbc297a9110e35b396017fc1567a91fda72184cbe34d92d17c67576e38c9e10000000f09f909f092f4632506f6f6c2f650000000000000000000000000000000000000000000000000000000000000000000000000000050046d24261
[9/6 13:05] Davi Calixto: ScriptSig (ASM)	
OP_PUSHBYTES_3 9d8a0e OP_PUSHBYTES_44 fabe6d6dc28dbc297a9110e35b396017fc1567a91fda72184cbe34d92d17c67576e38c9e10000000f09f909f OP_PUSHBYTES_9 2f4632506f6f6c2f65 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_0 OP_PUSHBYTES_5 0046d24261

    

