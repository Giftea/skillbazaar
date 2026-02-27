/**
 * Skill Server 1 — Contract Auditor
 *
 * GET /audit/:address
 * Fetches on-chain data from Base mainnet and returns a risk assessment.
 * Protected by x402 micropayment ($0.05 USDC) via pinion-os/server.
 */

import "dotenv/config";
import { createSkillServer, skill } from "pinion-os/server";
import type { ContractAuditResult } from "../shared/types.js";
import { Request, Response } from "express";

const BASE_RPC = "https://mainnet.base.org";
const PAY_TO = process.env.ADDRESS ?? "";

if (!PAY_TO) {
  console.error("[contract-auditor] ERROR: ADDRESS env var is required");
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

function hexToEth(hex: string): string {
  return (parseInt(hex, 16) / 1e18).toFixed(6);
}

// Audit logic
async function auditAddress(address: string): Promise<ContractAuditResult> {
  const [balanceHex, txCountHex, bytecode] = await Promise.all([
    rpc<string>("eth_getBalance", [address, "latest"]),
    rpc<string>("eth_getTransactionCount", [address, "latest"]),
    rpc<string>("eth_getCode", [address, "latest"]),
  ]);

  const eth_balance = hexToEth(balanceHex);
  const tx_count = parseInt(txCountHex, 16);
  const is_contract = bytecode !== "0x" && bytecode.length > 2;

  const risk_signals: string[] = [];

  if (!is_contract) {
    risk_signals.push("address is an externally owned account (EOA), not a contract");
  } else {
    const byteLen = (bytecode.length - 2) / 2; // hex chars → bytes
    if (byteLen < 100) {
      risk_signals.push(`very small bytecode (${byteLen} bytes) — may be a proxy or minimal contract`);
    }
  }

  if (tx_count === 0) {
    risk_signals.push("no transactions found on this address");
  } else if (tx_count < 5 && is_contract) {
    risk_signals.push(`recently deployed contract with only ${tx_count} transaction(s)`);
  }

  if (parseFloat(eth_balance) === 0 && is_contract) {
    risk_signals.push("contract holds no ETH");
  }

  if (tx_count > 50_000) {
    risk_signals.push("extremely high transaction volume — likely a high-traffic token or DEX contract");
  }

  const score: ContractAuditResult["score"] =
    !is_contract || tx_count < 5
      ? "high"
      : tx_count < 50
      ? "medium"
      : "low";

  return {
    address,
    is_contract,
    eth_balance,
    tx_count,
    risk_signals,
    score,
    analyzed_at: new Date().toISOString(),
  };
}

// Skill server
const server = createSkillServer({ payTo: PAY_TO, network: "base", cors: true });

server.add(
  skill("audit", {
    description: "Audit a smart contract address for on-chain risk signals",
    endpoint: "/audit/:address",
    method: "GET",
    price: "$0.05",
    handler: async (req: Request, res: Response) => {
      const address = (req.params.address ?? "").trim().toLowerCase();

      if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        res.status(400).json({ error: "Invalid address format", expected: "0x + 40 hex chars" });
        return;
      }

      try {
        const result = await auditAddress(address);
        res.json(result);
      } catch {
        res.status(503).json({ error: "RPC unavailable", fallback: true, message: "Could not reach Base network" });
      }
    },
  })
);

server.listen(4001);
console.log("Contract Auditor skill running on port 4001");
process.on('unhandledRejection', (err) => console.error('[contract-auditor] Unhandled:', err));
process.on('SIGTERM', () => { console.log('[contract-auditor] Shutting down...'); process.exit(0); });
process.on('SIGINT',  () => { console.log('[contract-auditor] Shutting down...'); process.exit(0); });
