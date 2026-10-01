// Realtime Solana Agent Treasury High-End Terminal Engine

const TOKEN_CONFIG = {
  SOL: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', price: 119.50, baseline: 119.50, change: 0.85, rsi: 48.2 },
  JUP: { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', price: 0.33, baseline: 0.33, change: 2.10, rsi: 52.4 },
  JTO: { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', price: 0.54, baseline: 0.54, change: -1.20, rsi: 44.1 },
};

const STATE = {
  reserveFloor: 30.00,
  agentBalance: 42.00,
  kaminoApy: 0.0842,
  earnedYield: 0.000318,
  positions: [],
  isDipActive: false,
  chartData: [],
  connectedWallet: null,
};

// Canvas Chart State
let chartCanvas, ctx;

// 1. Initialize Chart Historical Points
function initChartData() {
  const points = 40;
  let p = TOKEN_CONFIG.SOL.baseline * 0.98;
  STATE.chartData = [];
  for (let i = 0; i < points; i++) {
    p += (Math.random() - 0.48) * 0.6;
    STATE.chartData.push(p);
  }
  STATE.chartData[points - 1] = TOKEN_CONFIG.SOL.price;
}

// 2. Draw High-Performance Canvas Chart with Dynamic Agent Levels
function renderChart() {
  if (!chartCanvas || !ctx) return;
  const w = chartCanvas.width;
  const h = chartCanvas.height;

  ctx.clearRect(0, 0, w, h);

  const data = STATE.chartData;
  if (data.length < 2) return;

  const min = Math.min(...data) * 0.985;
  const max = Math.max(...data) * 1.015;

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = (h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw Price Line & Gradient Fill
  ctx.beginPath();
  const step = w / (data.length - 1);
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = h - ((data[i] - min) / (max - min)) * (h - 40) - 20;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Gradient area
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(20, 241, 149, 0.25)');
  gradient.addColorStop(1, 'rgba(20, 241, 149, 0.0)');
  ctx.strokeStyle = '#14F195';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Fill gradient
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw Position Overlays (Entry, Trailing Stop, Take Profit)
  if (STATE.positions.length > 0) {
    const pos = STATE.positions[0];
    if (pos.status === 'OPEN') {
      // 1. Green Entry Line
      drawPriceBand(pos.entryPrice, min, max, w, h, '#14F195', 'ENTRY: $' + pos.entryPrice.toFixed(2));

      // 2. Trailing Stop (-4% from Peak)
      const trailingPrice = pos.peakPrice * 0.96;
      drawPriceBand(trailingPrice, min, max, w, h, '#C084FC', 'TRAILING STOP (-4%): $' + trailingPrice.toFixed(2));

      // 3. Take Profit Line (+10%)
      const tpPrice = pos.entryPrice * 1.10;
      drawPriceBand(tpPrice, min, max, w, h, '#FBBF24', 'TARGET EXIT (+10%): $' + tpPrice.toFixed(2));
    }
  }
}

function drawPriceBand(priceVal, min, max, w, h, color, label) {
  if (priceVal < min || priceVal > max) return;
  const y = h - ((priceVal - min) / (max - min)) * (h - 40) - 20;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillText(label, w - 180, y - 5);
  ctx.restore();
}

// 3. AI Cognitive Stream Generator
const THOUGHT_TEMPLATES = [
  { tag: 'GUARD', type: 'guard', text: () => `[CapitalGuard Invariant] Checking operating reserve: $${STATE.reserveFloor.toFixed(2)} USDC locked in Kamino. 0% leakage.` },
  { tag: 'YIELD', type: 'guard', text: () => `[Kamino Protocol] Compounded APY @ ${(STATE.kaminoApy * 100).toFixed(2)}%. Continuous interest accruing to vault.` },
  { tag: 'SCANNER', type: 'scanner', text: () => `[Jupiter DEX Scanner] Polling SOL/USDC depth on Orca & Raydium pools. Slippage: <0.02%.` },
  { tag: 'ORCHESTRATOR', type: 'scanner', text: () => `[Fleet Heartbeat] 3 Agents verified: Alpha (Scout), Beta (Yield), Gamma (Worker). Invariant 100% compliant.` },
  { tag: 'VOLATILITY', type: 'scanner', text: () => `[Macro Sensor] SOL 15m RSI: ${TOKEN_CONFIG.SOL.rsi.toFixed(1)}. Market momentum neutral. Maintaining cash floor.` },
];

function addCognitionThought(tag, text, type = 'scanner') {
  const stream = document.getElementById('cognition-stream');
  if (!stream) return;

  const entry = document.createElement('div');
  entry.className = `thought-entry ${type}`;
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="thought-time">[${time}]</span><span class="thought-tag">${tag}:</span> ${text}`;
  stream.appendChild(entry);
  stream.scrollTop = stream.scrollHeight;
}

// 4. Live Solana Price Fetching from DEXScreener
async function syncLivePrices() {
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('DEX sync error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const sym = pair.baseToken.symbol.toUpperCase();
        if (TOKEN_CONFIG[sym] && !STATE.isDipActive) {
          const price = parseFloat(pair.priceUsd);
          const chg = parseFloat(pair.priceChange?.h24 || 0);
          TOKEN_CONFIG[sym].price = price;
          TOKEN_CONFIG[sym].baseline = price;
          TOKEN_CONFIG[sym].change = chg;
          TOKEN_CONFIG[sym].rsi = Math.min(75, Math.max(25, 50 + (chg * 1.4)));
        }
      }
      document.getElementById('sync-time-label').innerText = `Synced ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    console.warn('Price sync fallback:', err);
  }

  // Push new point to chart
  if (!STATE.isDipActive) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
  updateUI();
  renderChart();
}

// 5. Toast Notification System
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 6. Update All UI Elements
function updateUI() {
  // KPIs
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  document.getElementById('kpi-deployable-val').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('kpi-agent-total').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('kpi-kamino-total').innerText = `$${STATE.reserveFloor.toFixed(2)} USDC`;
  document.getElementById('top-fleet-tvl').innerText = `$${(STATE.agentBalance + 103).toFixed(2)} USDC`;

  // Chart Header Indicators
  document.getElementById('chart-price-display').innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  document.getElementById('chart-rsi-display').innerText = TOKEN_CONFIG.SOL.rsi.toFixed(1);
  const chgEl = document.getElementById('chart-change-display');
  chgEl.innerText = `${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%`;
  chgEl.className = TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red';

  // Token Matrix Cards
  for (const [sym, data] of Object.entries(TOKEN_CONFIG)) {
    const low = sym.toLowerCase();
    const pEl = document.getElementById(`m-price-${low}`);
    const cEl = document.getElementById(`m-change-${low}`);
    const rEl = document.getElementById(`m-rsi-${low}`);
    const bEl = document.getElementById(`m-badge-${low}`);

    if (pEl) pEl.innerText = `$${data.price.toFixed(data.price < 1 ? 4 : 2)}`;
    if (cEl) {
      cEl.innerText = `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%`;
      cEl.className = data.change >= 0 ? 'text-green' : 'text-red';
    }
    if (rEl) rEl.innerText = data.rsi.toFixed(1);

    if (bEl) {
      if (data.rsi <= 28 || data.change <= -7.5) {
        bEl.className = 'matrix-badge status-dip';
        bEl.innerText = '⚡ DIP CONFIRMED';
      } else {
        bEl.className = 'matrix-badge status-monitoring';
        bEl.innerText = 'MONITORING';
      }
    }
  }

  // Slot simulation increment
  const slotEl = document.getElementById('slot-counter');
  if (slotEl) {
    const cur = parseInt(slotEl.innerText.replace(/,/g, ''));
    slotEl.innerText = (cur + 2).toLocaleString();
  }

  // Positions Table
  renderPositionsTable();
}

function renderPositionsTable() {
  const tbody = document.getElementById('live-positions-tbody');
  if (STATE.positions.length === 0) {
    tbody.innerHTML = '<tr id="empty-pos-row"><td colspan="10" class="text-center text-dim py-6">No active spot positions. Capital securely vaulted in Kamino Lending Reserve.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  for (const pos of STATE.positions) {
    const curPrice = TOKEN_CONFIG[pos.symbol].price;
    const pnlPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const pnlUsdc = (curPrice - pos.entryPrice) * pos.amount;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code class="text-blue">${pos.id}</code></td>
      <td><strong class="text-white">${pos.symbol}</strong></td>
      <td class="mono-num">$${pos.entryPrice.toFixed(2)}</td>
      <td class="mono-num font-bold">$${curPrice.toFixed(2)}</td>
      <td class="mono-num">$${pos.costBasis.toFixed(2)} USDC</td>
      <td class="mono-num ${pnlPct >= 0 ? 'text-green' : 'text-red'} font-bold">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</td>
      <td class="mono-num ${pnlUsdc >= 0 ? 'text-green' : 'text-red'}">${pnlUsdc >= 0 ? '+' : ''}$${pnlUsdc.toFixed(4)}</td>
      <td class="mono-num text-purple">$${pos.peakPrice.toFixed(2)}</td>
      <td><span class="badge ${pos.status === 'OPEN' ? 'badge-mint' : 'badge-purple'}">${pos.status}</span></td>
      <td class="text-dim text-xs">${pos.action}</td>
    `;
    tbody.appendChild(tr);
  }
}

// 7. Event Handlers: Trigger Flash Dip (-8.5%)
document.getElementById('btn-trigger-dip').addEventListener('click', () => {
  STATE.isDipActive = true;
  const dipPct = -0.085;
  const origPrice = TOKEN_CONFIG.SOL.baseline;
  const newPrice = origPrice * (1 + dipPct);

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = dipPct * 100;
  TOKEN_CONFIG.SOL.rsi = 24.2;

  // Chart drop
  STATE.chartData.shift();
  STATE.chartData.push(newPrice);

  addCognitionThought('MARKET EVENT', `Sudden flash dip detected on SOL: Dropped -8.50% to $${newPrice.toFixed(2)} (RSI: 24.2 < 28)`, 'trade');
  addCognitionThought('GUARD', `Verifying Capital Guard: Balance $${STATE.agentBalance.toFixed(2)}, Floor $${STATE.reserveFloor.toFixed(2)}. Invariant PASS.`, 'guard');

  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  if (deployable <= 0) {
    addCognitionThought('ABORT', 'No surplus capital above $30 floor. Spot buy prevented.', 'guard');
    showToast('⚠️ Capital Guard: Spot buy prevented to protect $30 operating floor');
    updateUI();
    renderChart();
    return;
  }

  const tradeSize = Math.min(deployable, 15.00);
  addCognitionThought('JUPITER', `Routing automated spot swap: $${tradeSize.toFixed(2)} USDC -> SOL via Jupiter v6 Best Route...`, 'trade');

  const amountBought = tradeSize / newPrice;
  const posId = 'pos_sol_' + Date.now().toString().slice(-4);
  const position = {
    id: posId,
    symbol: 'SOL',
    entryPrice: newPrice,
    amount: amountBought,
    costBasis: tradeSize,
    peakPrice: newPrice,
    status: 'OPEN',
    action: 'Trailing Stop Armed (-4%)',
  };

  STATE.positions = [position];
  addCognitionThought('ORDER FILL', `Filled ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)}. Dynamic Trailing Stop active.`, 'trade');
  showToast(`⚡ Jupiter Swap Executed: Bought ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)}`);

  document.getElementById('btn-trigger-dip').disabled = true;
  document.getElementById('btn-trigger-rebound').disabled = false;
  updateUI();
  renderChart();
});

// 8. Event Handlers: Trigger Rebound (+10.5%)
document.getElementById('btn-trigger-rebound').addEventListener('click', () => {
  if (STATE.positions.length === 0) return;
  const pos = STATE.positions[0];

  const reboundPrice = pos.entryPrice * 1.1048; // +10.48%
  TOKEN_CONFIG.SOL.price = reboundPrice;
  TOKEN_CONFIG.SOL.change = 3.2;
  TOKEN_CONFIG.SOL.rsi = 64.0;
  pos.peakPrice = reboundPrice;

  // Chart rise
  STATE.chartData.shift();
  STATE.chartData.push(reboundPrice);

  addCognitionThought('REBOUND', `SOL market surged to $${reboundPrice.toFixed(2)} (+10.48% from entry $${pos.entryPrice.toFixed(2)})`, 'exit');
  addCognitionThought('EXIT ENGINE', `Target reached: PnL +10.48% >= +10.00% Take-Profit threshold. Initiating exit routing...`, 'exit');

  const realizedPnl = (reboundPrice - pos.entryPrice) * pos.amount;
  pos.status = 'CLOSED';
  pos.action = 'TAKE_PROFIT EXECUTED (+10.48%)';

  addCognitionThought('PROFIT HARVEST', `Closed position for +$${realizedPnl.toFixed(4)} USDC gain. Re-vaulting principal and profit into Kamino Lending.`, 'exit');
  showToast(`💰 TAKE_PROFIT Executed! Realized Gain: +$${realizedPnl.toFixed(4)} USDC`);

  STATE.agentBalance += realizedPnl;
  document.getElementById('btn-trigger-rebound').disabled = true;
  updateUI();
  renderChart();
});

// 9. Reset Market Sync
document.getElementById('btn-reset-market').addEventListener('click', () => {
  STATE.isDipActive = false;
  TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
  TOKEN_CONFIG.SOL.change = 0.85;
  TOKEN_CONFIG.SOL.rsi = 48.2;
  STATE.positions = [];
  document.getElementById('btn-trigger-dip').disabled = false;
  document.getElementById('btn-trigger-rebound').disabled = true;
  addCognitionThought('SYSTEM', 'Market re-synchronized with live Solana Mainnet DEX feeds.', 'scanner');
  showToast('↺ Synced with Solana Mainnet-Beta');
  syncLivePrices();
});

// 10. Harvest Yield Button
document.getElementById('btn-harvest-yield').addEventListener('click', () => {
  const harvested = STATE.earnedYield;
  STATE.earnedYield = 0.000005;
  addCognitionThought('HARVEST', `Harvested $${harvested.toFixed(6)} USDC lending yield from Kamino. Reinvested into treasury.`, 'guard');
  showToast(`🌾 Harvested +$${harvested.toFixed(6)} USDC from Kamino Vault`);
});

// 11. Balance Slider
document.getElementById('agent-balance-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  STATE.agentBalance = val;
  document.getElementById('slider-val-badge').innerText = `$${val.toFixed(2)}`;
  updateUI();
});

// 12. Robust Multi-Wallet Connection System (Phantom Provider + Modal Fallback)
function getSolanaProvider() {
  if (typeof window !== 'undefined') {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    if (window.solflare?.isSolflare) return window.solflare;
    if (window.backpack?.isBackpack) return window.backpack;
    if (window.solana) return window.solana;
  }
  return null;
}

const modal = document.getElementById('wallet-modal');
const modalClose = document.getElementById('modal-close-btn');
const phantomDetectBadge = document.getElementById('phantom-detect-badge');

function openWalletModal() {
  if (!modal) return;
  modal.style.display = 'flex';
  const provider = getSolanaProvider();
  if (provider) {
    if (phantomDetectBadge) {
      phantomDetectBadge.innerText = 'DETECTED';
      phantomDetectBadge.className = 'badge badge-mint';
    }
  } else {
    if (phantomDetectBadge) {
      phantomDetectBadge.innerText = 'NOT INSTALLED';
      phantomDetectBadge.className = 'badge badge-purple';
    }
  }
}

function closeWalletModal() {
  if (modal) modal.style.display = 'none';
}

if (modalClose) modalClose.addEventListener('click', closeWalletModal);
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWalletModal();
  });
}

document.getElementById('btn-connect-wallet').addEventListener('click', async () => {
  const provider = getSolanaProvider();
  if (provider) {
    try {
      showToast('Connecting to Solana Wallet...');
      const resp = await provider.connect();
      const pubkey = resp.publicKey.toString();
      await handleWalletConnected(pubkey, 'Phantom Extension');
      return;
    } catch (err) {
      console.warn('Direct connect rejected, opening modal:', err);
    }
  }
  openWalletModal();
});

const modalBtnPhantom = document.getElementById('modal-btn-phantom');
if (modalBtnPhantom) {
  modalBtnPhantom.addEventListener('click', async () => {
    const provider = getSolanaProvider();
    if (provider) {
      try {
        const resp = await provider.connect();
        const pubkey = resp.publicKey.toString();
        await handleWalletConnected(pubkey, 'Phantom Extension');
        closeWalletModal();
      } catch (err) {
        showToast('⚠️ Connection rejected in Phantom popup');
      }
    } else {
      window.open('https://phantom.app/', '_blank');
      showToast('Opening phantom.app installation page in new tab...');
    }
  });
}

const modalBtnCreator = document.getElementById('modal-btn-creator');
if (modalBtnCreator) {
  modalBtnCreator.addEventListener('click', async () => {
    await handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
    closeWalletModal();
  });
}

const customWalletSubmit = document.getElementById('custom-wallet-submit');
if (customWalletSubmit) {
  customWalletSubmit.addEventListener('click', async () => {
    const val = document.getElementById('custom-wallet-input').value.trim();
    if (val && val.length >= 32 && val.length <= 44) {
      await handleWalletConnected(val, 'Custom Public Key');
      closeWalletModal();
    } else {
      showToast('⚠️ Please enter a valid Solana Base58 address (32-44 characters)');
    }
  });
}

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', `Linked ${source}: ${address}. Assigned as Fleet Yield Beneficiary.`, 'guard');
  showToast(`⚡ Connected: ${short} (${source})`);

  // Query Real Solana Balance via public RPC
  try {
    if (typeof solanaWeb3 !== 'undefined') {
      const connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const pubkey = new solanaWeb3.PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      const sol = (lamports / 1e9).toFixed(3);
      addCognitionThought('MAINNET BALANCE', `Verified On-Chain Balance for ${short}: ${sol} SOL.`, 'guard');
      showToast(`💰 On-Chain Balance: ${sol} SOL`);
    }
  } catch (err) {
    console.log('Mainnet balance RPC query note:', err.message);
  }
}


// Continuous Yield Ticker
setInterval(() => {
  const secondsElapsed = 1;
  const secondsPerYear = 365.25 * 24 * 3600;
  const inc = STATE.reserveFloor * (STATE.kaminoApy * (secondsElapsed / secondsPerYear));
  STATE.earnedYield += inc;
  const el = document.getElementById('kpi-yield-ticker');
  if (el) el.innerText = `+$${STATE.earnedYield.toFixed(6)} USDC`;
}, 1000);

// Continuous AI Thought Generation Loop (Every 6 seconds)
let thoughtIdx = 0;
setInterval(() => {
  if (!STATE.isDipActive) {
    const t = THOUGHT_TEMPLATES[thoughtIdx % THOUGHT_TEMPLATES.length];
    addCognitionThought(t.tag, t.text(), t.type);
    thoughtIdx++;
  }
}, 6000);

// Initialize on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  chartCanvas = document.getElementById('live-sol-chart');
  if (chartCanvas) {
    // Set actual pixel dimensions for Retina sharpness
    chartCanvas.width = chartCanvas.offsetWidth * 2;
    chartCanvas.height = chartCanvas.offsetHeight * 2;
    ctx = chartCanvas.getContext('2d');
    ctx.scale(2, 2);
  }

  initChartData();
  renderChart();
  updateUI();

  // Initial thoughts
  addCognitionThought('BOOT', 'Solana Agent Treasury Terminal initialized.', 'guard');
  addCognitionThought('INVARIANT', 'Operating reserve floor: $30.00 USDC locked in Kamino Vault.', 'guard');
  addCognitionThought('SCANNER', 'Listening to Jupiter liquidity routes across SOL, JUP, JTO.', 'scanner');

  // Fetch live prices immediately and then every 15s
  syncLivePrices();
  setInterval(syncLivePrices, 15000);
});
