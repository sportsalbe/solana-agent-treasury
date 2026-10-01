// Realtime Solana Agent Treasury Controller
const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
};

const STATE = {
  reserveFloor: 30.00,
  agentBalance: 42.00,
  kaminoApy: 0.0842,
  earnedYield: 0.000142,
  prices: {
    SOL: { price: 119.50, change24h: 0.8, rsi: 48.5, baselinePrice: 119.50 },
    JUP: { price: 0.33, change24h: 2.1, rsi: 52.0, baselinePrice: 0.33 },
    JTO: { price: 0.54, change24h: -1.2, rsi: 44.0, baselinePrice: 0.54 },
  },
  positions: [],
  isDipSimulated: false,
};

// Log to Terminal Window
function addLog(msg, type = 'muted') {
  const container = document.getElementById('terminal-logs');
  const div = document.createElement('div');
  div.className = `log-line text-${type}`;
  const time = new Date().toLocaleTimeString();
  div.innerText = `[${time}] ${msg}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Fetch Live Token Prices from DexScreener API (Solana Pairs)
async function fetchLivePrices() {
  try {
    const mints = Object.values(TOKEN_MINTS).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const symbol = pair.baseToken.symbol.toUpperCase();
        if (STATE.prices[symbol] && !STATE.isDipSimulated) {
          const price = parseFloat(pair.priceUsd);
          const change = parseFloat(pair.priceChange?.h24 || 0);
          STATE.prices[symbol].price = price;
          STATE.prices[symbol].baselinePrice = price;
          STATE.prices[symbol].change24h = change;
          // Approximate realistic RSI from 24h momentum
          STATE.prices[symbol].rsi = Math.min(80, Math.max(20, 50 + (change * 1.5)));
        }
      }
      document.getElementById('last-updated-text').innerText = `Synced with Solana Mainnet at ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    console.warn('Live price sync fallback:', err);
    document.getElementById('last-updated-text').innerText = 'Using cached Mainnet feed';
  }
  updateUI();
}

// Update UI Elements
function updateUI() {
  // 1. Metrics
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  document.getElementById('val-deployable').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('val-total-balance').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('val-kamino-reserve').innerText = `$${STATE.reserveFloor.toFixed(2)} USDC`;

  // 2. Token Cards
  for (const [sym, data] of Object.entries(STATE.prices)) {
    const idKey = sym.toLowerCase();
    const priceEl = document.getElementById(`price-${idKey}`);
    const changeEl = document.getElementById(`change-${idKey}`);
    const rsiEl = document.getElementById(`rsi-${idKey}`);
    const badgeEl = document.getElementById(`badge-${idKey}`);

    if (priceEl) priceEl.innerText = `$${data.price.toFixed(data.price < 1 ? 4 : 2)}`;
    if (changeEl) {
      changeEl.innerText = `${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%`;
      changeEl.style.color = data.change24h >= 0 ? '#10B981' : '#EF4444';
    }
    if (rsiEl) {
      rsiEl.innerText = data.rsi.toFixed(1);
      rsiEl.style.color = data.rsi <= 28 ? '#EF4444' : '#E2E8F0';
    }

    if (badgeEl) {
      if (data.rsi <= 28 || data.change24h <= -7.5) {
        badgeEl.className = 'token-status-badge status-dip';
        badgeEl.innerText = '⚡ DIP DETECTED (BUY SIGNAL)';
      } else {
        badgeEl.className = 'token-status-badge status-monitoring';
        badgeEl.innerText = 'MONITORING';
      }
    }
  }

  // 3. Positions Table
  renderPositions();
}

