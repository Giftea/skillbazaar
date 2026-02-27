import { Router, Request, Response } from "express";
import { PinionClient, payX402Service } from "pinion-os";
import {
  getAllSkills,
  getSkillByName,
  registerSkill,
  incrementUsage,
} from "./registry.js";
import type { SkillRecord, RegisterSkillPayload } from "../shared/types.js";

let _pinion: PinionClient | null = null;
function getPinion(): PinionClient {
  if (!_pinion) {
    const key = process.env.PINION_PRIVATE_KEY;
    if (!key) throw new Error("PINION_PRIVATE_KEY env var is not set");
    _pinion = new PinionClient({ privateKey: key });
  }
  return _pinion;
}

const router = Router();

// GET /
// { name, version, total_skills }
router.get("/", (_req: Request, res: Response) => {
  const skills = getAllSkills();
  res.json({
    name: "SkillBazaar",
    version: "1.0.0",
    total_skills: skills.length,
  });
});

// GET /skills
// { skills: [...], count: N }
router.get("/skills", (_req: Request, res: Response) => {
  const skills = getAllSkills();
  res.json({ skills, count: skills.length });
});

// GET /skills/:name/info
// Full skill details including usage_count and endpoint template — must be
// registered before /skills/:name to avoid :name swallowing "info" as a suffix
router.get("/skills/:name/info", (req: Request, res: Response) => {
  const skill = getSkillByName(req.params.name);
  if (!skill) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  incrementUsage(skill.name);
  // Re-fetch so usage_count reflects the just-incremented value
  const updated = getSkillByName(skill.name) as SkillRecord;
  res.json({
    ...updated,
    endpoint_template: updated.endpoint,
    endpoint_example: updated.endpoint.replace(":address", "0x1234...abcd"),
  });
});

// GET /skills/:name
// Single skill or 404
router.get("/skills/:name", (req: Request, res: Response) => {
  const skill = getSkillByName(req.params.name);
  if (!skill) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  res.json(skill);
});

// POST /skills/register
// Body: RegisterSkillPayload
// Validates required fields and price_usd range [0.001, 10]
// Returns 201 with created skill
router.post("/skills/register", (req: Request, res: Response) => {
  const body = req.body as Partial<RegisterSkillPayload>;
  const { name, description, endpoint, price_usd, publisher_wallet, category, port } = body;

  if (!name || !description || !endpoint || price_usd === undefined || !publisher_wallet || !category || !port) {
    res.status(400).json({
      error: "Missing required fields: name, description, endpoint, price_usd, publisher_wallet, category, port",
    });
    return;
  }

  const price = Number(price_usd);
  if (isNaN(price) || price < 0.001 || price > 10) {
    res.status(400).json({ error: "price_usd must be between 0.001 and 10" });
    return;
  }

  const skill = registerSkill({
    name,
    description,
    endpoint,
    price_usd: price,
    publisher_wallet,
    category,
    port: Number(port),
  });

  res.status(201).json(skill);
});

// GET /wallet/balance
// Uses PinionClient to fetch USDC balance of the ADDRESS env var wallet
// Returns { balance_usdc: string, address: string }
router.get("/wallet/balance", async (_req: Request, res: Response) => {
  try {
    const pinion = getPinion();
    const address = process.env.ADDRESS ?? pinion.address;
    const result = await pinion.skills.balance(address);

    // SDK returns { status, data } — data shape: { balances: { USDC, ETH } } or flat { usdc, eth }
    const d = (result.data ?? {}) as Record<string, unknown>;
    const balances = d.balances as Record<string, string> | undefined;
    const balance_usdc = balances?.USDC ?? String(d.usdc ?? "0");

    res.json({ balance_usdc, address });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /skills/:name/execute
// Body: { param?: string } — param replaces :address or :token in the endpoint template
// Uses payX402Service to call the skill and auto-pay via x402
// maxAmount = price_usd * 1_000_000 (USDC micro-units, 6 decimals)
//   e.g. $0.05 → "50000"
// Returns { result, paid_usd, skill }
router.post("/skills/:name/execute", async (req: Request, res: Response) => {
  const skill = getSkillByName(req.params.name);
  if (!skill) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }

  const { param } = req.body as { param?: string };

  // Build concrete URL — replace :address or :token placeholder if param provided
  let url = skill.endpoint;
  if (param) {
    url = url.replace(/:address|:token/, encodeURIComponent(param));
  }

  // Convert price to USDC micro-units: $0.05 → 50000
  const maxAmount = String(Math.round(skill.price_usd * 1_000_000));

  try {
    const pinion = getPinion();
    const result = await payX402Service(pinion.signer, url, {
      method: "GET",
      maxAmount,
    });

    incrementUsage(skill.name);

    res.json({
      result: result.data,
      paid_usd: skill.price_usd,
      skill: skill.name,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /analytics
// Aggregated marketplace statistics derived live from the registry
router.get("/analytics", (_req: Request, res: Response) => {
  const skills = getAllSkills();

  const total_skills = skills.length;
  const total_calls = skills.reduce((sum, s) => sum + s.usage_count, 0);
  const total_revenue_usd = parseFloat(
    skills.reduce((sum, s) => sum + s.usage_count * s.price_usd, 0).toFixed(4)
  );

  const top_skills = [...skills]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 3)
    .map((s) => ({
      name: s.name,
      usage_count: s.usage_count,
      revenue_usd: parseFloat((s.usage_count * s.price_usd).toFixed(4)),
    }));

  const categories: Record<string, number> = {};
  for (const s of skills) {
    categories[s.category] = (categories[s.category] ?? 0) + 1;
  }

  res.json({
    total_skills,
    total_calls,
    total_revenue_usd,
    top_skills,
    categories,
    last_updated: new Date().toISOString(),
  });
});

export default router;
