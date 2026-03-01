/**
 * Skill Server 4 — ENS Resolver
 *
 * GET /resolve/:ensOrAddress
 * Forward: ENS name (.eth) → resolved address + ETH balance on Ethereum mainnet
 * Reverse: 0x address → ENS name (if registered) + ETH balance
 * Protected by x402 micropayment ($0.02 USDC) via pinion-os/server.
 */

import "dotenv/config";
import { createSkillServer, skill } from "pinion-os/server";
import { keccak_256 } from "@noble/hashes/sha3";
import { Request, Response } from "express";

const MAINNET_RPC = "https://ethereum.publicnode.com";
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const PAY_TO = process.env.ADDRESS ?? "";

if (!PAY_TO) {
  console.error("[ens-resolver] ERROR: ADDRESS env var is required");
  process.exit(1);
}

// JSON-RPC helpers

async function jsonRpc<T = string>(method: string, params: unknown[]): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  const res = await fetch(MAINNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timeout));
  const json = (await res.json()) as { result: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC: ${json.error.message}`);
  return json.result;
}

async function ethCallStr(to: string, data: string): Promise<string> {
  return jsonRpc<string>("eth_call", [{ to, data }, "latest"]);
}

// ENS namehash (EIP-137) 

function namehash(name: string): Uint8Array {
  let node = new Uint8Array(32); // 32 zero bytes = empty label
  if (name === "") return node;
  const labels = name.split(".");
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = keccak_256(new TextEncoder().encode(labels[i]));
    const combined = new Uint8Array(64);
    combined.set(node, 0);
    combined.set(labelHash, 32);
    node = keccak_256(combined);
  }
  return node;
}

//  ABI encoding/decoding
function encodeNodeCall(selector: string, node: Uint8Array): string {
  const nodeHex = Array.from(node)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .padStart(64, "0");
  return `0x${selector}${nodeHex}`;
}

// ABI-decode a dynamic string (offset, length, bytes)
function decodeAbiString(hexResult: string): string {
  const data = hexResult.startsWith("0x") ? hexResult.slice(2) : hexResult;
  if (data.length < 128) return "";
  const length = parseInt(data.slice(64, 128), 16);
  if (length === 0) return "";
  const strHex = data.slice(128, 128 + length * 2);
  return Buffer.from(strHex, "hex").toString("utf-8");
}

// ENS Registry: resolver(bytes32 node) → address  — selector 0x0178b8bf
async function getResolver(node: Uint8Array): Promise<string | null> {
  const result = await ethCallStr(ENS_REGISTRY, encodeNodeCall("0178b8bf", node));
  const addr = "0x" + result.slice(-40);
  return addr.toLowerCase() === ZERO_ADDR ? null : addr;
}

// PublicResolver: addr(bytes32 node) → address  — selector 0x3b3b57de
async function forwardResolve(resolver: string, node: Uint8Array): Promise<string | null> {
  const result = await ethCallStr(resolver, encodeNodeCall("3b3b57de", node));
  const addr = "0x" + result.slice(-40);
  return addr.toLowerCase() === ZERO_ADDR ? null : addr;
}

// ReverseResolver: name(bytes32 node) → string  — selector 0x691f3431
async function reverseResolve(resolver: string, node: Uint8Array): Promise<string | null> {
  const result = await ethCallStr(resolver, encodeNodeCall("691f3431", node));
  const name = decodeAbiString(result);
  return name || null;
}


async function getEthBalance(address: string): Promise<string> {
  const hex = await jsonRpc<string>("eth_getBalance", [address, "latest"]);
  return (parseInt(hex, 16) / 1e18).toFixed(6);
}

//  Skill server 
const server = createSkillServer({ payTo: PAY_TO, cors: true });

server.add(
  skill("resolve", {
    description: "Resolve ENS names to addresses or reverse-lookup addresses to ENS names on Ethereum mainnet",
    endpoint: "/resolve/:ensOrAddress",
    method: "GET",
    price: "$0.02",
    handler: async (req: Request, res: Response) => {
      const rawInput = (req.params.ensOrAddress ?? "").trim();
      const isEns = rawInput.endsWith(".eth");
      const isAddress = /^0x[0-9a-fA-F]{40}$/.test(rawInput);
      const input = isAddress ? rawInput.toLowerCase() : rawInput;

      if (!isEns && !isAddress) {
        res.status(400).json({
          error: "Invalid address format",
          expected: "ENS name (e.g. vitalik.eth) or 0x + 40 hex chars",
        });
        return;
      }

      try {
        if (isEns) {
          const node = namehash(input);
          const resolver = await getResolver(node);

          if (!resolver) {
            res.json({
              input,
              type: "ens",
              resolved: false,
              eth_balance: "0.000000",
              resolved_at: new Date().toISOString(),
            });
            return;
          }

          const resolved_address = await forwardResolve(resolver, node);
          const eth_balance = resolved_address
            ? await getEthBalance(resolved_address)
            : "0.000000";

          res.json({
            input,
            type: "ens",
            resolved_address: resolved_address ?? undefined,
            eth_balance,
            resolved: !!resolved_address,
            resolved_at: new Date().toISOString(),
          });
        } else {
          const addrLower = input.toLowerCase().replace("0x", "");
          const reverseLabel = `${addrLower}.addr.reverse`;
          const node = namehash(reverseLabel);
          const resolver = await getResolver(node);

          let ens_name: string | undefined;
          if (resolver) {
            const name = await reverseResolve(resolver, node);
            ens_name = name ?? undefined;
          }

          const eth_balance = await getEthBalance(input);

          res.json({
            input,
            type: "address",
            ens_name,
            eth_balance,
            resolved: !!ens_name,
            resolved_at: new Date().toISOString(),
          });
        }
      } catch {
        res.status(503).json({ error: "RPC unavailable", fallback: true, message: "Could not reach Ethereum mainnet" });
      }
    },
  })
);

server.listen(4004);
console.log("ENS Resolver skill running on port 4004");
process.on('unhandledRejection', (err) => console.error('[ens-resolver] Unhandled:', err));
process.on('SIGTERM', () => { console.log('[ens-resolver] Shutting down...'); process.exit(0); });
process.on('SIGINT',  () => { console.log('[ens-resolver] Shutting down...'); process.exit(0); });
