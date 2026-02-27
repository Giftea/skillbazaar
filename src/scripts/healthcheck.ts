/**
 * SkillBazaar Health Check
 *
 * Probes all 6 services and prints a status table.
 * Exits with code 1 if any service is offline.
 *
 * Usage:
 *   npm run healthcheck
 */

const SERVICES = [
  { name: "Marketplace API",  port: 3000 },
  { name: "Contract Auditor", port: 4001 },
  { name: "Wallet Scorer",    port: 4002 },
  { name: "Gas Estimator",    port: 4003 },
  { name: "ENS Resolver",     port: 4004 },
  { name: "Frontend (Vite)",  port: 5173 },
];

async function probe(port: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 2000);
  try {
    await fetch(`http://localhost:${port}`, { signal: ctrl.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("\n  SkillBazaar Health Check");
  console.log("  " + "─".repeat(40));
  console.log("  │ Service             │ Port │ Status │");
  console.log("  ├─────────────────────┼──────┼────────┤");

  const results = await Promise.all(
    SERVICES.map(async (s) => ({ ...s, online: await probe(s.port) }))
  );

  let anyDown = false;
  for (const r of results) {
    const status = r.online ? "✅ UP  " : "❌ DOWN";
    if (!r.online) anyDown = true;
    const name = r.name.padEnd(19);
    const port = String(r.port).padEnd(4);
    console.log(`  │ ${name} │ ${port} │ ${status} │`);
  }

  console.log("  └─────────────────────┴──────┴────────┘");
  console.log();

  if (anyDown) {
    console.error("  ⚠️  One or more services are offline. Start everything with: npm run dev\n");
    process.exit(1);
  } else {
    console.log("  All services are UP. Ready to demo!\n");
  }
}

main().catch((err) => {
  console.error("Health check error:", (err as Error).message);
  process.exit(1);
});
