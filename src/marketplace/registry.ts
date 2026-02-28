import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import type { SkillRecord, RegisterSkillPayload } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/skills.db");

let db: Database.Database;

// Seeds
const SEED_SKILLS: RegisterSkillPayload[] = [
  {
    name: "contract-auditor",
    description: "Audit a smart contract address for known vulnerabilities and risk signals",
    endpoint: "http://localhost:4001/audit/:address",
    price_usd: 0.05,
    publisher_wallet: process.env.ADDRESS ?? "",
    category: "web3",
    port: 4001,
  },
  {
    name: "wallet-scorer",
    description: "Score a wallet address for transaction patterns, age, and risk",
    endpoint: "http://localhost:4002/score/:address",
    price_usd: 0.03,
    publisher_wallet: process.env.ADDRESS ?? "",
    category: "web3",
    port: 4002,
  },
  {
    name: "gas-estimator",
    description: "Get current Base network gas prices and transaction cost estimates",
    endpoint: "http://localhost:4003/gas",
    price_usd: 0.02,
    publisher_wallet: process.env.ADDRESS ?? "",
    category: "web3",
    port: 4003,
  },
  {
    name: "ens-resolver",
    description: "Resolve ENS names to addresses or reverse lookup addresses to ENS names on Ethereum mainnet",
    endpoint: "http://localhost:4004/resolve/:ensOrAddress",
    price_usd: 0.02,
    publisher_wallet: process.env.ADDRESS ?? "",
    category: "web3",
    port: 4004,
  },
];

// Public API

export function initDB(): void {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Auto-migrate: if the table exists with the old schema (no price_usd column),
  // drop it so the new schema is applied cleanly.
  const cols = db.pragma("table_info(skills)") as { name: string }[];
  if (cols.length > 0 && !cols.some((c) => c.name === "price_usd")) {
    db.exec("DROP TABLE skills");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL UNIQUE,
      description      TEXT    NOT NULL,
      endpoint         TEXT    NOT NULL,
      price_usd        REAL    NOT NULL,
      publisher_wallet TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      port             INTEGER NOT NULL,
      usage_count      INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed default skills once (INSERT OR IGNORE skips existing rows)
  const insert = db.prepare(`
    INSERT OR IGNORE INTO skills
      (name, description, endpoint, price_usd, publisher_wallet, category, port)
    VALUES
      (@name, @description, @endpoint, @price_usd, @publisher_wallet, @category, @port)
  `);

  for (const skill of SEED_SKILLS) {
    const result = insert.run(skill);
    if (result.changes > 0) {
      console.log(`[registry] Seeded skill: ${skill.name}`);
    }
  }
}

export function registerSkill(payload: RegisterSkillPayload): SkillRecord {
  db.prepare(`
    INSERT INTO skills (name, description, endpoint, price_usd, publisher_wallet, category, port)
    VALUES (@name, @description, @endpoint, @price_usd, @publisher_wallet, @category, @port)
    ON CONFLICT(name) DO UPDATE SET
      description      = excluded.description,
      endpoint         = excluded.endpoint,
      price_usd        = excluded.price_usd,
      publisher_wallet = excluded.publisher_wallet,
      category         = excluded.category,
      port             = excluded.port
  `).run(payload);

  return db
    .prepare("SELECT * FROM skills WHERE name = ?")
    .get(payload.name) as SkillRecord;
}

export function getAllSkills(): SkillRecord[] {
  return db
    .prepare("SELECT * FROM skills ORDER BY created_at DESC")
    .all() as SkillRecord[];
}

export function getSkillByName(name: string): SkillRecord | null {
  return (
    (db
      .prepare("SELECT * FROM skills WHERE name = ?")
      .get(name) as SkillRecord | undefined) ?? null
  );
}

export function incrementUsage(name: string): void {
  db
    .prepare("UPDATE skills SET usage_count = usage_count + 1 WHERE name = ?")
    .run(name);
}
