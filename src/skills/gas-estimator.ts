/**
 * Skill Server 3 — Gas Estimator
 *
 * GET /gas
 * Fetches current gas price from Base mainnet and returns USD cost estimates.
 * Protected by x402 micropayment ($0.02 USDC) via pinion-os/server.
 */

import "dotenv/config";
import { createSkillServer, skill } from "pinion-os/server";
import type { GasEstimateResult } from "../shared/types.js";
import { Request, Response } from "express";

const BASE_RPC = "https://mainnet.base.org";
const ETH_PRICE_USD = 3200;

const PAY_TO = process.env.ADDRESS ?? "";

if (!PAY_TO) {
  console.error("[gas-estimator] ERROR: ADDRESS env var is required");
  process.exit(1);
}

// Gas units for common transaction types
const GAS_UNITS = {
  token_transfer: 21_000,
  contract_call: 100_000,
  nft_mint: 150_000,
} as const;

// Gas estimation logic
async function fetchGasEstimate(): Promise<GasEstimateResult> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timeout));

  const json = (await res.json()) as { result: string; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);

  const gasPriceWei = parseInt(json.result, 16);
  const gas_price_gwei = gasPriceWei / 1e9;

  // USD cost = gas_price_gwei * gas_units * ETH_PRICE_USD / 1e9
  const usdCost = (gasUnits: number): string => {
    const cost = (gas_price_gwei * gasUnits * ETH_PRICE_USD) / 1e9;
    return `$${cost.toFixed(6)}`;
  };

  return {
    gas_price_gwei,
    estimates: {
      token_transfer: usdCost(GAS_UNITS.token_transfer),
      contract_call: usdCost(GAS_UNITS.contract_call),
      nft_mint: usdCost(GAS_UNITS.nft_mint),
    },
    network: "base",
    fetched_at: new Date().toISOString(),
  };
}

// Skill server
const server = createSkillServer({ payTo: PAY_TO, network: "base", cors: true });

server.add(
  skill("gas", {
    description: "Get current Base network gas price and USD cost estimates for common transactions",
    endpoint: "/gas",
    method: "GET",
    price: "$0.02",
    handler: async (_req: Request, res: Response) => {
      try {
        const result = await fetchGasEstimate();
        res.json(result);
      } catch {
        res.status(503).json({ error: "RPC unavailable", fallback: true, message: "Could not reach Base network" });
      }
    },
  })
);

server.listen(4003);
console.log("Gas Estimator skill running on port 4003");
process.on('unhandledRejection', (err) => console.error('[gas-estimator] Unhandled:', err));
