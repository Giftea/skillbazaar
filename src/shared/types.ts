export interface SkillRecord {
  id: number;
  name: string;
  description: string;
  endpoint: string;        // full URL, e.g. http://localhost:4001/audit/:address
  price_usd: number;
  publisher_wallet: string;
  category: string;
  port: number;
  usage_count: number;
  created_at: string;
}

// Payload for POST /skills/register — auto-managed fields are excluded
export type RegisterSkillPayload = Omit<SkillRecord, "id" | "usage_count" | "created_at">;

export interface MarketplaceResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

// ── Skill response types ──────────────────────────────────────────────────────

export interface ContractAuditResult {
  address: string;
  is_contract: boolean;
  eth_balance: string;       // in ETH, e.g. "0.123456"
  tx_count: number;
  risk_signals: string[];
  score: "low" | "medium" | "high";
  analyzed_at: string;
}

export interface WalletScoreResult {
  address: string;
  eth_balance: string;       // in ETH
  usdc_balance: string;      // in USDC
  tx_count: number;
  wallet_age_estimate: "new" | "established" | "veteran";
  score: number;             // 0–100
  scored_at: string;
}

export interface GasEstimateResult {
  gas_price_gwei: number;
  estimates: {
    token_transfer: string;    // USD string, e.g. "$0.000042"
    contract_call: string;
    nft_mint: string;
  };
  network: "base";
  fetched_at: string;
}
