# ⚡ Solana Agent Treasury (`solana-agent-treasury`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-DeFi-purple.svg)](https://solana.com)
[![Kamino Lending](https://img.shields.io/badge/Kamino-Lending_Yield-blue.svg)](https://kamino.finance)
[![Jupiter](https://img.shields.io/badge/Jupiter-DEX_Aggregator-green.svg)](https://jup.ag)
[![Colosseum Hackathon](https://img.shields.io/badge/Colosseum-Ready-orange.svg)](https://arena.colosseum.org)

> **Autonomous Kamino Lending Yield & Jupiter Dip-Guard for AI Agents on Solana.**  
> Built for the **Road to Colosseum Hackathon (Superteam Germany)**.

---

## 🎯 The Problem

Autonomous AI Agents on Solana hold idle operating capital in plain, uncollateralized wallets:
1. **Capital Decay:** Idle USDC sits in wallets earning **0% APY**, losing out on compounded DeFi yields.
2. **Volatile Drawdowns:** Market corrections wipe out treasury balances when agents hold raw spot assets without automated protection.
3. **No Safety Floor:** Naive agents frequently overspend their operating reserve on API fees or trades, leading to runtime bankruptcy.

---

## 🛡️ The Solution: Solana Agent Treasury

`solana-agent-treasury` is a lightweight, non-custodial TypeScript SDK that gives any autonomous agent:
* **🏦 Kamino Vault Guard:** Automatically routes the baseline operating reserve (e.g., $30 USDC) into Kamino Lending pools to continuously earn APY.
* **📉 Jupiter Dip Trader:** Identifies market-wide dips across whitelisted tokens (SOL, JUP, JTO, etc.) using RSI and 24h percentage drop triggers.
* **🔒 Strict Capital Guard:** Guarantees that the core operating reserve is **never touched** by trading operations.
* **📈 Trailing Stop & Take-Profit:** Protects profits with automated peak-trailing stops and disciplined take-profit exits.

---

## 🏗️ Architecture

```
                     +---------------------------------------+
                     |         Autonomous AI Agent           |
                     |  (ElizaOS / LangChain / Custom Loop)  |
                     +-------------------+-------------------+
                                         |
                                         v
                     +---------------------------------------+
                     |      Solana Agent Treasury SDK        |
                     +-------------------+-------------------+
                                         |
            +----------------------------+----------------------------+
            |                                                         |
            v                                                         v
+-----------------------+                                 +-----------------------+
|   Kamino Vault Guard  |                                 |   Jupiter Dip Trader  |
|  - $30 Reserve Floor  |                                 |  - Capital Guard Floor|
|  - Continuous APY     |                                 |  - RSI < 28 Trigger   |
|  - Auto-Compounding   |                                 |  - Trailing Stop-Loss |
+-----------+-----------+                                 +-----------+-----------+
            |                                                         |
            v                                                         v
    [ Kamino Protocol ]                                       [ Jupiter Routing ]
     (Lending Pool)                                            (Spot Liquidity)
```

---

## 🚀 Quickstart

### 1. Installation

```bash
npm install solana-agent-treasury
# or
git clone https://github.com/YOUR_ACCOUNT/solana-agent-treasury.git
cd solana-agent-treasury
npm install
```

### 2. Run Interactive CLI Demo

Experience the autonomous yield accrual, dip detection, and automated position management in 5 seconds:

```bash
npm run demo
```

### 3. Integrate with Your Agent in 3 Lines of Code

```typescript
import { SolanaAgentTreasury } from 'solana-agent-treasury';

// Initialize Treasury with a $30 safety floor
const treasury = new SolanaAgentTreasury({
  reserveFloorUsdc: 30.00,
});

// Check Kamino yield status
const yieldStatus = treasury.getReserveStatus();
console.log(`Kamino Reserve: $${yieldStatus.depositedUsdc} USDC earning ${yieldStatus.currentApy}% APY`);

// Scan for dips with Capital Guard protection
const signal = treasury.evaluateDip('SOL', 'So11111111111111111111111111111111111111112', 138.5, 26, -0.08, 45.00);

if (signal.shouldBuy) {
  const position = treasury.executeDipTrade(signal);
  console.log(`Opened dip trade for ${position.amount} SOL`);
}
```

---

## 🤖 Built-in Agent Tools (ElizaOS, LangChain, OpenAI)

`solana-agent-treasury` includes ready-to-use function definitions in `src/agent-tools.ts`:
* `treasury_kamino_status`
* `treasury_deposit_reserve`
* `treasury_check_jupiter_dips`
* `treasury_evaluate_positions`

---

## 🧪 Testing

Run the comprehensive unit test suite:

```bash
npm test
```

All tests cover:
- Capital Guard floor enforcement
- Kamino interest and APY compounding
- Dip signal evaluation and position lifecycle
- Take Profit, Trailing Stop-Loss, and Hard Stop-Loss triggers

---

## 📜 License

MIT License. Free to use and build upon by the Solana and AI Agent builder community.
