/**
 * Skill Server 2 — Wallet Scorer
 *
 * GET /score/:address
 * Fetches ETH balance, USDC balance, and tx count from Base mainnet.
 * Protected by x402 micropayment ($0.03 USDC) via pinion-os/server.
 */

import "dotenv/config";
import { createSkillServer, skill } from "pinion-os/server";
import type { WalletScoreResult } from "../shared/types.js";
import { Request, Response } from "express";

const BASE_RPC = "https://mainnet.base.org";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAY_TO = process.env.ADDRESS ?? "";

if (!PAY_TO) {
  console.error("[wallet-scorer] ERROR: ADDRESS env var is required");
  process.exit(1);
}

// Base RPC helper
async function rpc<T = string>(method: string, params: unknown[]): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timeout));
  const json = (await res.json()) as { result: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

// Encode balanceOf(address) calldata
function encodeBalanceOf(address: string): string {
  const selector = "70a08231"; // keccak256("balanceOf(address)")[0:4]
  const paddedAddress = address.slice(2).toLowerCase().padStart(64, "0");
  return `0x${selector}${paddedAddress}`;
}

// Scoring logic
async function scoreWallet(address: string): Promise<WalletScoreResult> {
  const [balanceHex, txCountHex, usdcHex] = await Promise.all([
    rpc<string>("eth_getBalance", [address, "latest"]),
    rpc<string>("eth_getTransactionCount", [address, "latest"]),
    rpc<string>("eth_call", [
      { to: USDC_ADDRESS, data: encodeBalanceOf(address) },
      "latest",
    ]),
  ]);

  const eth_balance_num = parseInt(balanceHex, 16) / 1e18;
  const usdc_balance_num = parseInt(usdcHex, 16) / 1e6; // USDC has 6 decimals
  const tx_count = parseInt(txCountHex, 16);

  const eth_balance = eth_balance_num.toFixed(6);
  const usdc_balance = usdc_balance_num.toFixed(2);

  const wallet_age_estimate: WalletScoreResult["wallet_age_estimate"] =
    tx_count > 100 ? "veteran" : tx_count >= 10 ? "established" : "new";

  // Score 0–100
  const tx_score = Math.min((tx_count / 200) * 40, 40);           // up to 40
  const eth_score = Math.min((eth_balance_num / 1) * 20, 20);     // up to 20
  const usdc_score = Math.min((usdc_balance_num / 1000) * 20, 20); // up to 20
  const age_bonus = tx_count > 100 ? 20 : tx_count > 10 ? 10 : 0; // 0, 10, or 20
  const score = Math.round(Math.min(tx_score + eth_score + usdc_score + age_bonus, 100));

  return {
    address,
    eth_balance,
    usdc_balance,
    tx_count,
    wallet_age_estimate,
    score,
    scored_at: new Date().toISOString(),
  };
}

// Skill server
const server = createSkillServer({ payTo: PAY_TO, network: "base", cors: true });

server.add(
  skill("score", {
    description: "Score a wallet address based on ETH/USDC balance and transaction history",
    endpoint: "/score/:address",
    method: "GET",
    price: "$0.03",
    handler: async (req: Request, res: Response) => {
      const address = (req.params.address ?? "").trim().toLowerCase();

      if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        res.status(400).json({ error: "Invalid address format", expected: "0x + 40 hex chars" });
        return;
      }

      try {
        const result = await scoreWallet(address);
        res.json(result);
      } catch {
        res.status(503).json({ error: "RPC unavailable", fallback: true, message: "Could not reach Base network" });
      }
    },
  })
);

server.listen(4002);
console.log("Wallet Scorer skill running on port 4002");
process.on('unhandledRejection', (err) => console.error('[wallet-scorer] Unhandled:', err));
