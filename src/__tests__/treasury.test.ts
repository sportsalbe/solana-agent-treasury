import test from 'node:test';
import assert from 'node:assert';
import { KaminoVaultGuard } from '../kamino/vault-guard.js';
import { JupiterDipTrader } from '../jupiter/dip-trader.js';
import { SolanaAgentTreasury } from '../treasury.js';

test('KaminoVaultGuard enforces deposits and calculates yield', () => {
  const guard = new KaminoVaultGuard(30.0, 0.10);
  const status = guard.getStatus();
  assert.strictEqual(status.depositedUsdc, 30.0);
  assert.strictEqual(status.isStakedInYield, true);
  assert.strictEqual(status.currentApy, 10.0);
});

test('JupiterDipTrader respects Capital Guard floor', () => {
  const trader = new JupiterDipTrader({ reserveFloorUsdc: 30.0 });
  const signal = trader.evaluateSignal(
    'SOL',
    'mint123',
    140,
    20,
    -0.10,
    28.00 // Below 30 floor
  );
  assert.strictEqual(signal.shouldBuy, false);
  assert.ok(signal.reason.includes('Capital Guard'));
});

test('JupiterDipTrader executes take profit at public threshold (+10%)', () => {
  const trader = new JupiterDipTrader({ reserveFloorUsdc: 30.0, takeProfitRatio: 0.10 });
  const signal = trader.evaluateSignal('SOL', 'mint123', 100, 25, -0.09, 45);
  const pos = trader.openPosition(signal);

  const evalHold = trader.evaluatePosition(pos.id, 105);
  assert.strictEqual(evalHold.action, 'HOLD');
  assert.strictEqual(evalHold.shouldSell, false);

  const evalTakeProfit = trader.evaluatePosition(pos.id, 111);
  assert.strictEqual(evalTakeProfit.action, 'TAKE_PROFIT');
  assert.strictEqual(evalTakeProfit.shouldSell, true);
});

test('SolanaAgentTreasury end-to-end integration works', () => {
  const treasury = new SolanaAgentTreasury();
  assert.ok(treasury.kamino);
  assert.ok(treasury.jupiter);
  const status = treasury.getReserveStatus();
  assert.strictEqual(status.depositedUsdc, 30.0);
});
