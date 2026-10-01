// Realtime Solana Agent Treasury High-End Terminal & Interactive Simulation Engine

const TOKEN_CONFIG = {
  SOL: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', price: 119.50, baseline: 119.50, change: 0.85, rsi: 48.2 },
  JUP: { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', price: 0.33, baseline: 0.33, change: 2.10, rsi: 52.4 },
  JTO: { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', price: 0.54, baseline: 0.54, change: -1.20, rsi: 44.1 },
};

const STATE = {
  reserveFloor: 30.00,
  agentBalance: 0.00, // Starts at 0 to demonstrate "No Money / Safe Mode" first!
  kaminoApy: 0.0842,
  earnedYield: 0.000318,
  positions: [],
  isSimulating: false,
  chartData: [],
  connectedWallet: null,
};

let chartCanvas, ctx;

// 1. Initialize Canvas Chart Points
function initChartData() {
  const points = 45;
  let p = TOKEN_CONFIG.SOL.baseline * 0.98;
  STATE.chartData = [];
  for (let i = 0; i < points; i++) {
    p += (Math.random() - 0.48) * 0.5;
    STATE.chartData.push(p);
  }
  STATE.chartData[points - 1] = TOKEN_CONFIG.SOL.price;
}

// 2. High-DPI Perfect Fit Canvas Chart with Y-Axis & Dynamic Agent Bands
function resizeCanvas() {
  if (!chartCanvas) return;
  const rect = chartCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 2;
  chartCanvas.width = rect.width * dpr;
  chartCanvas.height = rect.height * dpr;
  ctx = chartCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function renderChart() {
  if (!chartCanvas || !ctx) return;
  const rect = chartCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const data = STATE.chartData;
  if (!data || data.length < 2) return;

  // Chart Margins for Y-Axis on right
  const marginRight = 65;
  const chartW = w - marginRight;
  const chartH = h - 40;
  const topPad = 20;

  // Price range bounds
  const min = Math.min(...data, 85) * 0.98;
  const max = Math.max(...data, 148) * 1.02;

  // Y-Axis Horizontal Grid Lines and Labels
  const gridSteps = 5;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748B';
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.textAlign = 'left';

  for (let i = 0; i <= gridSteps; i++) {
    const y = topPad + (chartH / gridSteps) * i;
    const priceVal = max - ((max - min) / gridSteps) * i;

    // Line
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartW, y);
    ctx.stroke();

    // Price Label
    ctx.fillText('$' + priceVal.toFixed(0), chartW + 10, y + 4);
  }
  ctx.restore();

  // Draw Shaded Dip Zone (Under $110 / -7.5%)
  const dipThresholdPrice = TOKEN_CONFIG.SOL.baseline * 0.925; // ~$110.5
  const dipY = topPad + chartH - ((dipThresholdPrice - min) / (max - min)) * chartH;
  if (dipY < h) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.07)';
    ctx.fillRect(0, dipY, chartW, h - dipY);

    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('⚡ OVERSOLD DIP BUY ZONE (< -7.5%)', 20, h - 14);
    ctx.restore();
  }

  // Draw Price Line with Smooth Curves
  const step = chartW / (data.length - 1);
  const curPrice = data[data.length - 1];
  const isDip = curPrice <= dipThresholdPrice;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = topPad + chartH - ((data[i] - min) / (max - min)) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else {
      // Smooth cubic bezier
      const prevX = (i - 1) * step;
      const prevY = topPad + chartH - ((data[i - 1] - min) / (max - min)) * chartH;
      const midX = (prevX + x) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
    }
  }

  // Neon Stroke with Glow
  ctx.strokeStyle = isDip ? '#EF4444' : '#14F195';
  ctx.lineWidth = 3;
  ctx.shadowColor = isDip ? 'rgba(239, 68, 68, 0.6)' : 'rgba(20, 241, 149, 0.6)';
  ctx.shadowBlur = 12;
  ctx.stroke();

  // Area Fill
  const lastX = chartW;
  const lastY = topPad + chartH - ((curPrice - min) / (max - min)) * chartH;
  ctx.lineTo(lastX, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  if (isDip) {
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
  } else {
    gradient.addColorStop(0, 'rgba(20, 241, 149, 0.3)');
    gradient.addColorStop(1, 'rgba(20, 241, 149, 0.0)');
  }
  ctx.fillStyle = gradient;
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();

  // Pulse Dot on Current Price
  ctx.save();
  ctx.fillStyle = isDip ? '#EF4444' : '#14F195';
  ctx.shadowColor = isDip ? '#EF4444' : '#14F195';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw Position Overlays (Entry, Trailing Stop, Take Profit)
  if (STATE.positions.length > 0) {
    const pos = STATE.positions[0];
    if (pos.status === 'OPEN') {
      // 1. Red Hard Stop-Loss Line (-6% below entry)
      const hardStopVal = pos.entryPrice * 0.94;
      drawPriceBand(hardStopVal, min, max, chartW, chartH, topPad, '#EF4444', '🛑 HARD STOP-LOSS (-6%): 
    }
  }
}

function drawPriceBand(priceVal, min, max, chartW, chartH, topPad, color, label) {
  if (priceVal < min || priceVal > max) return;
  const y = topPad + chartH - ((priceVal - min) / (max - min)) * chartH;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartW, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(label, chartW - 250, y - 6);
  ctx.restore();
}

// 3. AI Cognitive Stream
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

// 4. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 5. Update All UI Metrics & Visual Elements
function updateUI() {
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);

  document.getElementById('kpi-deployable-val').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('kpi-agent-total').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('kpi-kamino-total').innerText = `$${kaminoLocked.toFixed(2)} USDC`;
  document.getElementById('top-fleet-tvl').innerText = `$${(STATE.agentBalance + 103).toFixed(2)} USDC`;

  // Chart Indicators
  document.getElementById('chart-price-display').innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  document.getElementById('chart-rsi-display').innerText = TOKEN_CONFIG.SOL.rsi.toFixed(1);
  const chgEl = document.getElementById('chart-change-display');
  chgEl.innerText = `${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%`;
  chgEl.className = TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red';

  // Scrubber texts
  const scrubPrice = document.getElementById('scrubber-price-text');
  const scrubChg = document.getElementById('scrubber-change-text');
  if (scrubPrice) scrubPrice.innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  if (scrubChg) {
    scrubChg.innerText = `(${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%)`;
    scrubChg.className = 'scrubber-change ' + (TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red');
  }

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

  renderPositionsTable();
}

function renderPositionsTable() {
  const tbody = document.getElementById('live-positions-tbody');
  if (!tbody) return;
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

// 6. THE CORE REVOLUTION: Interactive Price Manipulation & Autonomous Agent Reflex
function handleManipulatedPrice(newPrice) {
  STATE.isSimulating = true;
  const baseline = TOKEN_CONFIG.SOL.baseline;
  const changePct = ((newPrice - baseline) / baseline) * 100;

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = changePct;
  // Dynamic RSI simulation
  TOKEN_CONFIG.SOL.rsi = Math.min(85, Math.max(18, 50 + (changePct * 2.2)));

  // Push to chart in real-time
  STATE.chartData.shift();
  STATE.chartData.push(newPrice);

  const isOversoldDip = changePct <= -7.5 || TOKEN_CONFIG.SOL.rsi <= 28;
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  // SCENARIO 1: DIP DETECTED
  if (isOversoldDip) {
    const hasOpenPos = STATE.positions.some(p => p.status === 'OPEN');

    if (!hasOpenPos) {
      // Check Capital Guard
      if (deployable <= 0) {
        addCognitionThought('GUARD SAFEGUARD', `Dip at $${newPrice.toFixed(2)} (${changePct.toFixed(1)}%). Wallet is $${STATE.agentBalance.toFixed(2)} (no surplus above $30). ZERO TRADES EXECUTED. Capital 100% protected.`, 'guard');
        showToast('🛡️ Capital Guard: 0 Trades executed (Operating reserve floor protected)');
      } else {
        // AUTONOMOUS STRIKE!
        const tradeAllocation = Math.min(deployable, 20.00);
        const amountBought = tradeAllocation / newPrice;
        const posId = 'pos_sol_' + Date.now().toString().slice(-4);

        const newPos = {
          id: posId,
          symbol: 'SOL',
          entryPrice: newPrice,
          amount: amountBought,
          costBasis: tradeAllocation,
          peakPrice: newPrice,
          status: 'OPEN',
          action: 'Dynamic Trailing Stop Armed (-4%)',
        };

        STATE.positions = [newPos, ...STATE.positions];
        addCognitionThought('AUTONOMOUS STRIKE', `💥 Flash Dip bought on Jupiter! Purchased ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)} using $${tradeAllocation.toFixed(2)} surplus capital.`, 'trade');
        showToast(`⚡ AUTONOMOUS BUY: ${amountBought.toFixed(4)} SOL @ $${newPrice.toFixed(2)} ($ ${tradeAllocation.toFixed(2)} USDC)`);
      }
    }
  }

  // SCENARIO 2: MANAGING OPEN POSITION (Hard Stop, Trailing Stop, Take Profit)
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  if (openPos) {
    // 1. Update Peak Price if price rises
    if (newPrice > openPos.peakPrice) {
      openPos.peakPrice = newPrice;
    }

    const pnlPct = ((newPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = openPos.entryPrice * 0.94; // -6.0% Hard Stop Loss
    const trailingStopPrice = openPos.peakPrice * 0.96; // -4.0% Trailing Stop from Peak
    const takeProfitPrice = openPos.entryPrice * 1.10; // +10.0% Take Profit Target

    // TRIGGER 1: TAKE-PROFIT (+10.0% reached in upper range)
    if (newPrice >= takeProfitPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🎉 TAKE_PROFIT (+10.0%)';

      addCognitionThought('TAKE PROFIT', `🎉 Target crossed at $${newPrice.toFixed(2)} (+10.0%)! Position closed. Realized +$${realizedGain.toFixed(4)} USDC profit. Re-vaulted to Kamino!`, 'exit');
      showToast(`🎉 TAKE-PROFIT TRIGGERED! Sold at $${newPrice.toFixed(2)} (+10.0%). Profit: +$${realizedGain.toFixed(4)} USDC!`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // TRIGGER 2: HARD STOP-LOSS (-6.0% Drop below entry - Emergency Brake)
    else if (newPrice <= hardStopPrice) {
      const realizedLoss = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛑 HARD STOP (-6.0%)';

      addCognitionThought('HARD STOP-LOSS', `🛑 Heavy drop detected at $${newPrice.toFixed(2)} (-6.0% below entry $${openPos.entryPrice.toFixed(2)}). Emergency stop executed to protect remaining capital!`, 'guard');
      showToast(`🛑 Hard Stop-Loss Hit at $${newPrice.toFixed(2)}! Loss capped at -6% to safeguard treasury.`);

      STATE.agentBalance += (openPos.costBasis + realizedLoss);
    }
    // TRIGGER 3: TRAILING STOP-LOSS (-4.0% Drop from Peak after price rose)
    else if (openPos.peakPrice > openPos.entryPrice * 1.02 && newPrice <= trailingStopPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = `🛡️ TRAILING STOP (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;

      addCognitionThought('TRAILING STOP', `🛡️ Price reversed from peak $${openPos.peakPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-4% pullback). Trailing stop locked in ${pnlPct >= 0 ? '+' : ''}${realizedGain.toFixed(4)} USDC!`, 'guard');
      showToast(`🛡️ Trailing Stop Hit at $${newPrice.toFixed(2)}! Capital preserved with ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% gain.`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // STATUS UPDATE: STILL HOLDING
    else {
      openPos.action = `HOLDING | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (Stop: $${Math.max(hardStopPrice, trailingStopPrice).toFixed(1)} | TP: $${takeProfitPrice.toFixed(1)})`;
    }
  }

  updateUI();
  renderChart();
}

// Attach Live Price Scrubber Event Listeners
const scrubber = document.getElementById('price-scrubber');
if (scrubber) {
  scrubber.addEventListener('input', (e) => {
    handleManipulatedPrice(parseFloat(e.target.value));
  });
}

// 7. Deposit Demo Funds Button (+ $50 USDC)
document.getElementById('btn-deposit-50').addEventListener('click', () => {
  STATE.agentBalance += 50.00;
  addCognitionThought('CAPITAL INJECTION', `Deposited $50.00 Demo USDC. Kamino Lending automatically locks $30.00 reserve (8.42% APY). Unlocked $20.00 for autonomous dip trading!`, 'guard');
  showToast('💰 Deposited $50.00 USDC! $30 vaulted to Kamino, $20 ready for dips.');
  updateUI();
});

// 8. Empty Wallet Button ($0 Safe Mode)
document.getElementById('btn-empty-wallet').addEventListener('click', () => {
  STATE.agentBalance = 0.00;
  STATE.positions = [];
  addCognitionThought('WALLET FLUSH', 'Emptied agent wallet to $0.00 USDC. Testing zero-capital protection mode.', 'guard');
  showToast('↺ Wallet reset to $0.00. Testing Safe Mode.');
  updateUI();
});

// 9. Quick Actions from Action Bar
document.getElementById('btn-trigger-dip').addEventListener('click', () => {
  const crashPrice = TOKEN_CONFIG.SOL.baseline * 0.915; // -8.5%
  if (scrubber) scrubber.value = crashPrice.toFixed(1);
  handleManipulatedPrice(crashPrice);
});

document.getElementById('btn-trigger-rebound').addEventListener('click', () => {
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  const reboundPrice = openPos ? openPos.entryPrice * 1.105 : TOKEN_CONFIG.SOL.baseline * 1.105;
  if (scrubber) scrubber.value = reboundPrice.toFixed(1);
  handleManipulatedPrice(reboundPrice);
});

document.getElementById('btn-reset-market').addEventListener('click', () => {
  STATE.isSimulating = false;
  TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
  TOKEN_CONFIG.SOL.change = 0.85;
  TOKEN_CONFIG.SOL.rsi = 48.2;
  STATE.positions = [];
  if (scrubber) scrubber.value = TOKEN_CONFIG.SOL.baseline.toFixed(1);
  addCognitionThought('SYNC', 'Market re-synchronized to live Solana Mainnet price.', 'scanner');
  showToast('↺ Synced with Solana Mainnet-Beta');
  syncLivePrices();
});

// 10. Robust Multi-Wallet Modal & Balance Sync
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

function openWalletModal() {
  if (modal) modal.style.display = 'flex';
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
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      return;
    } catch (err) {
      console.warn('Direct connect rejected, opening modal');
    }
  }
  openWalletModal();
});

document.getElementById('modal-btn-phantom').addEventListener('click', async () => {
  const provider = getSolanaProvider();
  if (provider) {
    try {
      const resp = await provider.connect();
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      closeWalletModal();
    } catch (err) {
      showToast('⚠️ Connection rejected in Phantom popup');
    }
  } else {
    window.open('https://phantom.app/', '_blank');
    showToast('Opening phantom.app installation page...');
  }
});

document.getElementById('modal-btn-creator').addEventListener('click', () => {
  handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
  closeWalletModal();
});

document.getElementById('custom-wallet-submit').addEventListener('click', () => {
  const val = document.getElementById('custom-wallet-input').value.trim();
  if (val && val.length >= 32 && val.length <= 44) {
    handleWalletConnected(val, 'Custom Public Key');
    closeWalletModal();
  } else {
    showToast('⚠️ Please enter a valid Solana Base58 address');
  }
});

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', `Linked ${source}: ${address}. Assigned as Fleet Yield Beneficiary.`, 'guard');
  showToast(`⚡ Connected: ${short} (${source})`);

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
    console.log('Balance query note:', err.message);
  }
}

// Harvest Yield Button
document.getElementById('btn-harvest-yield').addEventListener('click', () => {
  const harvested = STATE.earnedYield;
  STATE.earnedYield = 0.000005;
  addCognitionThought('HARVEST', `Harvested $${harvested.toFixed(6)} USDC lending yield from Kamino. Reinvested into treasury.`, 'guard');
  showToast(`🌾 Harvested +$${harvested.toFixed(6)} USDC from Kamino Vault`);
});

// Live Solana DEX Price Sync (DEXScreener API)
async function syncLivePrices() {
  if (STATE.isSimulating) return;
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('DEX sync error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const sym = pair.baseToken.symbol.toUpperCase();
        if (TOKEN_CONFIG[sym] && !STATE.isSimulating) {
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

  if (!STATE.isSimulating) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
   + hardStopVal.toFixed(2));

      // 2. Green Entry Line
      drawPriceBand(pos.entryPrice, min, max, chartW, chartH, topPad, '#14F195', '🟢 ENTRY BOUGHT: 
    }
  }
}

function drawPriceBand(priceVal, min, max, chartW, chartH, topPad, color, label) {
  if (priceVal < min || priceVal > max) return;
  const y = topPad + chartH - ((priceVal - min) / (max - min)) * chartH;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartW, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(label, chartW - 250, y - 6);
  ctx.restore();
}

// 3. AI Cognitive Stream
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

// 4. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 5. Update All UI Metrics & Visual Elements
function updateUI() {
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);

  document.getElementById('kpi-deployable-val').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('kpi-agent-total').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('kpi-kamino-total').innerText = `$${kaminoLocked.toFixed(2)} USDC`;
  document.getElementById('top-fleet-tvl').innerText = `$${(STATE.agentBalance + 103).toFixed(2)} USDC`;

  // Chart Indicators
  document.getElementById('chart-price-display').innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  document.getElementById('chart-rsi-display').innerText = TOKEN_CONFIG.SOL.rsi.toFixed(1);
  const chgEl = document.getElementById('chart-change-display');
  chgEl.innerText = `${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%`;
  chgEl.className = TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red';

  // Scrubber texts
  const scrubPrice = document.getElementById('scrubber-price-text');
  const scrubChg = document.getElementById('scrubber-change-text');
  if (scrubPrice) scrubPrice.innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  if (scrubChg) {
    scrubChg.innerText = `(${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%)`;
    scrubChg.className = 'scrubber-change ' + (TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red');
  }

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

  renderPositionsTable();
}

function renderPositionsTable() {
  const tbody = document.getElementById('live-positions-tbody');
  if (!tbody) return;
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

// 6. THE CORE REVOLUTION: Interactive Price Manipulation & Autonomous Agent Reflex
function handleManipulatedPrice(newPrice) {
  STATE.isSimulating = true;
  const baseline = TOKEN_CONFIG.SOL.baseline;
  const changePct = ((newPrice - baseline) / baseline) * 100;

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = changePct;
  // Dynamic RSI simulation
  TOKEN_CONFIG.SOL.rsi = Math.min(85, Math.max(18, 50 + (changePct * 2.2)));

  // Push to chart in real-time
  STATE.chartData.shift();
  STATE.chartData.push(newPrice);

  const isOversoldDip = changePct <= -7.5 || TOKEN_CONFIG.SOL.rsi <= 28;
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  // SCENARIO 1: DIP DETECTED
  if (isOversoldDip) {
    const hasOpenPos = STATE.positions.some(p => p.status === 'OPEN');

    if (!hasOpenPos) {
      // Check Capital Guard
      if (deployable <= 0) {
        addCognitionThought('GUARD SAFEGUARD', `Dip at $${newPrice.toFixed(2)} (${changePct.toFixed(1)}%). Wallet is $${STATE.agentBalance.toFixed(2)} (no surplus above $30). ZERO TRADES EXECUTED. Capital 100% protected.`, 'guard');
        showToast('🛡️ Capital Guard: 0 Trades executed (Operating reserve floor protected)');
      } else {
        // AUTONOMOUS STRIKE!
        const tradeAllocation = Math.min(deployable, 20.00);
        const amountBought = tradeAllocation / newPrice;
        const posId = 'pos_sol_' + Date.now().toString().slice(-4);

        const newPos = {
          id: posId,
          symbol: 'SOL',
          entryPrice: newPrice,
          amount: amountBought,
          costBasis: tradeAllocation,
          peakPrice: newPrice,
          status: 'OPEN',
          action: 'Dynamic Trailing Stop Armed (-4%)',
        };

        STATE.positions = [newPos, ...STATE.positions];
        addCognitionThought('AUTONOMOUS STRIKE', `💥 Flash Dip bought on Jupiter! Purchased ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)} using $${tradeAllocation.toFixed(2)} surplus capital.`, 'trade');
        showToast(`⚡ AUTONOMOUS BUY: ${amountBought.toFixed(4)} SOL @ $${newPrice.toFixed(2)} ($ ${tradeAllocation.toFixed(2)} USDC)`);
      }
    }
  }

  // SCENARIO 2: MANAGING OPEN POSITION (Hard Stop, Trailing Stop, Take Profit)
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  if (openPos) {
    // 1. Update Peak Price if price rises
    if (newPrice > openPos.peakPrice) {
      openPos.peakPrice = newPrice;
    }

    const pnlPct = ((newPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = openPos.entryPrice * 0.94; // -6.0% Hard Stop Loss
    const trailingStopPrice = openPos.peakPrice * 0.96; // -4.0% Trailing Stop from Peak
    const takeProfitPrice = openPos.entryPrice * 1.10; // +10.0% Take Profit Target

    // TRIGGER 1: TAKE-PROFIT (+10.0% reached in upper range)
    if (newPrice >= takeProfitPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🎉 TAKE_PROFIT (+10.0%)';

      addCognitionThought('TAKE PROFIT', `🎉 Target crossed at $${newPrice.toFixed(2)} (+10.0%)! Position closed. Realized +$${realizedGain.toFixed(4)} USDC profit. Re-vaulted to Kamino!`, 'exit');
      showToast(`🎉 TAKE-PROFIT TRIGGERED! Sold at $${newPrice.toFixed(2)} (+10.0%). Profit: +$${realizedGain.toFixed(4)} USDC!`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // TRIGGER 2: HARD STOP-LOSS (-6.0% Drop below entry - Emergency Brake)
    else if (newPrice <= hardStopPrice) {
      const realizedLoss = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛑 HARD STOP (-6.0%)';

      addCognitionThought('HARD STOP-LOSS', `🛑 Heavy drop detected at $${newPrice.toFixed(2)} (-6.0% below entry $${openPos.entryPrice.toFixed(2)}). Emergency stop executed to protect remaining capital!`, 'guard');
      showToast(`🛑 Hard Stop-Loss Hit at $${newPrice.toFixed(2)}! Loss capped at -6% to safeguard treasury.`);

      STATE.agentBalance += (openPos.costBasis + realizedLoss);
    }
    // TRIGGER 3: TRAILING STOP-LOSS (-4.0% Drop from Peak after price rose)
    else if (openPos.peakPrice > openPos.entryPrice * 1.02 && newPrice <= trailingStopPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = `🛡️ TRAILING STOP (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;

      addCognitionThought('TRAILING STOP', `🛡️ Price reversed from peak $${openPos.peakPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-4% pullback). Trailing stop locked in ${pnlPct >= 0 ? '+' : ''}${realizedGain.toFixed(4)} USDC!`, 'guard');
      showToast(`🛡️ Trailing Stop Hit at $${newPrice.toFixed(2)}! Capital preserved with ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% gain.`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // STATUS UPDATE: STILL HOLDING
    else {
      openPos.action = `HOLDING | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (Stop: $${Math.max(hardStopPrice, trailingStopPrice).toFixed(1)} | TP: $${takeProfitPrice.toFixed(1)})`;
    }
  }

  updateUI();
  renderChart();
}

// Attach Live Price Scrubber Event Listeners
const scrubber = document.getElementById('price-scrubber');
if (scrubber) {
  scrubber.addEventListener('input', (e) => {
    handleManipulatedPrice(parseFloat(e.target.value));
  });
}

// 7. Deposit Demo Funds Button (+ $50 USDC)
document.getElementById('btn-deposit-50').addEventListener('click', () => {
  STATE.agentBalance += 50.00;
  addCognitionThought('CAPITAL INJECTION', `Deposited $50.00 Demo USDC. Kamino Lending automatically locks $30.00 reserve (8.42% APY). Unlocked $20.00 for autonomous dip trading!`, 'guard');
  showToast('💰 Deposited $50.00 USDC! $30 vaulted to Kamino, $20 ready for dips.');
  updateUI();
});

// 8. Empty Wallet Button ($0 Safe Mode)
document.getElementById('btn-empty-wallet').addEventListener('click', () => {
  STATE.agentBalance = 0.00;
  STATE.positions = [];
  addCognitionThought('WALLET FLUSH', 'Emptied agent wallet to $0.00 USDC. Testing zero-capital protection mode.', 'guard');
  showToast('↺ Wallet reset to $0.00. Testing Safe Mode.');
  updateUI();
});

// 9. Quick Actions from Action Bar
document.getElementById('btn-trigger-dip').addEventListener('click', () => {
  const crashPrice = TOKEN_CONFIG.SOL.baseline * 0.915; // -8.5%
  if (scrubber) scrubber.value = crashPrice.toFixed(1);
  handleManipulatedPrice(crashPrice);
});

document.getElementById('btn-trigger-rebound').addEventListener('click', () => {
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  const reboundPrice = openPos ? openPos.entryPrice * 1.105 : TOKEN_CONFIG.SOL.baseline * 1.105;
  if (scrubber) scrubber.value = reboundPrice.toFixed(1);
  handleManipulatedPrice(reboundPrice);
});

document.getElementById('btn-reset-market').addEventListener('click', () => {
  STATE.isSimulating = false;
  TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
  TOKEN_CONFIG.SOL.change = 0.85;
  TOKEN_CONFIG.SOL.rsi = 48.2;
  STATE.positions = [];
  if (scrubber) scrubber.value = TOKEN_CONFIG.SOL.baseline.toFixed(1);
  addCognitionThought('SYNC', 'Market re-synchronized to live Solana Mainnet price.', 'scanner');
  showToast('↺ Synced with Solana Mainnet-Beta');
  syncLivePrices();
});

// 10. Robust Multi-Wallet Modal & Balance Sync
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

function openWalletModal() {
  if (modal) modal.style.display = 'flex';
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
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      return;
    } catch (err) {
      console.warn('Direct connect rejected, opening modal');
    }
  }
  openWalletModal();
});

document.getElementById('modal-btn-phantom').addEventListener('click', async () => {
  const provider = getSolanaProvider();
  if (provider) {
    try {
      const resp = await provider.connect();
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      closeWalletModal();
    } catch (err) {
      showToast('⚠️ Connection rejected in Phantom popup');
    }
  } else {
    window.open('https://phantom.app/', '_blank');
    showToast('Opening phantom.app installation page...');
  }
});

document.getElementById('modal-btn-creator').addEventListener('click', () => {
  handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
  closeWalletModal();
});

document.getElementById('custom-wallet-submit').addEventListener('click', () => {
  const val = document.getElementById('custom-wallet-input').value.trim();
  if (val && val.length >= 32 && val.length <= 44) {
    handleWalletConnected(val, 'Custom Public Key');
    closeWalletModal();
  } else {
    showToast('⚠️ Please enter a valid Solana Base58 address');
  }
});

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', `Linked ${source}: ${address}. Assigned as Fleet Yield Beneficiary.`, 'guard');
  showToast(`⚡ Connected: ${short} (${source})`);

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
    console.log('Balance query note:', err.message);
  }
}

// Harvest Yield Button
document.getElementById('btn-harvest-yield').addEventListener('click', () => {
  const harvested = STATE.earnedYield;
  STATE.earnedYield = 0.000005;
  addCognitionThought('HARVEST', `Harvested $${harvested.toFixed(6)} USDC lending yield from Kamino. Reinvested into treasury.`, 'guard');
  showToast(`🌾 Harvested +$${harvested.toFixed(6)} USDC from Kamino Vault`);
});

// Live Solana DEX Price Sync (DEXScreener API)
async function syncLivePrices() {
  if (STATE.isSimulating) return;
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('DEX sync error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const sym = pair.baseToken.symbol.toUpperCase();
        if (TOKEN_CONFIG[sym] && !STATE.isSimulating) {
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

  if (!STATE.isSimulating) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
   + pos.entryPrice.toFixed(2));

      // 3. Dynamic Trailing Stop (-4% from Peak)
      const trailingPrice = pos.peakPrice * 0.96;
      if (pos.peakPrice > pos.entryPrice * 1.01) {
        drawPriceBand(trailingPrice, min, max, chartW, chartH, topPad, '#C084FC', '🟣 TRAILING STOP: 
    }
  }
}

function drawPriceBand(priceVal, min, max, chartW, chartH, topPad, color, label) {
  if (priceVal < min || priceVal > max) return;
  const y = topPad + chartH - ((priceVal - min) / (max - min)) * chartH;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartW, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(label, chartW - 250, y - 6);
  ctx.restore();
}

// 3. AI Cognitive Stream
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

// 4. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 5. Update All UI Metrics & Visual Elements
function updateUI() {
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);

  document.getElementById('kpi-deployable-val').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('kpi-agent-total').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('kpi-kamino-total').innerText = `$${kaminoLocked.toFixed(2)} USDC`;
  document.getElementById('top-fleet-tvl').innerText = `$${(STATE.agentBalance + 103).toFixed(2)} USDC`;

  // Chart Indicators
  document.getElementById('chart-price-display').innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  document.getElementById('chart-rsi-display').innerText = TOKEN_CONFIG.SOL.rsi.toFixed(1);
  const chgEl = document.getElementById('chart-change-display');
  chgEl.innerText = `${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%`;
  chgEl.className = TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red';

  // Scrubber texts
  const scrubPrice = document.getElementById('scrubber-price-text');
  const scrubChg = document.getElementById('scrubber-change-text');
  if (scrubPrice) scrubPrice.innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  if (scrubChg) {
    scrubChg.innerText = `(${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%)`;
    scrubChg.className = 'scrubber-change ' + (TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red');
  }

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

  renderPositionsTable();
}

function renderPositionsTable() {
  const tbody = document.getElementById('live-positions-tbody');
  if (!tbody) return;
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

// 6. THE CORE REVOLUTION: Interactive Price Manipulation & Autonomous Agent Reflex
function handleManipulatedPrice(newPrice) {
  STATE.isSimulating = true;
  const baseline = TOKEN_CONFIG.SOL.baseline;
  const changePct = ((newPrice - baseline) / baseline) * 100;

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = changePct;
  // Dynamic RSI simulation
  TOKEN_CONFIG.SOL.rsi = Math.min(85, Math.max(18, 50 + (changePct * 2.2)));

  // Push to chart in real-time
  STATE.chartData.shift();
  STATE.chartData.push(newPrice);

  const isOversoldDip = changePct <= -7.5 || TOKEN_CONFIG.SOL.rsi <= 28;
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  // SCENARIO 1: DIP DETECTED
  if (isOversoldDip) {
    const hasOpenPos = STATE.positions.some(p => p.status === 'OPEN');

    if (!hasOpenPos) {
      // Check Capital Guard
      if (deployable <= 0) {
        addCognitionThought('GUARD SAFEGUARD', `Dip at $${newPrice.toFixed(2)} (${changePct.toFixed(1)}%). Wallet is $${STATE.agentBalance.toFixed(2)} (no surplus above $30). ZERO TRADES EXECUTED. Capital 100% protected.`, 'guard');
        showToast('🛡️ Capital Guard: 0 Trades executed (Operating reserve floor protected)');
      } else {
        // AUTONOMOUS STRIKE!
        const tradeAllocation = Math.min(deployable, 20.00);
        const amountBought = tradeAllocation / newPrice;
        const posId = 'pos_sol_' + Date.now().toString().slice(-4);

        const newPos = {
          id: posId,
          symbol: 'SOL',
          entryPrice: newPrice,
          amount: amountBought,
          costBasis: tradeAllocation,
          peakPrice: newPrice,
          status: 'OPEN',
          action: 'Dynamic Trailing Stop Armed (-4%)',
        };

        STATE.positions = [newPos, ...STATE.positions];
        addCognitionThought('AUTONOMOUS STRIKE', `💥 Flash Dip bought on Jupiter! Purchased ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)} using $${tradeAllocation.toFixed(2)} surplus capital.`, 'trade');
        showToast(`⚡ AUTONOMOUS BUY: ${amountBought.toFixed(4)} SOL @ $${newPrice.toFixed(2)} ($ ${tradeAllocation.toFixed(2)} USDC)`);
      }
    }
  }

  // SCENARIO 2: MANAGING OPEN POSITION (Hard Stop, Trailing Stop, Take Profit)
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  if (openPos) {
    // 1. Update Peak Price if price rises
    if (newPrice > openPos.peakPrice) {
      openPos.peakPrice = newPrice;
    }

    const pnlPct = ((newPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = openPos.entryPrice * 0.94; // -6.0% Hard Stop Loss
    const trailingStopPrice = openPos.peakPrice * 0.96; // -4.0% Trailing Stop from Peak
    const takeProfitPrice = openPos.entryPrice * 1.10; // +10.0% Take Profit Target

    // TRIGGER 1: TAKE-PROFIT (+10.0% reached in upper range)
    if (newPrice >= takeProfitPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🎉 TAKE_PROFIT (+10.0%)';

      addCognitionThought('TAKE PROFIT', `🎉 Target crossed at $${newPrice.toFixed(2)} (+10.0%)! Position closed. Realized +$${realizedGain.toFixed(4)} USDC profit. Re-vaulted to Kamino!`, 'exit');
      showToast(`🎉 TAKE-PROFIT TRIGGERED! Sold at $${newPrice.toFixed(2)} (+10.0%). Profit: +$${realizedGain.toFixed(4)} USDC!`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // TRIGGER 2: HARD STOP-LOSS (-6.0% Drop below entry - Emergency Brake)
    else if (newPrice <= hardStopPrice) {
      const realizedLoss = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛑 HARD STOP (-6.0%)';

      addCognitionThought('HARD STOP-LOSS', `🛑 Heavy drop detected at $${newPrice.toFixed(2)} (-6.0% below entry $${openPos.entryPrice.toFixed(2)}). Emergency stop executed to protect remaining capital!`, 'guard');
      showToast(`🛑 Hard Stop-Loss Hit at $${newPrice.toFixed(2)}! Loss capped at -6% to safeguard treasury.`);

      STATE.agentBalance += (openPos.costBasis + realizedLoss);
    }
    // TRIGGER 3: TRAILING STOP-LOSS (-4.0% Drop from Peak after price rose)
    else if (openPos.peakPrice > openPos.entryPrice * 1.02 && newPrice <= trailingStopPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = `🛡️ TRAILING STOP (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;

      addCognitionThought('TRAILING STOP', `🛡️ Price reversed from peak $${openPos.peakPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-4% pullback). Trailing stop locked in ${pnlPct >= 0 ? '+' : ''}${realizedGain.toFixed(4)} USDC!`, 'guard');
      showToast(`🛡️ Trailing Stop Hit at $${newPrice.toFixed(2)}! Capital preserved with ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% gain.`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // STATUS UPDATE: STILL HOLDING
    else {
      openPos.action = `HOLDING | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (Stop: $${Math.max(hardStopPrice, trailingStopPrice).toFixed(1)} | TP: $${takeProfitPrice.toFixed(1)})`;
    }
  }

  updateUI();
  renderChart();
}

// Attach Live Price Scrubber Event Listeners
const scrubber = document.getElementById('price-scrubber');
if (scrubber) {
  scrubber.addEventListener('input', (e) => {
    handleManipulatedPrice(parseFloat(e.target.value));
  });
}

// 7. Deposit Demo Funds Button (+ $50 USDC)
document.getElementById('btn-deposit-50').addEventListener('click', () => {
  STATE.agentBalance += 50.00;
  addCognitionThought('CAPITAL INJECTION', `Deposited $50.00 Demo USDC. Kamino Lending automatically locks $30.00 reserve (8.42% APY). Unlocked $20.00 for autonomous dip trading!`, 'guard');
  showToast('💰 Deposited $50.00 USDC! $30 vaulted to Kamino, $20 ready for dips.');
  updateUI();
});

// 8. Empty Wallet Button ($0 Safe Mode)
document.getElementById('btn-empty-wallet').addEventListener('click', () => {
  STATE.agentBalance = 0.00;
  STATE.positions = [];
  addCognitionThought('WALLET FLUSH', 'Emptied agent wallet to $0.00 USDC. Testing zero-capital protection mode.', 'guard');
  showToast('↺ Wallet reset to $0.00. Testing Safe Mode.');
  updateUI();
});

// 9. Quick Actions from Action Bar
document.getElementById('btn-trigger-dip').addEventListener('click', () => {
  const crashPrice = TOKEN_CONFIG.SOL.baseline * 0.915; // -8.5%
  if (scrubber) scrubber.value = crashPrice.toFixed(1);
  handleManipulatedPrice(crashPrice);
});

document.getElementById('btn-trigger-rebound').addEventListener('click', () => {
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  const reboundPrice = openPos ? openPos.entryPrice * 1.105 : TOKEN_CONFIG.SOL.baseline * 1.105;
  if (scrubber) scrubber.value = reboundPrice.toFixed(1);
  handleManipulatedPrice(reboundPrice);
});

document.getElementById('btn-reset-market').addEventListener('click', () => {
  STATE.isSimulating = false;
  TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
  TOKEN_CONFIG.SOL.change = 0.85;
  TOKEN_CONFIG.SOL.rsi = 48.2;
  STATE.positions = [];
  if (scrubber) scrubber.value = TOKEN_CONFIG.SOL.baseline.toFixed(1);
  addCognitionThought('SYNC', 'Market re-synchronized to live Solana Mainnet price.', 'scanner');
  showToast('↺ Synced with Solana Mainnet-Beta');
  syncLivePrices();
});

// 10. Robust Multi-Wallet Modal & Balance Sync
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

function openWalletModal() {
  if (modal) modal.style.display = 'flex';
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
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      return;
    } catch (err) {
      console.warn('Direct connect rejected, opening modal');
    }
  }
  openWalletModal();
});

document.getElementById('modal-btn-phantom').addEventListener('click', async () => {
  const provider = getSolanaProvider();
  if (provider) {
    try {
      const resp = await provider.connect();
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      closeWalletModal();
    } catch (err) {
      showToast('⚠️ Connection rejected in Phantom popup');
    }
  } else {
    window.open('https://phantom.app/', '_blank');
    showToast('Opening phantom.app installation page...');
  }
});

document.getElementById('modal-btn-creator').addEventListener('click', () => {
  handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
  closeWalletModal();
});

document.getElementById('custom-wallet-submit').addEventListener('click', () => {
  const val = document.getElementById('custom-wallet-input').value.trim();
  if (val && val.length >= 32 && val.length <= 44) {
    handleWalletConnected(val, 'Custom Public Key');
    closeWalletModal();
  } else {
    showToast('⚠️ Please enter a valid Solana Base58 address');
  }
});

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', `Linked ${source}: ${address}. Assigned as Fleet Yield Beneficiary.`, 'guard');
  showToast(`⚡ Connected: ${short} (${source})`);

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
    console.log('Balance query note:', err.message);
  }
}

// Harvest Yield Button
document.getElementById('btn-harvest-yield').addEventListener('click', () => {
  const harvested = STATE.earnedYield;
  STATE.earnedYield = 0.000005;
  addCognitionThought('HARVEST', `Harvested $${harvested.toFixed(6)} USDC lending yield from Kamino. Reinvested into treasury.`, 'guard');
  showToast(`🌾 Harvested +$${harvested.toFixed(6)} USDC from Kamino Vault`);
});

// Live Solana DEX Price Sync (DEXScreener API)
async function syncLivePrices() {
  if (STATE.isSimulating) return;
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('DEX sync error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const sym = pair.baseToken.symbol.toUpperCase();
        if (TOKEN_CONFIG[sym] && !STATE.isSimulating) {
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

  if (!STATE.isSimulating) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
   + trailingPrice.toFixed(2));
      }

      // 4. Take Profit Line (+10% above entry)
      const tpPrice = pos.entryPrice * 1.10;
      drawPriceBand(tpPrice, min, max, chartW, chartH, topPad, '#FBBF24', '🟡 TAKE-PROFIT EXIT (+10%): 
    }
  }
}

function drawPriceBand(priceVal, min, max, chartW, chartH, topPad, color, label) {
  if (priceVal < min || priceVal > max) return;
  const y = topPad + chartH - ((priceVal - min) / (max - min)) * chartH;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartW, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(label, chartW - 250, y - 6);
  ctx.restore();
}

// 3. AI Cognitive Stream
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

// 4. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 5. Update All UI Metrics & Visual Elements
function updateUI() {
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);

  document.getElementById('kpi-deployable-val').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('kpi-agent-total').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('kpi-kamino-total').innerText = `$${kaminoLocked.toFixed(2)} USDC`;
  document.getElementById('top-fleet-tvl').innerText = `$${(STATE.agentBalance + 103).toFixed(2)} USDC`;

  // Chart Indicators
  document.getElementById('chart-price-display').innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  document.getElementById('chart-rsi-display').innerText = TOKEN_CONFIG.SOL.rsi.toFixed(1);
  const chgEl = document.getElementById('chart-change-display');
  chgEl.innerText = `${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%`;
  chgEl.className = TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red';

  // Scrubber texts
  const scrubPrice = document.getElementById('scrubber-price-text');
  const scrubChg = document.getElementById('scrubber-change-text');
  if (scrubPrice) scrubPrice.innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  if (scrubChg) {
    scrubChg.innerText = `(${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%)`;
    scrubChg.className = 'scrubber-change ' + (TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red');
  }

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

  renderPositionsTable();
}

function renderPositionsTable() {
  const tbody = document.getElementById('live-positions-tbody');
  if (!tbody) return;
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

// 6. THE CORE REVOLUTION: Interactive Price Manipulation & Autonomous Agent Reflex
function handleManipulatedPrice(newPrice) {
  STATE.isSimulating = true;
  const baseline = TOKEN_CONFIG.SOL.baseline;
  const changePct = ((newPrice - baseline) / baseline) * 100;

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = changePct;
  // Dynamic RSI simulation
  TOKEN_CONFIG.SOL.rsi = Math.min(85, Math.max(18, 50 + (changePct * 2.2)));

  // Push to chart in real-time
  STATE.chartData.shift();
  STATE.chartData.push(newPrice);

  const isOversoldDip = changePct <= -7.5 || TOKEN_CONFIG.SOL.rsi <= 28;
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  // SCENARIO 1: DIP DETECTED
  if (isOversoldDip) {
    const hasOpenPos = STATE.positions.some(p => p.status === 'OPEN');

    if (!hasOpenPos) {
      // Check Capital Guard
      if (deployable <= 0) {
        addCognitionThought('GUARD SAFEGUARD', `Dip at $${newPrice.toFixed(2)} (${changePct.toFixed(1)}%). Wallet is $${STATE.agentBalance.toFixed(2)} (no surplus above $30). ZERO TRADES EXECUTED. Capital 100% protected.`, 'guard');
        showToast('🛡️ Capital Guard: 0 Trades executed (Operating reserve floor protected)');
      } else {
        // AUTONOMOUS STRIKE!
        const tradeAllocation = Math.min(deployable, 20.00);
        const amountBought = tradeAllocation / newPrice;
        const posId = 'pos_sol_' + Date.now().toString().slice(-4);

        const newPos = {
          id: posId,
          symbol: 'SOL',
          entryPrice: newPrice,
          amount: amountBought,
          costBasis: tradeAllocation,
          peakPrice: newPrice,
          status: 'OPEN',
          action: 'Dynamic Trailing Stop Armed (-4%)',
        };

        STATE.positions = [newPos, ...STATE.positions];
        addCognitionThought('AUTONOMOUS STRIKE', `💥 Flash Dip bought on Jupiter! Purchased ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)} using $${tradeAllocation.toFixed(2)} surplus capital.`, 'trade');
        showToast(`⚡ AUTONOMOUS BUY: ${amountBought.toFixed(4)} SOL @ $${newPrice.toFixed(2)} ($ ${tradeAllocation.toFixed(2)} USDC)`);
      }
    }
  }

  // SCENARIO 2: MANAGING OPEN POSITION (Hard Stop, Trailing Stop, Take Profit)
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  if (openPos) {
    // 1. Update Peak Price if price rises
    if (newPrice > openPos.peakPrice) {
      openPos.peakPrice = newPrice;
    }

    const pnlPct = ((newPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = openPos.entryPrice * 0.94; // -6.0% Hard Stop Loss
    const trailingStopPrice = openPos.peakPrice * 0.96; // -4.0% Trailing Stop from Peak
    const takeProfitPrice = openPos.entryPrice * 1.10; // +10.0% Take Profit Target

    // TRIGGER 1: TAKE-PROFIT (+10.0% reached in upper range)
    if (newPrice >= takeProfitPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🎉 TAKE_PROFIT (+10.0%)';

      addCognitionThought('TAKE PROFIT', `🎉 Target crossed at $${newPrice.toFixed(2)} (+10.0%)! Position closed. Realized +$${realizedGain.toFixed(4)} USDC profit. Re-vaulted to Kamino!`, 'exit');
      showToast(`🎉 TAKE-PROFIT TRIGGERED! Sold at $${newPrice.toFixed(2)} (+10.0%). Profit: +$${realizedGain.toFixed(4)} USDC!`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // TRIGGER 2: HARD STOP-LOSS (-6.0% Drop below entry - Emergency Brake)
    else if (newPrice <= hardStopPrice) {
      const realizedLoss = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛑 HARD STOP (-6.0%)';

      addCognitionThought('HARD STOP-LOSS', `🛑 Heavy drop detected at $${newPrice.toFixed(2)} (-6.0% below entry $${openPos.entryPrice.toFixed(2)}). Emergency stop executed to protect remaining capital!`, 'guard');
      showToast(`🛑 Hard Stop-Loss Hit at $${newPrice.toFixed(2)}! Loss capped at -6% to safeguard treasury.`);

      STATE.agentBalance += (openPos.costBasis + realizedLoss);
    }
    // TRIGGER 3: TRAILING STOP-LOSS (-4.0% Drop from Peak after price rose)
    else if (openPos.peakPrice > openPos.entryPrice * 1.02 && newPrice <= trailingStopPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = `🛡️ TRAILING STOP (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;

      addCognitionThought('TRAILING STOP', `🛡️ Price reversed from peak $${openPos.peakPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-4% pullback). Trailing stop locked in ${pnlPct >= 0 ? '+' : ''}${realizedGain.toFixed(4)} USDC!`, 'guard');
      showToast(`🛡️ Trailing Stop Hit at $${newPrice.toFixed(2)}! Capital preserved with ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% gain.`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // STATUS UPDATE: STILL HOLDING
    else {
      openPos.action = `HOLDING | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (Stop: $${Math.max(hardStopPrice, trailingStopPrice).toFixed(1)} | TP: $${takeProfitPrice.toFixed(1)})`;
    }
  }

  updateUI();
  renderChart();
}

// Attach Live Price Scrubber Event Listeners
const scrubber = document.getElementById('price-scrubber');
if (scrubber) {
  scrubber.addEventListener('input', (e) => {
    handleManipulatedPrice(parseFloat(e.target.value));
  });
}

// 7. Deposit Demo Funds Button (+ $50 USDC)
document.getElementById('btn-deposit-50').addEventListener('click', () => {
  STATE.agentBalance += 50.00;
  addCognitionThought('CAPITAL INJECTION', `Deposited $50.00 Demo USDC. Kamino Lending automatically locks $30.00 reserve (8.42% APY). Unlocked $20.00 for autonomous dip trading!`, 'guard');
  showToast('💰 Deposited $50.00 USDC! $30 vaulted to Kamino, $20 ready for dips.');
  updateUI();
});

// 8. Empty Wallet Button ($0 Safe Mode)
document.getElementById('btn-empty-wallet').addEventListener('click', () => {
  STATE.agentBalance = 0.00;
  STATE.positions = [];
  addCognitionThought('WALLET FLUSH', 'Emptied agent wallet to $0.00 USDC. Testing zero-capital protection mode.', 'guard');
  showToast('↺ Wallet reset to $0.00. Testing Safe Mode.');
  updateUI();
});

// 9. Quick Actions from Action Bar
document.getElementById('btn-trigger-dip').addEventListener('click', () => {
  const crashPrice = TOKEN_CONFIG.SOL.baseline * 0.915; // -8.5%
  if (scrubber) scrubber.value = crashPrice.toFixed(1);
  handleManipulatedPrice(crashPrice);
});

document.getElementById('btn-trigger-rebound').addEventListener('click', () => {
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  const reboundPrice = openPos ? openPos.entryPrice * 1.105 : TOKEN_CONFIG.SOL.baseline * 1.105;
  if (scrubber) scrubber.value = reboundPrice.toFixed(1);
  handleManipulatedPrice(reboundPrice);
});

document.getElementById('btn-reset-market').addEventListener('click', () => {
  STATE.isSimulating = false;
  TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
  TOKEN_CONFIG.SOL.change = 0.85;
  TOKEN_CONFIG.SOL.rsi = 48.2;
  STATE.positions = [];
  if (scrubber) scrubber.value = TOKEN_CONFIG.SOL.baseline.toFixed(1);
  addCognitionThought('SYNC', 'Market re-synchronized to live Solana Mainnet price.', 'scanner');
  showToast('↺ Synced with Solana Mainnet-Beta');
  syncLivePrices();
});

// 10. Robust Multi-Wallet Modal & Balance Sync
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

function openWalletModal() {
  if (modal) modal.style.display = 'flex';
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
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      return;
    } catch (err) {
      console.warn('Direct connect rejected, opening modal');
    }
  }
  openWalletModal();
});

document.getElementById('modal-btn-phantom').addEventListener('click', async () => {
  const provider = getSolanaProvider();
  if (provider) {
    try {
      const resp = await provider.connect();
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      closeWalletModal();
    } catch (err) {
      showToast('⚠️ Connection rejected in Phantom popup');
    }
  } else {
    window.open('https://phantom.app/', '_blank');
    showToast('Opening phantom.app installation page...');
  }
});

document.getElementById('modal-btn-creator').addEventListener('click', () => {
  handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
  closeWalletModal();
});

document.getElementById('custom-wallet-submit').addEventListener('click', () => {
  const val = document.getElementById('custom-wallet-input').value.trim();
  if (val && val.length >= 32 && val.length <= 44) {
    handleWalletConnected(val, 'Custom Public Key');
    closeWalletModal();
  } else {
    showToast('⚠️ Please enter a valid Solana Base58 address');
  }
});

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', `Linked ${source}: ${address}. Assigned as Fleet Yield Beneficiary.`, 'guard');
  showToast(`⚡ Connected: ${short} (${source})`);

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
    console.log('Balance query note:', err.message);
  }
}

// Harvest Yield Button
document.getElementById('btn-harvest-yield').addEventListener('click', () => {
  const harvested = STATE.earnedYield;
  STATE.earnedYield = 0.000005;
  addCognitionThought('HARVEST', `Harvested $${harvested.toFixed(6)} USDC lending yield from Kamino. Reinvested into treasury.`, 'guard');
  showToast(`🌾 Harvested +$${harvested.toFixed(6)} USDC from Kamino Vault`);
});

// Live Solana DEX Price Sync (DEXScreener API)
async function syncLivePrices() {
  if (STATE.isSimulating) return;
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('DEX sync error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const sym = pair.baseToken.symbol.toUpperCase();
        if (TOKEN_CONFIG[sym] && !STATE.isSimulating) {
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

  if (!STATE.isSimulating) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
   + tpPrice.toFixed(2));
    }
  }
}

function drawPriceBand(priceVal, min, max, chartW, chartH, topPad, color, label) {
  if (priceVal < min || priceVal > max) return;
  const y = topPad + chartH - ((priceVal - min) / (max - min)) * chartH;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(chartW, y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(label, chartW - 250, y - 6);
  ctx.restore();
}

// 3. AI Cognitive Stream
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

// 4. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 5. Update All UI Metrics & Visual Elements
function updateUI() {
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);

  document.getElementById('kpi-deployable-val').innerText = `$${deployable.toFixed(2)} USDC`;
  document.getElementById('kpi-agent-total').innerText = `$${STATE.agentBalance.toFixed(2)} USDC`;
  document.getElementById('kpi-kamino-total').innerText = `$${kaminoLocked.toFixed(2)} USDC`;
  document.getElementById('top-fleet-tvl').innerText = `$${(STATE.agentBalance + 103).toFixed(2)} USDC`;

  // Chart Indicators
  document.getElementById('chart-price-display').innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  document.getElementById('chart-rsi-display').innerText = TOKEN_CONFIG.SOL.rsi.toFixed(1);
  const chgEl = document.getElementById('chart-change-display');
  chgEl.innerText = `${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%`;
  chgEl.className = TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red';

  // Scrubber texts
  const scrubPrice = document.getElementById('scrubber-price-text');
  const scrubChg = document.getElementById('scrubber-change-text');
  if (scrubPrice) scrubPrice.innerText = `$${TOKEN_CONFIG.SOL.price.toFixed(2)}`;
  if (scrubChg) {
    scrubChg.innerText = `(${TOKEN_CONFIG.SOL.change >= 0 ? '+' : ''}${TOKEN_CONFIG.SOL.change.toFixed(2)}%)`;
    scrubChg.className = 'scrubber-change ' + (TOKEN_CONFIG.SOL.change >= 0 ? 'text-green' : 'text-red');
  }

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

  renderPositionsTable();
}

function renderPositionsTable() {
  const tbody = document.getElementById('live-positions-tbody');
  if (!tbody) return;
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

// 6. THE CORE REVOLUTION: Interactive Price Manipulation & Autonomous Agent Reflex
function handleManipulatedPrice(newPrice) {
  STATE.isSimulating = true;
  const baseline = TOKEN_CONFIG.SOL.baseline;
  const changePct = ((newPrice - baseline) / baseline) * 100;

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = changePct;
  // Dynamic RSI simulation
  TOKEN_CONFIG.SOL.rsi = Math.min(85, Math.max(18, 50 + (changePct * 2.2)));

  // Push to chart in real-time
  STATE.chartData.shift();
  STATE.chartData.push(newPrice);

  const isOversoldDip = changePct <= -7.5 || TOKEN_CONFIG.SOL.rsi <= 28;
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  // SCENARIO 1: DIP DETECTED
  if (isOversoldDip) {
    const hasOpenPos = STATE.positions.some(p => p.status === 'OPEN');

    if (!hasOpenPos) {
      // Check Capital Guard
      if (deployable <= 0) {
        addCognitionThought('GUARD SAFEGUARD', `Dip at $${newPrice.toFixed(2)} (${changePct.toFixed(1)}%). Wallet is $${STATE.agentBalance.toFixed(2)} (no surplus above $30). ZERO TRADES EXECUTED. Capital 100% protected.`, 'guard');
        showToast('🛡️ Capital Guard: 0 Trades executed (Operating reserve floor protected)');
      } else {
        // AUTONOMOUS STRIKE!
        const tradeAllocation = Math.min(deployable, 20.00);
        const amountBought = tradeAllocation / newPrice;
        const posId = 'pos_sol_' + Date.now().toString().slice(-4);

        const newPos = {
          id: posId,
          symbol: 'SOL',
          entryPrice: newPrice,
          amount: amountBought,
          costBasis: tradeAllocation,
          peakPrice: newPrice,
          status: 'OPEN',
          action: 'Dynamic Trailing Stop Armed (-4%)',
        };

        STATE.positions = [newPos, ...STATE.positions];
        addCognitionThought('AUTONOMOUS STRIKE', `💥 Flash Dip bought on Jupiter! Purchased ${amountBought.toFixed(4)} SOL at $${newPrice.toFixed(2)} using $${tradeAllocation.toFixed(2)} surplus capital.`, 'trade');
        showToast(`⚡ AUTONOMOUS BUY: ${amountBought.toFixed(4)} SOL @ $${newPrice.toFixed(2)} ($ ${tradeAllocation.toFixed(2)} USDC)`);
      }
    }
  }

  // SCENARIO 2: MANAGING OPEN POSITION (Hard Stop, Trailing Stop, Take Profit)
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  if (openPos) {
    // 1. Update Peak Price if price rises
    if (newPrice > openPos.peakPrice) {
      openPos.peakPrice = newPrice;
    }

    const pnlPct = ((newPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = openPos.entryPrice * 0.94; // -6.0% Hard Stop Loss
    const trailingStopPrice = openPos.peakPrice * 0.96; // -4.0% Trailing Stop from Peak
    const takeProfitPrice = openPos.entryPrice * 1.10; // +10.0% Take Profit Target

    // TRIGGER 1: TAKE-PROFIT (+10.0% reached in upper range)
    if (newPrice >= takeProfitPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🎉 TAKE_PROFIT (+10.0%)';

      addCognitionThought('TAKE PROFIT', `🎉 Target crossed at $${newPrice.toFixed(2)} (+10.0%)! Position closed. Realized +$${realizedGain.toFixed(4)} USDC profit. Re-vaulted to Kamino!`, 'exit');
      showToast(`🎉 TAKE-PROFIT TRIGGERED! Sold at $${newPrice.toFixed(2)} (+10.0%). Profit: +$${realizedGain.toFixed(4)} USDC!`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // TRIGGER 2: HARD STOP-LOSS (-6.0% Drop below entry - Emergency Brake)
    else if (newPrice <= hardStopPrice) {
      const realizedLoss = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛑 HARD STOP (-6.0%)';

      addCognitionThought('HARD STOP-LOSS', `🛑 Heavy drop detected at $${newPrice.toFixed(2)} (-6.0% below entry $${openPos.entryPrice.toFixed(2)}). Emergency stop executed to protect remaining capital!`, 'guard');
      showToast(`🛑 Hard Stop-Loss Hit at $${newPrice.toFixed(2)}! Loss capped at -6% to safeguard treasury.`);

      STATE.agentBalance += (openPos.costBasis + realizedLoss);
    }
    // TRIGGER 3: TRAILING STOP-LOSS (-4.0% Drop from Peak after price rose)
    else if (openPos.peakPrice > openPos.entryPrice * 1.02 && newPrice <= trailingStopPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = `🛡️ TRAILING STOP (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;

      addCognitionThought('TRAILING STOP', `🛡️ Price reversed from peak $${openPos.peakPrice.toFixed(2)} to $${newPrice.toFixed(2)} (-4% pullback). Trailing stop locked in ${pnlPct >= 0 ? '+' : ''}${realizedGain.toFixed(4)} USDC!`, 'guard');
      showToast(`🛡️ Trailing Stop Hit at $${newPrice.toFixed(2)}! Capital preserved with ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% gain.`);

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // STATUS UPDATE: STILL HOLDING
    else {
      openPos.action = `HOLDING | PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (Stop: $${Math.max(hardStopPrice, trailingStopPrice).toFixed(1)} | TP: $${takeProfitPrice.toFixed(1)})`;
    }
  }

  updateUI();
  renderChart();
}

// Attach Live Price Scrubber Event Listeners
const scrubber = document.getElementById('price-scrubber');
if (scrubber) {
  scrubber.addEventListener('input', (e) => {
    handleManipulatedPrice(parseFloat(e.target.value));
  });
}

// 7. Deposit Demo Funds Button (+ $50 USDC)
document.getElementById('btn-deposit-50').addEventListener('click', () => {
  STATE.agentBalance += 50.00;
  addCognitionThought('CAPITAL INJECTION', `Deposited $50.00 Demo USDC. Kamino Lending automatically locks $30.00 reserve (8.42% APY). Unlocked $20.00 for autonomous dip trading!`, 'guard');
  showToast('💰 Deposited $50.00 USDC! $30 vaulted to Kamino, $20 ready for dips.');
  updateUI();
});

// 8. Empty Wallet Button ($0 Safe Mode)
document.getElementById('btn-empty-wallet').addEventListener('click', () => {
  STATE.agentBalance = 0.00;
  STATE.positions = [];
  addCognitionThought('WALLET FLUSH', 'Emptied agent wallet to $0.00 USDC. Testing zero-capital protection mode.', 'guard');
  showToast('↺ Wallet reset to $0.00. Testing Safe Mode.');
  updateUI();
});

// 9. Quick Actions from Action Bar
document.getElementById('btn-trigger-dip').addEventListener('click', () => {
  const crashPrice = TOKEN_CONFIG.SOL.baseline * 0.915; // -8.5%
  if (scrubber) scrubber.value = crashPrice.toFixed(1);
  handleManipulatedPrice(crashPrice);
});

document.getElementById('btn-trigger-rebound').addEventListener('click', () => {
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  const reboundPrice = openPos ? openPos.entryPrice * 1.105 : TOKEN_CONFIG.SOL.baseline * 1.105;
  if (scrubber) scrubber.value = reboundPrice.toFixed(1);
  handleManipulatedPrice(reboundPrice);
});

document.getElementById('btn-reset-market').addEventListener('click', () => {
  STATE.isSimulating = false;
  TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
  TOKEN_CONFIG.SOL.change = 0.85;
  TOKEN_CONFIG.SOL.rsi = 48.2;
  STATE.positions = [];
  if (scrubber) scrubber.value = TOKEN_CONFIG.SOL.baseline.toFixed(1);
  addCognitionThought('SYNC', 'Market re-synchronized to live Solana Mainnet price.', 'scanner');
  showToast('↺ Synced with Solana Mainnet-Beta');
  syncLivePrices();
});

// 10. Robust Multi-Wallet Modal & Balance Sync
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

function openWalletModal() {
  if (modal) modal.style.display = 'flex';
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
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      return;
    } catch (err) {
      console.warn('Direct connect rejected, opening modal');
    }
  }
  openWalletModal();
});

document.getElementById('modal-btn-phantom').addEventListener('click', async () => {
  const provider = getSolanaProvider();
  if (provider) {
    try {
      const resp = await provider.connect();
      handleWalletConnected(resp.publicKey.toString(), 'Phantom Extension');
      closeWalletModal();
    } catch (err) {
      showToast('⚠️ Connection rejected in Phantom popup');
    }
  } else {
    window.open('https://phantom.app/', '_blank');
    showToast('Opening phantom.app installation page...');
  }
});

document.getElementById('modal-btn-creator').addEventListener('click', () => {
  handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
  closeWalletModal();
});

document.getElementById('custom-wallet-submit').addEventListener('click', () => {
  const val = document.getElementById('custom-wallet-input').value.trim();
  if (val && val.length >= 32 && val.length <= 44) {
    handleWalletConnected(val, 'Custom Public Key');
    closeWalletModal();
  } else {
    showToast('⚠️ Please enter a valid Solana Base58 address');
  }
});

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', `Linked ${source}: ${address}. Assigned as Fleet Yield Beneficiary.`, 'guard');
  showToast(`⚡ Connected: ${short} (${source})`);

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
    console.log('Balance query note:', err.message);
  }
}

// Harvest Yield Button
document.getElementById('btn-harvest-yield').addEventListener('click', () => {
  const harvested = STATE.earnedYield;
  STATE.earnedYield = 0.000005;
  addCognitionThought('HARVEST', `Harvested $${harvested.toFixed(6)} USDC lending yield from Kamino. Reinvested into treasury.`, 'guard');
  showToast(`🌾 Harvested +$${harvested.toFixed(6)} USDC from Kamino Vault`);
});

// Live Solana DEX Price Sync (DEXScreener API)
async function syncLivePrices() {
  if (STATE.isSimulating) return;
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
    if (!res.ok) throw new Error('DEX sync error');
    const data = await res.json();

    if (data.pairs && data.pairs.length > 0) {
      for (const pair of data.pairs) {
        const sym = pair.baseToken.symbol.toUpperCase();
        if (TOKEN_CONFIG[sym] && !STATE.isSimulating) {
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

  if (!STATE.isSimulating) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
  