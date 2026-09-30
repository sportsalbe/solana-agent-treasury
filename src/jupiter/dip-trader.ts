import { DipTradeSignal, DipPosition, PositionEvaluationResult, TreasuryConfig } from '../types.js';

export const DEFAULT_PUBLIC_CONFIG: TreasuryConfig = {
  reserveFloorUsdc: 30.00,
  dipRsiThreshold: 28,             // Public default: deeper dip requirement
  dipDropThreshold: 0.075,          // Public default: 7.5% drop required
  takeProfitRatio: 0.10,           // Public default: +10% target
  trailingStopLossRatio: 0.04,     // Public default: 4% trailing drawdown
  hardStopLossRatio: 0.06,         // Public default: 6% hard stop
  maxDipTradeAllocationUsdc: 15.00,
  whitelistedTokens: ['SOL', 'JUP', 'JTO', 'PYTH', 'DRIFT'],
};

export class JupiterDipTrader {
  private config: TreasuryConfig;
  private positions: Map<string, DipPosition> = new Map();

  constructor(customConfig?: Partial<TreasuryConfig>) {
    this.config = { ...DEFAULT_PUBLIC_CONFIG, ...customConfig };
  }

  public evaluateSignal(
    symbol: string,
    mint: string,
    currentPrice: number,
    rsi: number,
    change24h: number,
    availableLiquidityUsdc: number
  ): DipTradeSignal {
    if (!this.config.whitelistedTokens.includes(symbol.toUpperCase())) {
      return {
        symbol,
        mint,
        currentPrice,
        rsi,
        change24h,
        shouldBuy: false,
        reason: `Token ${symbol} is not whitelisted in Treasury policy`,
        recommendedUsdcSize: 0,
      };
    }

    const deployableCapital = Math.max(0, availableLiquidityUsdc - this.config.reserveFloorUsdc);
    if (deployableCapital < 1.0) {
      return {
        symbol,
        mint,
        currentPrice,
        rsi,
        change24h,
        shouldBuy: false,
        reason: `Capital Guard: Balance ($${availableLiquidityUsdc.toFixed(2)}) is at or below $${this.config.reserveFloorUsdc.toFixed(2)} safety reserve floor`,
        recommendedUsdcSize: 0,
      };
    }

    const isRsiDip = rsi <= this.config.dipRsiThreshold;
    const isPriceDrop = change24h <= -this.config.dipDropThreshold;

    if (isRsiDip || isPriceDrop) {
      const tradeSize = Math.min(deployableCapital, this.config.maxDipTradeAllocationUsdc);
      return {
        symbol,
        mint,
        currentPrice,
        rsi,
        change24h,
        shouldBuy: true,
        reason: `Dip confirmed: RSI=${rsi.toFixed(1)} (thresh: ${this.config.dipRsiThreshold}), 24h=${(change24h * 100).toFixed(2)}%`,
        recommendedUsdcSize: Number(tradeSize.toFixed(2)),
      };
    }

    return {
      symbol,
      mint,
      currentPrice,
      rsi,
      change24h,
      shouldBuy: false,
      reason: `No dip detected: RSI=${rsi.toFixed(1)}, 24h=${(change24h * 100).toFixed(2)}%`,
      recommendedUsdcSize: 0,
    };
  }

  public openPosition(signal: DipTradeSignal): DipPosition {
    if (!signal.shouldBuy || signal.recommendedUsdcSize <= 0) {
      throw new Error('Cannot open position: Signal does not meet buy criteria');
    }

    const tokenAmount = signal.recommendedUsdcSize / signal.currentPrice;
    const positionId = `pos_${signal.symbol.toLowerCase()}_${Date.now()}`;

    const position: DipPosition = {
      id: positionId,
      symbol: signal.symbol,
      mint: signal.mint,
      entryPrice: signal.currentPrice,
      amount: tokenAmount,
      costBasisUsdc: signal.recommendedUsdcSize,
      peakPrice: signal.currentPrice,
      openedAt: Date.now(),
      status: 'OPEN',
    };

    this.positions.set(positionId, position);
    return position;
  }

  public evaluatePosition(positionId: string, currentPrice: number): PositionEvaluationResult {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status !== 'OPEN') {
      throw new Error(`Position ${positionId} not found or already closed`);
    }

    if (currentPrice > pos.peakPrice) {
      pos.peakPrice = currentPrice;
    }

    const pnlPercentage = (currentPrice - pos.entryPrice) / pos.entryPrice;
    const pnlUsdc = (currentPrice - pos.entryPrice) * pos.amount;

    // 1. Take Profit
    if (pnlPercentage >= this.config.takeProfitRatio) {
      return {
        action: 'TAKE_PROFIT',
        currentPrice,
        pnlPercentage: Number((pnlPercentage * 100).toFixed(2)),
        pnlUsdc: Number(pnlUsdc.toFixed(4)),
        shouldSell: true,
        reason: `Take profit reached: +${(pnlPercentage * 100).toFixed(2)}% >= +${(this.config.takeProfitRatio * 100)}%`,
      };
    }

    // 2. Trailing Stop Loss from Peak
    const drawdownFromPeak = (pos.peakPrice - currentPrice) / pos.peakPrice;
    if (pos.peakPrice > pos.entryPrice && drawdownFromPeak >= this.config.trailingStopLossRatio) {
      return {
        action: 'TRAILING_STOP',
        currentPrice,
        pnlPercentage: Number((pnlPercentage * 100).toFixed(2)),
        pnlUsdc: Number(pnlUsdc.toFixed(4)),
        shouldSell: true,
        reason: `Trailing stop hit: Drawdown -${(drawdownFromPeak * 100).toFixed(2)}% from peak $${pos.peakPrice.toFixed(2)}`,
      };
    }

    // 3. Hard Stop Loss
    if (pnlPercentage <= -this.config.hardStopLossRatio) {
      return {
        action: 'HARD_STOP',
        currentPrice,
        pnlPercentage: Number((pnlPercentage * 100).toFixed(2)),
        pnlUsdc: Number(pnlUsdc.toFixed(4)),
        shouldSell: true,
        reason: `Hard stop loss triggered: -${Math.abs(pnlPercentage * 100).toFixed(2)}% <= -${(this.config.hardStopLossRatio * 100)}%`,
      };
    }

    return {
      action: 'HOLD',
      currentPrice,
      pnlPercentage: Number((pnlPercentage * 100).toFixed(2)),
      pnlUsdc: Number(pnlUsdc.toFixed(4)),
      shouldSell: false,
      reason: `Holding position. Current PnL: ${(pnlPercentage * 100).toFixed(2)}%`,
    };
  }

  public closePosition(positionId: string, closePrice: number, reason: string): DipPosition {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status !== 'OPEN') {
      throw new Error(`Position ${positionId} not found or already closed`);
    }

    const pnlUsdc = (closePrice - pos.entryPrice) * pos.amount;
    pos.status = 'CLOSED';
    pos.closePrice = closePrice;
    pos.closeReason = reason;
    pos.realizedPnlUsdc = Number(pnlUsdc.toFixed(4));

    return pos;
  }

  public getOpenPositions(): DipPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'OPEN');
  }
}
