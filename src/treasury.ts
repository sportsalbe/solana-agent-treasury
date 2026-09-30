import { KaminoVaultGuard } from './kamino/vault-guard.js';
import { JupiterDipTrader, DEFAULT_PUBLIC_CONFIG } from './jupiter/dip-trader.js';
import { TreasuryConfig, KaminoReserveStatus, DipPosition, DipTradeSignal } from './types.js';

export class SolanaAgentTreasury {
  public readonly kamino: KaminoVaultGuard;
  public readonly jupiter: JupiterDipTrader;
  public readonly config: TreasuryConfig;

  constructor(customConfig?: Partial<TreasuryConfig>) {
    this.config = { ...DEFAULT_PUBLIC_CONFIG, ...customConfig };
    this.kamino = new KaminoVaultGuard(this.config.reserveFloorUsdc);
    this.jupiter = new JupiterDipTrader(this.config);
  }

  public getReserveStatus(): KaminoReserveStatus {
    return this.kamino.getStatus();
  }

  public depositReserve(amount: number): KaminoReserveStatus {
    return this.kamino.deposit(amount);
  }

  public harvestYield(): number {
    return this.kamino.harvestYield();
  }

  public evaluateDip(
    symbol: string,
    mint: string,
    currentPrice: number,
    rsi: number,
    change24h: number,
    currentWalletUsdc: number
  ): DipTradeSignal {
    return this.jupiter.evaluateSignal(symbol, mint, currentPrice, rsi, change24h, currentWalletUsdc);
  }

  public executeDipTrade(signal: DipTradeSignal): DipPosition {
    return this.jupiter.openPosition(signal);
  }

  public monitorPositions(priceFeed: Record<string, number>): Array<{ positionId: string; evaluation: any }> {
    const openPositions = this.jupiter.getOpenPositions();
    const results = [];

    for (const pos of openPositions) {
      const price = priceFeed[pos.symbol];
      if (price) {
        const evalResult = this.jupiter.evaluatePosition(pos.id, price);
        if (evalResult.shouldSell) {
          this.jupiter.closePosition(pos.id, price, evalResult.reason);
        }
        results.push({ positionId: pos.id, evaluation: evalResult });
      }
    }

    return results;
  }
}
