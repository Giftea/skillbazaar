/**
 * SkillBazaar Demo
 *
 * Shows the full flow:
 *   1. Check wallet USDC balance
 *   2. Browse marketplace skill list
 *   3. Call gas-estimator skill with x402 auto-payment
 *   4. Log final balance after payment
 *
 * Usage:
 *   npm run demo
 */

import "dotenv/config";
import { PinionClient, payX402Service } from "pinion-os";
import type { SkillRecord } from "../shared/types.js";

const PRIVATE_KEY = process.env.PINION_PRIVATE_KEY ?? "";

if (!PRIVATE_KEY) {
  console.error("ERROR: PINION_PRIVATE_KEY is not set in .env");
  process.exit(1);
}


//  handles both a successful response and a 402 (no funds)
type BalanceSnapshot = { usdc: string; eth: string } | null;

function extractBalance(res: { status: number; data: unknown }): BalanceSnapshot {
  if (res.status !== 200) return null;
  const d = res.data as Record<string, unknown>;
  const bal = d?.balances as Record<string, string> | undefined;
  if (bal?.ETH !== undefined) return { eth: bal.ETH, usdc: bal.USDC };

  return {
    eth: String(d?.eth ?? "0"),
    usdc: String(d?.usdc ?? "0"),
  };
}

function logBalance(snap: BalanceSnapshot) {
  if (!snap) {
    console.log("  Wallet needs USDC on Base mainnet to pay for this skill call.");
    console.log("  Fund it at: https://bridge.base.org");
  } else {
    console.log(`  USDC: ${snap.usdc}`);
    console.log(`  ETH:  ${snap.eth}`);
  }
}


// Main
async function main() {
  console.log("\nSkillBazaar Demo");
  console.log("=".repeat(40));

  const pinion = new PinionClient({ privateKey: PRIVATE_KEY });
  console.log(`Wallet: ${pinion.address}\n`);

  //  Step 1: Check Balance 
  console.log("=== Step 1: Check Balance ===");
  const balanceBefore = await pinion.skills.balance(pinion.address);
  const snapBefore = extractBalance(balanceBefore);
  logBalance(snapBefore);
  console.log();

  //  Step 2: Browse Marketplace 
  console.log("=== Step 2: Browse Marketplace ===");
  let skills: SkillRecord[] = [];
  try {
    const res = await fetch("http://localhost:3000/skills");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { skills: SkillRecord[]; count: number };
    skills = json.skills;
    console.log(`  ${json.count} skill(s) available:\n`);
    for (const s of skills) {
      console.log(`  [${s.name}]`);
      console.log(`    description : ${s.description}`);
      console.log(`    endpoint    : ${s.endpoint}`);
      console.log(`    price       : $${s.price_usd} USDC`);
      console.log(`    category    : ${s.category}`);
      console.log(`    usage_count : ${s.usage_count}`);
      console.log();
    }
  } catch (err) {
    console.error(`  ERROR: could not reach marketplace — ${(err as Error).message}`);
    console.error("  Make sure it is running: npm run dev:marketplace\n");
    process.exit(1);
  }

  //  Step 3: Call gas-estimator skill
  console.log("=== Step 3: Call gas-estimator Skill ===");
  const GAS_SKILL_URL = "http://localhost:4003/gas";
  console.log(`  Endpoint : ${GAS_SKILL_URL}`);
  console.log("  Paying   : $0.02 USDC via x402...\n");

  async function payGasSkill() {
    return payX402Service(pinion.signer, GAS_SKILL_URL, { method: "GET", maxAmount: "20000" });
  }

  try {
    let result;
    try {
      result = await payGasSkill();
    } catch (firstErr) {
      const msg = (firstErr as Error).message ?? "";
      if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("ENOTFOUND")) {
        console.log("  ⚠️  Payment failed, retrying in 2s...");
        await new Promise((r) => setTimeout(r, 2000));
        result = await payGasSkill();
      } else {
        throw firstErr;
      }
    }

    const paidUsd = (parseInt(result.paidAmount) / 1e6).toFixed(4);
    console.log(`  Paid: $${paidUsd} USDC  (${result.responseTimeMs}ms)\n`);
    console.log("  Gas estimate result:");
    console.log(JSON.stringify(result.data, null, 4));
    console.log();
  } catch (err) {
    console.error(`  ERROR: ${(err as Error).message}`);
    console.error("  Make sure gas-estimator is running: npm run dev:skills\n");
  }

  //  Step 4: Final Balance 
  console.log("=== Step 4: Final Balance ===");
  const balanceAfter = await pinion.skills.balance(pinion.address);
  const snapAfter = extractBalance(balanceAfter);
  logBalance(snapAfter);

  if (snapBefore && snapAfter) {
    const spent = parseFloat(snapBefore.usdc) - parseFloat(snapAfter.usdc);
    if (spent > 0) {
      console.log(`  Total spent this session: $${spent.toFixed(4)} USDC`);
    }
  }
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
