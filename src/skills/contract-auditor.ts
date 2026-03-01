/**
 * Skill Server 1 — AI-Powered Contract Auditor
 *
 * GET /audit/:address
 * Fetches source code from Basescan, then uses Claude to audit for
 * vulnerabilities, access control issues, and logic bugs.
 * Protected by x402 micropayment ($0.05 USDC) via pinion-os/server.
 */

import "dotenv/config";
import { createSkillServer, skill } from "pinion-os/server";
import type { ContractAuditResult, AuditFinding } from "../shared/types.js";
import { Request, Response } from "express";

const BASE_RPC = "https://mainnet.base.org";
const BASESCAN_API = "https://api.basescan.org/api";
const PAY_TO = process.env.ADDRESS ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

if (!PAY_TO) {
  console.error("[contract-auditor] ERROR: ADDRESS env var is required");
  process.exit(1);
}

// RPC helpers

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

//  Basescan source fetch

interface BasescanSource {
  contractName: string;
  compilerVersion: string;
  source: string;
}

async function fetchSourceCode(address: string): Promise<BasescanSource | null> {
  const apiKey = process.env.BASESCAN_API_KEY ?? "YourApiKeyToken";
  const url = `${BASESCAN_API}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timeout));
    const json = (await res.json()) as { status: string; result: Array<{ SourceCode: string; ContractName: string; CompilerVersion: string }> };
    if (json.status !== "1" || !json.result?.[0]?.SourceCode) return null;
    const r = json.result[0];
    return { contractName: r.ContractName, compilerVersion: r.CompilerVersion, source: r.SourceCode };
  } catch {
    return null;
  }
}

async function fetchDeployer(address: string): Promise<string | undefined> {
  const apiKey = process.env.BASESCAN_API_KEY ?? "YourApiKeyToken";
  const url = `${BASESCAN_API}?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${apiKey}`;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timeout));
    const json = (await res.json()) as { status: string; result: Array<{ contractCreator: string }> };
    if (json.status !== "1" || !json.result?.[0]?.contractCreator) return undefined;
    return json.result[0].contractCreator;
  } catch {
    return undefined;
  }
}

//  Bytecode heuristics (used when source is unverified) 

// Map of known 4-byte selectors to human-readable names
const KNOWN_SELECTORS: Record<string, string> = {
  "a9059cbb": "transfer(address,uint256)",
  "23b872dd": "transferFrom(address,address,uint256)",
  "095ea7b3": "approve(address,uint256)",
  "40c10f19": "mint(address,uint256)",
  "42966c68": "burn(uint256)",
  "8da5cb5b": "owner()",
  "f2fde38b": "transferOwnership(address)",
  "715018a6": "renounceOwnership()",
  "3659cfe6": "upgradeTo(address)",       
  "4f1ef286": "upgradeToAndCall(address,bytes)", 
  "5c60da1b": "implementation()",         
  "f851a440": "admin()",
};


const DANGEROUS_OPCODES = {
  ff: "SELFDESTRUCT",
  f4: "DELEGATECALL",
};

function analyzeBytecode(bytecode: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const hex = bytecode.toLowerCase().replace("0x", "");


  const detectedSelectors: string[] = [];
  for (const [sel, name] of Object.entries(KNOWN_SELECTORS)) {
    if (hex.includes(sel)) detectedSelectors.push(name);
  }
  if (detectedSelectors.length > 0) {
    findings.push({
      severity: "info",
      title: "Detected function signatures",
      description: `Bytecode contains signatures for: ${detectedSelectors.join(", ")}`,
    });
  }

  // Dangerous opcodes
  for (const [opcode, name] of Object.entries(DANGEROUS_OPCODES)) {
    if (hex.includes(opcode)) {
      findings.push({
        severity: opcode === "ff" ? "high" : "medium",
        title: `${name} opcode detected`,
        description:
          opcode === "ff"
            ? "Contract contains SELFDESTRUCT — owner can destroy the contract and send all ETH to an arbitrary address."
            : "Contract uses DELEGATECALL — storage layout must match the implementation contract exactly, or it is a proxy.",
      });
    }
  }

  // Proxy pattern
  const hasProxy =
    hex.includes("3659cfe6") || hex.includes("5c60da1b") || hex.includes("4f1ef286");
  if (hasProxy) {
    findings.push({
      severity: "medium",
      title: "Upgradeable proxy pattern",
      description:
        "Contract appears to be an upgradeable proxy. Verify the implementation address and that the upgrade mechanism is access-controlled.",
    });
  }

  // Bytecode size
  const byteLen = hex.length / 2;
  if (byteLen < 100) {
    findings.push({
      severity: "low",
      title: "Minimal bytecode",
      description: `Contract is only ${byteLen} bytes — likely a simple proxy, minimal contract, or placeholder.`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      title: "Source not verified",
      description:
        "Contract is not verified on Basescan. Only bytecode heuristics applied. Verify the source for a full audit.",
    });
  }

  return findings;
}

//  JSON extraction helper 

function extractJson(text: string): Partial<AIAnalysis> {
  // 1. Strip markdown fences
  let s = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // 2. If still not starting with {, find the first { and last }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s) as Partial<AIAnalysis>;
}

//  Claude AI analysis 

interface AIAnalysis {
  findings: AuditFinding[];
  summary: string;
  recommendations: string[];
}

async function analyzeWithClaude(
  source: string,
  contractName: string,
  address: string,
): Promise<AIAnalysis> {
  if (!ANTHROPIC_API_KEY) {
    return {
      findings: [{
        severity: "info",
        title: "AI analysis unavailable",
        description: "Set ANTHROPIC_API_KEY to enable Claude-powered vulnerability analysis.",
      }],
      summary: "Source code retrieved from Basescan but AI analysis requires ANTHROPIC_API_KEY.",
      recommendations: ["Set ANTHROPIC_API_KEY environment variable to enable full AI audit."],
    };
  }

  // Trim very long source files to fit context (keep first 16 KB)
  const trimmed = source.length > 16_000 ? source.slice(0, 16_000) + "\n\n// [truncated]" : source;

  const prompt = `You are a senior smart contract security auditor. Audit the following Solidity source code for ${contractName} (${address}) on Base mainnet.

\`\`\`solidity
${trimmed}
\`\`\`

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "summary": "1-2 sentences describing what the contract does and overall risk level",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "short title (max 60 chars)",
      "description": "specific explanation referencing actual function/line names from the code"
    }
  ],
  "recommendations": ["specific actionable fix 1", "fix 2"]
}

Check for: reentrancy, integer overflow/underflow, unchecked return values, access control bypass, front-running, flash loan attack vectors, unprotected initializers, centralization/admin risk, unbounded loops, storage collisions in proxies, selfdestruct misuse. Be precise and reference actual function names.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const parsed = extractJson(text);
    return {
      findings: parsed.findings ?? [],
      summary: parsed.summary ?? "Analysis complete.",
      recommendations: parsed.recommendations ?? [],
    };
  } catch {
    console.error("[contract-auditor] Claude source parse error. Raw:", text.slice(0, 500));
    return {
      findings: [{ severity: "info", title: "Parse error", description: text.slice(0, 300) }],
      summary: "AI analysis completed but response could not be parsed.",
      recommendations: [],
    };
  }
}

//  Claude bytecode analysis (unverified contracts)

async function analyzeWithClaudeBytecode(
  bytecode: string,
  heuristicFindings: AuditFinding[],
  address: string,
  txCount: number,
  ethBalance: string,
): Promise<AIAnalysis> {
  if (!ANTHROPIC_API_KEY) {
    return {
      findings: heuristicFindings,
      summary: "Contract source is not verified on Basescan. Heuristic analysis only — set ANTHROPIC_API_KEY for AI-powered bytecode analysis.",
      recommendations: ["Verify contract source on Basescan for a full source-level audit."],
    };
  }

  const hex = bytecode.toLowerCase();
  const byteLen = hex.replace("0x", "").length / 2;
  // Send first 3 KB of bytecode — enough for pattern recognition without burning tokens
  const hexSnippet = hex.slice(0, 6144);

  const heuristicSummary = heuristicFindings
    .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
    .join("\n");

  const prompt = `You are a senior smart contract security auditor. The following smart contract on Base mainnet does NOT have verified source code on Basescan. Perform a bytecode-level audit.

Contract Address: ${address}
Bytecode Size: ${byteLen} bytes
ETH Balance: ${ethBalance} ETH
Transaction Count: ${txCount}

Bytecode (hex, first 3 KB):
${hexSnippet}

Automated heuristic pre-scan found:
${heuristicSummary}

Using the bytecode, detected function selectors, opcode patterns, and on-chain data above, provide a security audit.

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "2-3 sentences: what this contract likely does based on bytecode patterns, and the overall risk level",
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "short title (max 60 chars)",
      "description": "explanation based on observed bytecode patterns, selectors, or opcodes"
    }
  ],
  "recommendations": ["actionable recommendation 1", "recommendation 2"]
}

