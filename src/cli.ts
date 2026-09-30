import { SolanaAgentTreasury } from './treasury.js';

async function runDemo() {
  console.log('\n======================================================');
  console.log('⚡ SOLANA AGENT TREASURY - AUTONOMOUS YIELD & DIP GUARD');
  console.log('======================================================\n');

  const treasury = new SolanaAgentTreasury({
    reserveFloorUsdc: 30.00,
  });

  console.log('1. [Kamino Vault] Initializing $30 Safety Reserve...');
  const status = treasury.getReserveStatus();
  console.log(`   - Reserve Floor Protected: $${status.depositedUsdc.toFixed(2)} USDC`);
  console.log(`   - Kamino Lending APY: ${status.currentApy}%`);
  console.log(`   - Yield Earning Active: ${status.isStakedInYield}\n`);

  console.log('2. [Capital Guard] Simulating Agent Wallet with $42.00 Total USDC...');
  const totalWalletUsdc = 42.00;
  const deployable = totalWalletUsdc - treasury.config.reserveFloorUsdc;
  console.log(`   - Total Capital: $${totalWalletUsdc.toFixed(2)} USDC`);
  console.log(`   - Protected Reserve: $${treasury.config.reserveFloorUsdc.toFixed(2)} USDC (Untouchable)`);
  console.log(`   - Deployable Dip Capital: $${deployable.toFixed(2)} USDC\n`);

  console.log('3. [Market Dip Scanner] Scanning Solana Ecosystem Dips...');
  const solDipSignal = treasury.evaluateDip(
    'SOL',
    'So11111111111111111111111111111111111111112',
    138.50, // Price
    26.4,   // RSI (Oversold < 28)
    -0.082, // -8.2% drop in 24h
    totalWalletUsdc
  );

  console.log(`   - Token: ${solDipSignal.symbol} at $${solDipSignal.currentPrice}`);
  console.log(`   - Signal Triggered: ${solDipSignal.shouldBuy ? 'YES (BUY DIP)' : 'NO'}`);
  console.log(`   - Reason: ${solDipSignal.reason}`);
  console.log(`   - Allocated Size: $${solDipSignal.recommendedUsdcSize.toFixed(2)} USDC\n`);

  console.log('4. [Jupiter Swap Engine] Executing Spot Dip Entry...');
  const position = treasury.executeDipTrade(solDipSignal);
  console.log(`   - Position ID: ${position.id}`);
  console.log(`   - Bought: ${position.amount.toFixed(4)} SOL at $${position.entryPrice.toFixed(2)}`);
  console.log(`   - Cost Basis: $${position.costBasisUsdc.toFixed(2)} USDC\n`);

  console.log('5. [Automated Exit Engine] Simulating Market Rebound to $153.00 (+10.47%)...');
  const monitorResults = treasury.monitorPositions({
    SOL: 153.00,
  });

  for (const res of monitorResults) {
    console.log(`   - Action: ${res.evaluation.action}`);
    console.log(`   - Realized Gain: +${res.evaluation.pnlPercentage}% (+$${res.evaluation.pnlUsdc} USDC)`);
    console.log(`   - Reason: ${res.evaluation.reason}`);
  }

  console.log('\n======================================================');
  console.log('✅ DEMO COMPLETED: Treasury Protected & Yield Accruing');
  console.log('======================================================\n');
}

runDemo().catch(console.error);
