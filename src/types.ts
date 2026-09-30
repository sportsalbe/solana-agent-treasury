export interface KaminoReserveStatus {
  depositedUsdc: number;
  currentApy: number;
  earnedYieldUsdc: number;
  lastAccruedAt: number;
  isStakedInYield: boolean;
  marketAddress?: string;
}

export interface DipTradeSignal {
  symbol: string;
  mint: string;
  currentPrice: number;
  rsi: number;
  change24h: number;
  shouldBuy: boolean;
  reason: string;
  recommendedUsdcSize: number;
}

export interface DipPosition {
  id: string;
  symbol: string;
  mint: string;
  entryPrice: number;
  amount: number;
  costBasisUsdc: number;
  peakPrice: number;
  openedAt: number;
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
  closeReason?: string;
  realizedPnlUsdc?: number;
}

export interface PositionEvaluationResult {
  action: 'HOLD' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 'HARD_STOP';
  currentPrice: number;
  pnlPercentage: number;
  pnlUsdc: number;
  shouldSell: boolean;
  reason: string;
}

export interface TreasuryConfig {
  reserveFloorUsdc: number;
  dipRsiThreshold: number;
  dipDropThreshold: number;
  takeProfitRatio: number;
  trailingStopLossRatio: number;
  hardStopLossRatio: number;
  maxDipTradeAllocationUsdc: number;
  whitelistedTokens: string[];
}