Incorporate the heuristic findings. Add insights from function selectors and opcode patterns. Flag if this appears to be a proxy, token contract, or has dangerous patterns. Note that source is unavailable so analysis is bytecode-level only.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const parsed = extractJson(text);
    return {
      findings: parsed.findings ?? heuristicFindings,
      summary: parsed.summary ?? "Bytecode analysis complete.",
      recommendations: parsed.recommendations ?? [],
    };
  } catch {
    console.error("[contract-auditor] Claude bytecode parse error. Raw:", text.slice(0, 500));
    return {
      findings: heuristicFindings,
      summary: "AI bytecode analysis completed but response could not be parsed. Heuristic findings shown.",
      recommendations: [],
    };
  }
}

//  Risk score aggregation 

function deriveRiskScore(findings: AuditFinding[]): ContractAuditResult["risk_score"] {
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "high")) return "high";
  if (findings.some((f) => f.severity === "medium")) return "medium";
  if (findings.some((f) => f.severity === "low")) return "low";
  return "safe";
}

//  Main audit

async function auditContract(address: string): Promise<ContractAuditResult> {
  const [balanceHex, txCountHex, bytecode] = await Promise.all([
    rpc<string>("eth_getBalance", [address, "latest"]),
    rpc<string>("eth_getTransactionCount", [address, "latest"]),
    rpc<string>("eth_getCode", [address, "latest"]),
  ]);

  const eth_balance = hexToEth(balanceHex);
  const tx_count = parseInt(txCountHex, 16);
  const is_contract = bytecode !== "0x" && bytecode.length > 2;

  if (!is_contract) {
    return {
      address,
      is_contract: false,
      is_verified: false,
      source_available: false,
      eth_balance,
      tx_count,
      findings: [{
        severity: "info",
        title: "Not a contract",
        description: "This address is an externally owned account (EOA), not a smart contract.",
      }],
      risk_score: "safe",
      summary: "Address is an EOA — no contract code to audit.",
      recommendations: [],
      analyzed_at: new Date().toISOString(),
    };
  }

  // Fetch source + deployer in parallel
  const [sourceInfo, deployer] = await Promise.all([
    fetchSourceCode(address),
    fetchDeployer(address),
  ]);

  let findings: AuditFinding[];
  let summary: string;
  let recommendations: string[];
  let is_verified = false;
  let contract_name: string | undefined;
  let compiler_version: string | undefined;

  if (sourceInfo) {
    is_verified = true;
    contract_name = sourceInfo.contractName;
    compiler_version = sourceInfo.compilerVersion;

    const ai = await analyzeWithClaude(sourceInfo.source, sourceInfo.contractName, address);
    findings = ai.findings;
    summary = ai.summary;
    recommendations = ai.recommendations;
  } else {
    // Run heuristics first, then feed results + bytecode to Claude
    const heuristicFindings = analyzeBytecode(bytecode);
    const ai = await analyzeWithClaudeBytecode(bytecode, heuristicFindings, address, tx_count, eth_balance);
    findings = ai.findings;
    summary = ai.summary;
    recommendations = ai.recommendations;
  }

  // Add on-chain context finding if noteworthy
  if (tx_count < 5) {
    findings.push({
      severity: "low",
      title: "Low transaction count",
      description: `Contract has only ${tx_count} outbound transaction(s) — recently deployed or rarely used.`,
    });
  }

  return {
    address,
    is_contract: true,
    is_verified,
    contract_name,
    compiler_version,
    deployer,
    eth_balance,
    tx_count,
    source_available: !!sourceInfo,
    findings,
    risk_score: deriveRiskScore(findings),
    summary,
    recommendations,
    analyzed_at: new Date().toISOString(),
  };
}

//  Skill server 

const server = createSkillServer({ payTo: PAY_TO, network: "base", cors: true });

server.add(
  skill("audit", {
    description: "AI-powered smart contract audit — fetches verified source from Basescan and uses Claude to identify vulnerabilities, access control issues, and logic bugs",
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
        const result = await auditContract(address);
        res.json(result);
      } catch (err) {
        console.error("[contract-auditor] Error:", err);
        res.status(503).json({ error: "Audit failed", message: (err as Error).message });
      }
    },
  })
);

server.listen(4001);
console.log("Contract Auditor skill running on port 4001");
process.on("unhandledRejection", (err) => console.error("[contract-auditor] Unhandled:", err));
process.on("SIGTERM", () => { console.log("[contract-auditor] Shutting down..."); process.exit(0); });
process.on("SIGINT",  () => { console.log("[contract-auditor] Shutting down..."); process.exit(0); });
