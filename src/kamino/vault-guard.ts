import { KaminoReserveStatus } from '../types.js';

export class KaminoVaultGuard {
  private depositedAmount: number;
  private currentApy: number;
  private earnedYield: number;
  private lastAccrualTimestamp: number;
  private marketAddress: string;

  constructor(
    initialDeposit: number = 30.0,
    initialApy: number = 0.0842,
    marketAddress: string = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF'
  ) {
    this.depositedAmount = initialDeposit;
    this.currentApy = initialApy;
    this.earnedYield = 0.0;
    this.lastAccrualTimestamp = Date.now();
    this.marketAddress = marketAddress;
  }

  public accrueYield(): number {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastAccrualTimestamp) / 1000;
    if (elapsedSeconds <= 0 || this.depositedAmount <= 0) {
      return this.earnedYield;
    }

    const secondsPerYear = 365.25 * 24 * 3600;
    const periodYield = this.depositedAmount * (this.currentApy * (elapsedSeconds / secondsPerYear));
    this.earnedYield += periodYield;
    this.lastAccrualTimestamp = now;
    return this.earnedYield;
  }

  public getStatus(): KaminoReserveStatus {
    this.accrueYield();
    return {
      depositedUsdc: Number(this.depositedAmount.toFixed(4)),
      currentApy: Number((this.currentApy * 100).toFixed(2)),
      earnedYieldUsdc: Number(this.earnedYield.toFixed(6)),
      lastAccruedAt: this.lastAccrualTimestamp,
      isStakedInYield: this.depositedAmount > 0,
      marketAddress: this.marketAddress,
    };
  }

  public deposit(amount: number): KaminoReserveStatus {
    if (amount <= 0) throw new Error('Deposit amount must be greater than zero');
    this.accrueYield();
    this.depositedAmount += amount;
    return this.getStatus();
  }

  public withdraw(amount: number): { withdrawnUsdc: number; remainingReserve: number } {
    this.accrueYield();
    if (amount > this.depositedAmount) {
      throw new Error(`Insufficient Kamino reserve balance. Requested: ${amount}, Available: ${this.depositedAmount}`);
    }
    this.depositedAmount -= amount;
    return {
      withdrawnUsdc: amount,
      remainingReserve: this.depositedAmount,
    };
  }

  public harvestYield(): number {
    this.accrueYield();
    const harvested = this.earnedYield;
    this.earnedYield = 0.0;
    return harvested;
  }
}
