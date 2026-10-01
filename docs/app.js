/**
 * Solana Agent Treasury - Interactive Autonomous Terminal
 * Built for Superteam Germany "Road to Colosseum" Hackathon
 * 
 * Features:
 * - Real-Time Solana DEX Sync (DEXScreener API)
 * - Autonomous Jupiter Flash Dip Buying (< -7.5% drop or RSI <= 28)
 * - Strict Hard Stop-Loss (-6% emergency risk brake)
 * - Dynamic Trailing Stop (-4% pullback from peak)
 * - Take-Profit Harvester (+10% auto-exit back to Kamino Lending)
 * - Autonomous 8.42% APY Yield Accumulator
 * - Multi-Wallet Modal (Phantom, Creator Verified 9BNq3m...79CJ, Custom)
 */

// 1. Initial State
const TOKEN_CONFIG = {
  SOL: { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', price: 119.50, baseline: 119.50, change: 0.85, rsi: 48.2 },
  JUP: { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', price: 0.824, baseline: 0.824, change: -1.20, rsi: 44.5 },
  KMNO: { symbol: 'KMNO', name: 'Kamino', mint: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS', price: 0.142, baseline: 0.142, change: 3.40, rsi: 56.1 }
};

const STATE = {
  totalAum: 4850.00,
  agentBalance: 0.00,      // Demo Treasury Wallet Balance
  reserveFloor: 30.00,      // Kamino Lending Floor (always locked at 8.42% APY)
  kaminoApy: 0.0842,        // 8.42% APY
  earnedYield: 0.000412,
  connectedWallet: null,
  positions: [],
  isSimulating: false,
  dipCooldown: false,       // Prevents rapid churn / knife catching on the same dip wave
  lastExitReason: null,
  chartData: []
};

// Generate initial smooth price series
function initChartData() {
  const pts = 24;
  const base = TOKEN_CONFIG.SOL.baseline;
  STATE.chartData = [];
  for (let i = 0; i < pts; i++) {
    const noise = (Math.sin(i * 0.45) * 1.8) + ((Math.random() - 0.48) * 1.2);
    STATE.chartData.push(base + noise);
  }
  STATE.chartData[STATE.chartData.length - 1] = TOKEN_CONFIG.SOL.price;
}

// 2. High-DPI Canvas Rendering
let chartCanvas = null;
let ctx = null;

function resizeCanvas() {
  if (!chartCanvas) return;
  const rect = chartCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  chartCanvas.width = rect.width * dpr;
  chartCanvas.height = rect.height * dpr;
  ctx = chartCanvas.getContext('2d');
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

  const chartW = w - 65; // Right padding for Y-axis labels
  const chartH = h - 40;
  const topPad = 20;

  // Determine dynamic price range bounds including active positions & stops
  let minPrice = Math.min(...data);
  let maxPrice = Math.max(...data);

  if (STATE.positions.length > 0) {
    const pos = STATE.positions[0];
    if (pos.status === 'OPEN') {
      minPrice = Math.min(minPrice, pos.entryPrice * 0.93);
      maxPrice = Math.max(maxPrice, pos.entryPrice * 1.12);
    }
  }

  const min = Math.min(minPrice, 85) * 0.98;
  const max = Math.max(maxPrice, 145) * 1.02;

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

    // Grid line
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartW, y);
    ctx.stroke();

    // Price Label
    ctx.fillText('$' + priceVal.toFixed(0), chartW + 10, y + 4);
  }
  ctx.restore();

  // Draw Shaded Dip Trigger Zone (< -7.5% from baseline)
  const dipThresholdPrice = TOKEN_CONFIG.SOL.baseline * 0.925;
  const dipY = topPad + chartH - ((dipThresholdPrice - min) / (max - min)) * chartH;
  if (dipY < h && dipY > 0) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.fillRect(0, dipY, chartW, h - dipY);

    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('⚡ OVERSOLD DIP BUY ZONE (< -7.5% / $' + dipThresholdPrice.toFixed(1) + ')', 20, h - 14);
    ctx.restore();
  }

  // Draw Price Line with Smooth Bézier Curves
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

  // Draw Position Overlays (Hard Stop, Entry, Trailing Stop, Take Profit)
  if (STATE.positions.length > 0) {
    const pos = STATE.positions[0];
    if (pos.status === 'OPEN') {
      // 1. Red Hard Stop-Loss Line (-6% below entry)
      const hardStopVal = pos.entryPrice * 0.94;
      drawPriceBand(hardStopVal, min, max, chartW, chartH, topPad, '#EF4444', '🛑 HARD STOP (-6%): $' + hardStopVal.toFixed(2));

      // 2. Green Entry Line
      drawPriceBand(pos.entryPrice, min, max, chartW, chartH, topPad, '#14F195', '🟢 ENTRY: $' + pos.entryPrice.toFixed(2));

      // 3. Dynamic Trailing Stop (-4% from Peak after gain)
      const trailingPrice = pos.peakPrice * 0.96;
      if (pos.peakPrice > pos.entryPrice * 1.01) {
        drawPriceBand(trailingPrice, min, max, chartW, chartH, topPad, '#C084FC', '🟣 TRAILING STOP (-4%): $' + trailingPrice.toFixed(2));
      }

      // 4. Gold Take Profit Line (+10% above entry)
      const tpPrice = pos.entryPrice * 1.10;
      drawPriceBand(tpPrice, min, max, chartW, chartH, topPad, '#FBBF24', '🟡 TAKE-PROFIT (+10%): $' + tpPrice.toFixed(2));
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
  ctx.fillText(label, chartW - 240, y - 6);
  ctx.restore();
}

// 3. AI Cognitive Stream
function addCognitionThought(tag, text, type = 'scanner') {
  const stream = document.getElementById('cognition-stream');
  if (!stream) return;

  const entry = document.createElement('div');
  entry.className = 'thought-entry ' + type;
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = '<span class="thought-time">[' + time + ']</span><span class="thought-tag">' + tag + ':</span> ' + text;
  stream.appendChild(entry);
  stream.scrollTop = stream.scrollHeight;
}

// 4. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// 5. Update KPI Cards & Matrix Table
function updateUI() {
  // Balance Cards
  const balEl = document.getElementById('kpi-wallet-bal');
  if (balEl) balEl.innerText = '$' + STATE.agentBalance.toFixed(2);

  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);
  const kaminoEl = document.getElementById('kpi-kamino-locked');
  if (kaminoEl) kaminoEl.innerText = '$' + kaminoLocked.toFixed(2);

  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);
  const depEl = document.getElementById('kpi-deployable-funds');
  if (depEl) depEl.innerText = '$' + deployable.toFixed(2);

  // Scrubber Label Values
  const scPrice = document.getElementById('scrubber-price-text');
  const scChg = document.getElementById('scrubber-change-text');
  if (scPrice) scPrice.innerText = '$' + TOKEN_CONFIG.SOL.price.toFixed(2);
  if (scChg) {
    const c = TOKEN_CONFIG.SOL.change;
    scChg.innerText = '(' + (c >= 0 ? '+' : '') + c.toFixed(2) + '%)';
    scChg.className = 'scrubber-change ' + (c >= 0 ? 'text-green' : 'text-red');
  }

  // Token Matrix
  for (const [sym, data] of Object.entries(TOKEN_CONFIG)) {
    const low = sym.toLowerCase();
    const pEl = document.getElementById('m-price-' + low);
    const cEl = document.getElementById('m-change-' + low);
    const rEl = document.getElementById('m-rsi-' + low);
    const bEl = document.getElementById('m-badge-' + low);

    if (pEl) pEl.innerText = '$' + data.price.toFixed(data.price < 1 ? 4 : 2);
    if (cEl) {
      cEl.innerText = (data.change >= 0 ? '+' : '') + data.change.toFixed(2) + '%';
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

  updateTradeStatusBar();
  renderPositionsTable();
}

// Dynamic Interactive Status Bar
function updateTradeStatusBar() {
  const bar = document.getElementById('agent-trade-status-bar');
  const textEl = document.getElementById('trade-status-pill-text');
  const actionEl = document.getElementById('trade-status-pill-action');
  if (!bar || !textEl || !actionEl) return;

  const sol = TOKEN_CONFIG.SOL;
  const dipThreshold = (sol.baseline * 0.925).toFixed(2);
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  if (openPos) {
    const curPrice = sol.price;
    const pnlPct = ((curPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = (openPos.entryPrice * 0.94).toFixed(2);
    const trailingPrice = (openPos.peakPrice * 0.96).toFixed(2);
    const tpPrice = (openPos.entryPrice * 1.10).toFixed(2);

    bar.className = 'trade-status-bar status-open';
    textEl.innerHTML = '🟢 <b>ACTIVE TRADE:</b> Bought @ $' + openPos.entryPrice.toFixed(2) + 
      ' | PnL: <b class="' + (pnlPct >= 0 ? 'text-green' : 'text-red') + '">' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%</b>' +
      ' | 🛑 Stop: $' + hardStopPrice + ' (-6%) | 🟣 Trailing: $' + trailingPrice + ' (-4%) | 🟡 TP: $' + tpPrice + ' (+10%)';
    actionEl.innerHTML = 'Move slider down &lt; $' + hardStopPrice + ' to test Stop-Loss, or up &gt; $' + tpPrice + ' for Take-Profit';
  } else if (STATE.lastExitReason === 'STOP_LOSS') {
    bar.className = 'trade-status-bar status-stopped';
    textEl.innerHTML = '🛑 <b>HARD STOP-LOSS EXECUTED:</b> Risk capped at -6.0%. Capital re-vaulted to Kamino to prevent insolvency.';
    actionEl.innerHTML = 'Pull slider back above $' + dipThreshold + ' or click "↺ Reset Market" to re-arm';
  } else if (STATE.lastExitReason === 'TAKE_PROFIT') {
    bar.className = 'trade-status-bar status-profit';
    textEl.innerHTML = '🎉 <b>TAKE-PROFIT EXECUTED (+10.0%):</b> Sold at peak! Realized profit banked back to Kamino (8.42% APY).';
    actionEl.innerHTML = 'Pull slider back down or click "↺ Reset Market" to hunt next dip';
  } else if (STATE.lastExitReason === 'TRAILING_STOP') {
    bar.className = 'trade-status-bar status-open';
    textEl.innerHTML = '🛡️ <b>TRAILING STOP EXECUTED:</b> Pullback detected from high. Profit locked in!';
    actionEl.innerHTML = 'Reset market or trigger new dip';
  } else if (deployable <= 0) {
    if (sol.price <= dipThreshold) {
      bar.className = 'trade-status-bar status-safeguard';
      textEl.innerHTML = '🛡️ <b>SAFEGUARD ACTIVE:</b> Dip at $' + sol.price.toFixed(2) + ' detected, but deployable surplus is $0.00! ZERO TRADES EXECUTED.';
      actionEl.innerHTML = '👉 Click "+ Deposit $50 Demo USDC" to test autonomous dip strike';
    } else {
      bar.className = 'trade-status-bar status-scanning';
      textEl.innerHTML = '🔍 <b>SCANNER ACTIVE:</b> Monitoring SOL ($' + sol.price.toFixed(2) + '). Dip triggers if price drops below $' + dipThreshold + ' (-7.5%).';
      actionEl.innerHTML = 'Treasury Balance: $' + STATE.agentBalance.toFixed(2) + ' (Safe Mode)';
    }
  } else {
    bar.className = 'trade-status-bar status-scanning';
    textEl.innerHTML = '⚡ <b>ARMED FOR DIP:</b> Surplus $' + deployable.toFixed(2) + ' USDC ready. Waiting for SOL dip below $' + dipThreshold + ' (-7.5%).';
    actionEl.innerHTML = 'Drag slider left to crash price and trigger autonomous buy';
  }
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
    tr.innerHTML = 
      '<td><code class="text-blue">' + pos.id + '</code></td>' +
      '<td><strong class="text-white">' + pos.symbol + '</strong></td>' +
      '<td class="mono-num">$' + pos.entryPrice.toFixed(2) + '</td>' +
      '<td class="mono-num font-bold">$' + curPrice.toFixed(2) + '</td>' +
      '<td class="mono-num">$' + pos.costBasis.toFixed(2) + ' USDC</td>' +
      '<td class="mono-num ' + (pnlPct >= 0 ? 'text-green' : 'text-red') + ' font-bold">' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%</td>' +
      '<td class="mono-num ' + (pnlUsdc >= 0 ? 'text-green' : 'text-red') + '">' + (pnlUsdc >= 0 ? '+' : '') + '$' + pnlUsdc.toFixed(4) + '</td>' +
      '<td class="mono-num text-purple">$' + pos.peakPrice.toFixed(2) + '</td>' +
      '<td><span class="badge ' + (pos.status === 'OPEN' ? 'badge-mint' : (pos.action.includes('STOP') ? 'badge-yellow' : 'badge-purple')) + '">' + pos.status + '</span></td>' +
      '<td class="text-dim text-xs">' + pos.action + '</td>';
    tbody.appendChild(tr);
  }
}

// 6. Interactive Price Scrubber & Full Stop-Loss / Take-Profit Lifecycle
function handleManipulatedPrice(newPrice) {
  STATE.isSimulating = true;
  const baseline = TOKEN_CONFIG.SOL.baseline;
  const changePct = ((newPrice - baseline) / baseline) * 100;

  TOKEN_CONFIG.SOL.price = newPrice;
  TOKEN_CONFIG.SOL.change = changePct;
  TOKEN_CONFIG.SOL.rsi = Math.min(85, Math.max(18, 50 + (changePct * 2.2)));

  // Update chart data point
  STATE.chartData[STATE.chartData.length - 1] = newPrice;

  const isOversoldDip = changePct <= -7.5 || TOKEN_CONFIG.SOL.rsi <= 28;
  const deployable = Math.max(0, STATE.agentBalance - STATE.reserveFloor);

  // Reset dip cooldown if price recovers above -4%
  if (changePct > -4.0 && STATE.dipCooldown) {
    STATE.dipCooldown = false;
  }

  // SCENARIO 1: DIP DETECTED & NO POSITION OPEN
  const hasOpenPos = STATE.positions.some(p => p.status === 'OPEN');

  if (isOversoldDip && !hasOpenPos && !STATE.dipCooldown) {
    if (deployable <= 0) {
      addCognitionThought('GUARD SAFEGUARD', 'Dip at $' + newPrice.toFixed(2) + ' (' + changePct.toFixed(1) + '%). Treasury balance is $' + STATE.agentBalance.toFixed(2) + ' (no surplus above $30 Kamino reserve). ZERO TRADES EXECUTED. Capital 100% protected.', 'guard');
      showToast('🛡️ Capital Guard: 0 Trades executed (Operating reserve floor protected)');
    } else {
      // AUTONOMOUS STRIKE!
      const tradeAllocation = Math.min(deployable, 20.00);
      const amountBought = tradeAllocation / newPrice;
      const posId = 'pos_sol_' + Date.now().toString().slice(-4);

      // Deduct allocation from available cash
      STATE.agentBalance -= tradeAllocation;
      STATE.dipCooldown = true; // Lock cooldown for this dip wave to prevent multiple buys
      STATE.lastExitReason = null;

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
      addCognitionThought('AUTONOMOUS STRIKE', '💥 Flash Dip bought on Jupiter! Purchased ' + amountBought.toFixed(4) + ' SOL at $' + newPrice.toFixed(2) + ' using $' + tradeAllocation.toFixed(2) + ' surplus capital.', 'trade');
      showToast('⚡ AUTONOMOUS BUY: ' + amountBought.toFixed(4) + ' SOL @ $' + newPrice.toFixed(2) + ' ($' + tradeAllocation.toFixed(2) + ' USDC)');
    }
  }

  // SCENARIO 2: MANAGING ACTIVE POSITION (Hard Stop, Trailing Stop, Take Profit)
  const openPos = STATE.positions.find(p => p.status === 'OPEN');
  if (openPos) {
    // Track highest peak reached
    if (newPrice > openPos.peakPrice) {
      openPos.peakPrice = newPrice;
    }

    const pnlPct = ((newPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
    const hardStopPrice = openPos.entryPrice * 0.94; // -6.0% Hard Stop Loss
    const trailingStopPrice = openPos.peakPrice * 0.96; // -4.0% Pullback from Peak
    const takeProfitPrice = openPos.entryPrice * 1.10; // +10.0% Take Profit Target

    // TRIGGER 1: TAKE-PROFIT (+10.0% reached in upper range)
    if (newPrice >= takeProfitPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🎉 TAKE_PROFIT (+10.0%)';
      STATE.lastExitReason = 'TAKE_PROFIT';

      addCognitionThought('TAKE PROFIT', '🎉 Target crossed at $' + newPrice.toFixed(2) + ' (+10.0%)! Position closed. Realized +$' + realizedGain.toFixed(4) + ' USDC profit. Capital & gains re-vaulted to Kamino!', 'exit');
      showToast('🎉 TAKE-PROFIT TRIGGERED! Sold at $' + newPrice.toFixed(2) + ' (+10.0%). Profit: +$' + realizedGain.toFixed(4) + ' USDC!');

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // TRIGGER 2: HARD STOP-LOSS (-6.0% Drop below entry - Emergency Brake)
    else if (newPrice <= hardStopPrice) {
      const realizedLoss = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛑 HARD STOP (-6.0%)';
      STATE.lastExitReason = 'STOP_LOSS';

      addCognitionThought('HARD STOP-LOSS', '🛑 Drop hit $' + newPrice.toFixed(2) + ' (-6.0% below entry $' + openPos.entryPrice.toFixed(2) + '). Emergency stop executed! Loss capped at -6% to protect remaining capital.', 'guard');
      showToast('🛑 Hard Stop-Loss Hit at $' + newPrice.toFixed(2) + '! Loss capped at -6% to safeguard treasury.');

      STATE.agentBalance += (openPos.costBasis + realizedLoss);
    }
    // TRIGGER 3: DYNAMIC TRAILING STOP (-4.0% Drop from Peak after price has risen > 1%)
    else if (openPos.peakPrice > openPos.entryPrice * 1.015 && newPrice <= trailingStopPrice) {
      const realizedGain = (newPrice - openPos.entryPrice) * openPos.amount;
      openPos.status = 'CLOSED';
      openPos.action = '🛡️ TRAILING STOP (' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%)';
      STATE.lastExitReason = 'TRAILING_STOP';

      addCognitionThought('TRAILING STOP', '🛡️ Price reversed from peak $' + openPos.peakPrice.toFixed(2) + ' to $' + newPrice.toFixed(2) + ' (-4% pullback). Trailing stop locked in ' + (pnlPct >= 0 ? '+' : '') + realizedGain.toFixed(4) + ' USDC!', 'guard');
      showToast('🛡️ Trailing Stop Hit at $' + newPrice.toFixed(2) + '! Capital preserved with ' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '% gain.');

      STATE.agentBalance += (openPos.costBasis + realizedGain);
    }
    // STATUS UPDATE: STILL HOLDING
    else {
      openPos.action = 'HOLDING | PnL: ' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '% (Stop: $' + Math.max(hardStopPrice, trailingStopPrice).toFixed(1) + ' | TP: $' + takeProfitPrice.toFixed(1) + ')';
    }
  }

  updateUI();
  renderChart();
}

// Scrubber Slider Listener
const scrubber = document.getElementById('price-scrubber');
if (scrubber) {
  scrubber.addEventListener('input', (e) => {
    handleManipulatedPrice(parseFloat(e.target.value));
  });
}

// 7. Deposit Demo Funds Button (+ $50 USDC)
const btnDeposit = document.getElementById('btn-deposit-50');
if (btnDeposit) {
  btnDeposit.addEventListener('click', () => {
    STATE.agentBalance += 50.00;
    STATE.dipCooldown = false;
    addCognitionThought('CAPITAL INJECTION', 'Deposited $50.00 Demo USDC. Kamino Lending automatically locks $30.00 reserve (8.42% APY). Unlocked $20.00 for autonomous dip trading!', 'guard');
    showToast('💰 Deposited $50.00 USDC! $30 vaulted to Kamino, $20 ready for dips.');
    updateUI();
  });
}

// 8. Empty Wallet Button ($0 Safe Mode)
const btnEmpty = document.getElementById('btn-empty-wallet');
if (btnEmpty) {
  btnEmpty.addEventListener('click', () => {
    STATE.agentBalance = 0.00;
    STATE.positions = [];
    STATE.dipCooldown = false;
    STATE.lastExitReason = null;
    addCognitionThought('WALLET FLUSH', 'Emptied agent wallet to $0.00 USDC. Testing zero-capital protection mode.', 'guard');
    showToast('↺ Wallet reset to $0.00. Testing Safe Mode.');
    updateUI();
    renderChart();
  });
}

// 9. Quick Actions from Action Bar
const btnDip = document.getElementById('btn-trigger-dip');
if (btnDip) {
  btnDip.addEventListener('click', () => {
    STATE.dipCooldown = false;
    const crashPrice = TOKEN_CONFIG.SOL.baseline * 0.915; // -8.5%
    if (scrubber) scrubber.value = crashPrice.toFixed(1);
    handleManipulatedPrice(crashPrice);
  });
}

const btnRebound = document.getElementById('btn-trigger-rebound');
if (btnRebound) {
  btnRebound.addEventListener('click', () => {
    const openPos = STATE.positions.find(p => p.status === 'OPEN');
    const reboundPrice = openPos ? openPos.entryPrice * 1.105 : TOKEN_CONFIG.SOL.baseline * 1.105;
    if (scrubber) scrubber.value = reboundPrice.toFixed(1);
    handleManipulatedPrice(reboundPrice);
  });
}

const btnReset = document.getElementById('btn-reset-market');
if (btnReset) {
  btnReset.addEventListener('click', () => {
    STATE.isSimulating = false;
    STATE.dipCooldown = false;
    STATE.lastExitReason = null;
    TOKEN_CONFIG.SOL.price = TOKEN_CONFIG.SOL.baseline;
    TOKEN_CONFIG.SOL.change = 0.85;
    TOKEN_CONFIG.SOL.rsi = 48.2;
    STATE.positions = [];
    if (scrubber) scrubber.value = TOKEN_CONFIG.SOL.baseline.toFixed(1);
    addCognitionThought('SYNC', 'Market re-synchronized to baseline Solana price.', 'scanner');
    showToast('↺ Synced with Solana Mainnet-Beta');
    syncLivePrices();
  });
}

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

const btnConnect = document.getElementById('btn-connect-wallet');
if (btnConnect) {
  btnConnect.addEventListener('click', async () => {
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
}

const modalBtnPhantom = document.getElementById('modal-btn-phantom');
if (modalBtnPhantom) {
  modalBtnPhantom.addEventListener('click', async () => {
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
}

const modalBtnCreator = document.getElementById('modal-btn-creator');
if (modalBtnCreator) {
  modalBtnCreator.addEventListener('click', () => {
    handleWalletConnected('9BNq3m8VdURvMpwgW3zo9sd1UCgioqKB1mNBbVUq79CJ', 'Creator Verified Wallet');
    closeWalletModal();
  });
}

const customWalletSubmit = document.getElementById('custom-wallet-submit');
if (customWalletSubmit) {
  customWalletSubmit.addEventListener('click', () => {
    const val = document.getElementById('custom-wallet-input').value.trim();
    if (val && val.length >= 32 && val.length <= 44) {
      handleWalletConnected(val, 'Custom Public Key');
      closeWalletModal();
    } else {
      showToast('⚠️ Please enter a valid Solana Base58 address');
    }
  });
}

async function handleWalletConnected(address, source) {
  STATE.connectedWallet = address;
  const short = address.slice(0, 4) + '...' + address.slice(-4);
  const btnText = document.getElementById('wallet-btn-text');
  if (btnText) btnText.innerText = short;

  addCognitionThought('WALLET LINKED', 'Linked ' + source + ': ' + address + '. Assigned as Fleet Yield Beneficiary.', 'guard');
  showToast('⚡ Connected: ' + short + ' (' + source + ')');

  try {
    if (typeof solanaWeb3 !== 'undefined') {
      const connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const pubkey = new solanaWeb3.PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      const sol = (lamports / 1e9).toFixed(3);
      addCognitionThought('MAINNET BALANCE', 'Verified On-Chain Balance for ' + short + ': ' + sol + ' SOL.', 'guard');
      showToast('💰 On-Chain Balance: ' + sol + ' SOL');
    }
  } catch (err) {
    console.log('Balance query note:', err.message);
  }
}

// Harvest Yield Button
const btnHarvest = document.getElementById('btn-harvest-yield');
if (btnHarvest) {
  btnHarvest.addEventListener('click', () => {
    const harvested = STATE.earnedYield;
    STATE.earnedYield = 0.000005;
    addCognitionThought('HARVEST', 'Harvested $' + harvested.toFixed(6) + ' USDC lending yield from Kamino. Reinvested into treasury.', 'guard');
    showToast('🌾 Harvested +$' + harvested.toFixed(6) + ' USDC from Kamino Vault');
  });
}

// Live Solana DEX Price Sync (DEXScreener API)
async function syncLivePrices() {
  if (STATE.isSimulating) return;
  try {
    const mints = Object.values(TOKEN_CONFIG).map(t => t.mint).join(',');
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + mints);
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
      const syncEl = document.getElementById('sync-time-label');
      if (syncEl) syncEl.innerText = 'Synced ' + new Date().toLocaleTimeString();
    }
  } catch (err) {
    console.warn('Price sync fallback:', err);
  }

  if (!STATE.isSimulating) {
    STATE.chartData.shift();
    STATE.chartData.push(TOKEN_CONFIG.SOL.price);
  }
  updateUI();
  renderChart();
}

// Continuous Yield Ticker
setInterval(() => {
  const secondsElapsed = 1;
  const secondsPerYear = 365.25 * 24 * 3600;
  const kaminoLocked = Math.min(STATE.agentBalance, STATE.reserveFloor);
  if (kaminoLocked > 0) {
    const inc = kaminoLocked * (STATE.kaminoApy * (secondsElapsed / secondsPerYear));
    STATE.earnedYield += inc;
    const el = document.getElementById('kpi-yield-ticker');
    if (el) el.innerText = '+$' + STATE.earnedYield.toFixed(6) + ' USDC';
  }
}, 1000);

// Initialize on DOM Ready
window.addEventListener('resize', () => {
  resizeCanvas();
  renderChart();
});

window.addEventListener('DOMContentLoaded', () => {
  chartCanvas = document.getElementById('live-sol-chart');
  if (chartCanvas) {
    resizeCanvas();
  }

  initChartData();
  renderChart();
  updateUI();

  addCognitionThought('BOOT', 'Solana Agent Treasury Terminal initialized.', 'guard');
  addCognitionThought('SAFEGUARD', 'Initial state: Treasury balance $0.00. Safe mode active.', 'guard');
  addCognitionThought('TIP', '👉 Use the Price Slider above to simulate market crashes, or click "+ Deposit $50" to fund the agent.', 'scanner');

  syncLivePrices();
  setInterval(syncLivePrices, 15000);
});
