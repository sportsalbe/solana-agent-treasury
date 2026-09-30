export const SOLANA_TREASURY_TOOLS = [
  {
    name: "treasury_kamino_status",
    description: "Get current Kamino Lending yield reserve status, APY, and accumulated interest.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "treasury_deposit_reserve",
    description: "Deposit USDC into Kamino Lending pool to earn automated DeFi yield on idle operating capital.",
    parameters: {
      type: "object",
      properties: {
        amountUsdc: { type: "number", description: "Amount of USDC to deposit" }
      },
      required: ["amountUsdc"]
    },
  },
  {
    name: "treasury_check_jupiter_dips",
    description: "Scan whitelisted tokens for oversold dip buying opportunities with Capital Guard protection.",
    parameters: {
      type: "object",
      properties: {
        tokens: {
          type: "array",
          items: { type: "string" },
          description: "List of token symbols to scan (e.g. ['SOL', 'JUP', 'JTO'])"
        }
      },
      required: ["tokens"]
    },
  },
  {
    name: "treasury_evaluate_positions",
    description: "Evaluate all active spot positions for Take Profit, Trailing Stop-Loss, or Hard Stop-Loss.",
    parameters: {
      type: "object",
      properties: {},
    },
  }
];