// Render Active Positions
function renderPositions() {
  const tbody = document.getElementById('positions-tbody');
  if (STATE.positions.length === 0) {
    tbody.innerHTML = '<tr id="no-positions-row"><td colspan="9" class="text-center text-muted">No active spot positions. Capital safely held in Kamino Yield Vault.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  for (const pos of STATE.positions) {
    const curPrice = STATE.prices[pos.symbol].price;
    const pnlPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const pnlUsdc = (curPrice - pos.entryPrice) * pos.amount;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${pos.id}</td>
      <td><strong>${pos.symbol}</strong></td>
      <td>$${pos.entryPrice.toFixed(2)}</td>
      <td>$${curPrice.toFixed(2)}</td>
      <td>$${pos.costBasis.toFixed(2)} USDC</td>
      <td style="color: ${pnlPct >= 0 ? '#10B981' : '#EF4444'}">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</td>
      <td style="color: ${pnlUsdc >= 0 ? '#10B981' : '#EF4444'}">${pnlUsdc >= 0 ? '+' : ''}$${pnlUsdc.toFixed(4)}</td>
      <td><span class="badge ${pos.status === 'OPEN' ? 'active-badge' : 'colosseum-badge'}">${pos.status}</span></td>
      <td>${pos.action || 'Monitoring Trailing Stop'}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Continuous APY Yield Ticker
setInterval(() => {
  const secondsElapsed = 1;
  const secondsPerYear = 365.25 * 24 * 3600;
  const yieldIncrement = STATE.reserveFloor * (STATE.kaminoApy * (secondsElapsed / secondsPerYear));
  STATE.earnedYield += yieldIncrement;
  document.getElementById('val-kamino-yield').innerText = `+$${STATE.earnedYield.toFixed(6)} USDC`;
}, 1000);

// Balance Slider Interaction
document.getElementById('balance-slider').addEventListener('input', (e) => {
  const newBal = parseFloat(e.target.value);
  STATE.agentBalance = newBal;
  document.getElementById('slider-display').innerText = `$${newBal.toFixed(2)}`;
  updateUI();
});

// Simulate Market Dip Button
document.getElementById('btn-simulate-dip').addEventListener('click', () => {
  STATE.isDipSimulated = true;
  const dipPct = -0.085; // -8.5%
  const origPrice = STATE.prices.SOL.baselinePrice;
  const newPrice = origPrice * (1 + dipPct);

  STATE.prices.SOL.price = newPrice;
  STATE.prices.SOL.change24h = dipPct * 100;
  STATE.prices.SOL.rsi = 24.2; // Oversold < 28

  addLog('💥 Flash Market Dip Detected: SOL dropped -8.50% to $' + newPrice.toFixed(2) + ' (RSI: 24.2)', 'yellow');
  addLog('[CapitalGuard] Checking Invariant: Current Wallet = $' + STATE.agentBalance.toFixed(2) + ' USDC, Reserve Floor = $' + STATE.reserveFloor.toFixed(2) + ' USDC', 'green');

  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  if (deployable <= 0) {
    addLog('[CapitalGuard] BLOCKED: No surplus capital above $30 reserve. Spot trade halted.', 'red');
    updateUI();
    return;
  }

  const tradeSize = Math.min(deployable, 15.00);
  addLog('[JupiterTrader] Autonomous Buy Triggered! Routing swap for $' + tradeSize.toFixed(2) + ' USDC into SOL...', 'purple');

  const amountBought = tradeSize / newPrice;
  const newPos = {
    id: 'pos_sol_' + Date.now().toString().slice(-4),
    symbol: 'SOL',
    entryPrice: newPrice,
    amount: amountBought,
    costBasis: tradeSize,
    peakPrice: newPrice,
    status: 'OPEN',
    action: 'Trailing Stop Armed (4%)',
  };

  STATE.positions = [newPos];
  addLog('[JupiterTrader] Position opened: ' + amountBought.toFixed(4) + ' SOL at $' + newPrice.toFixed(2) + ' (Cost Basis: $' + tradeSize.toFixed(2) + ' USDC)', 'green');

  document.getElementById('btn-simulate-dip').disabled = true;
  document.getElementById('btn-simulate-rebound').disabled = false;
  updateUI();
});

// Simulate Rebound & Take Profit
document.getElementById('btn-simulate-rebound').addEventListener('click', () => {
  if (STATE.positions.length === 0) return;

  const pos = STATE.positions[0];
  const reboundPrice = pos.entryPrice * 1.1048; // +10.48%
  STATE.prices.SOL.price = reboundPrice;
  STATE.prices.SOL.change24h = 3.5;
  STATE.prices.SOL.rsi = 62.0;

  addLog('🚀 Market Rebound Event: SOL surged to $' + reboundPrice.toFixed(2) + ' (+10.48% from entry)', 'green');
  addLog('[ExitEngine] PnL reached +10.48% &gt;= +10.00% target threshold.', 'purple');

  const realizedPnl = (reboundPrice - pos.entryPrice) * pos.amount;
  pos.status = 'CLOSED';
  pos.action = 'TAKE_PROFIT EXECUTED';

  addLog('💰 [ExitEngine] TAKE_PROFIT Triggered! Realized Gain: +$' + realizedPnl.toFixed(4) + ' USDC (+10.48%)', 'green');
  addLog('[KaminoVault] Automatically re-vaulting principal and profit into Kamino Lending.', 'blue');

  STATE.agentBalance += realizedPnl;
  document.getElementById('btn-simulate-rebound').disabled = true;
  updateUI();
});

// Reset Market Button
document.getElementById('btn-reset').addEventListener('click', () => {
  STATE.isDipSimulated = false;
  STATE.prices.SOL.price = STATE.prices.SOL.baselinePrice;
  STATE.prices.SOL.change24h = 0.8;
  STATE.prices.SOL.rsi = 48.5;
  STATE.positions = [];
  document.getElementById('btn-simulate-dip').disabled = false;
  document.getElementById('btn-simulate-rebound').disabled = true;
  addLog('↺ Market reset to live Solana Mainnet state.', 'blue');
  fetchLivePrices();
});

// Initial Price Fetch and Loop
fetchLivePrices();
setInterval(fetchLivePrices, 15000);
