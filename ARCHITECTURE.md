# System Architecture & Technical Specifications

## 1. Capital Preservation Model (Capital Guard)
The central invariant of `solana-agent-treasury` is the **Reserve Floor**.

$$\text{Deployable Capital} = \max(0, \text{Current Wallet USDC} - \text{ReserveFloorUsdc})$$

No spot trade, fee deduction, or speculative deployment may access funds below `ReserveFloorUsdc`.

## 2. Yield Strategy (Kamino Lending)
Operating funds locked within the safety reserve are deposited into Kamino Lending reserves. Yield accrues continuously:

$$\Delta Y = \text{Deposited} \times \text{APY} \times \frac{\Delta t}{\text{SecondsPerYear}}$$

## 3. Dip Detection Algorithm
Signals trigger when either condition is met:
1. $\text{RSI}_{14} \le \text{Threshold}_{\text{RSI}}$
2. $\Delta P_{24\text{h}} \le -\text{Threshold}_{\text{Drop}}$

## 4. Exit Engine (Trailing Stops & Disciplined Take-Profits)
- **Take-Profit:** $\text{PnL} \ge +10.0\%$
- **Trailing Stop:** $\frac{\text{PeakPrice} - \text{CurrentPrice}}{\text{PeakPrice}} \ge 4.0\%$
- **Hard Stop:** $\text{PnL} \le -6.0\%$
