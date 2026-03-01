export interface SkillRecord {
  id: number;
  name: string;
  description: string;
  endpoint: string;
  price_usd: number;
  publisher_wallet: string;
  category: string;
  port: number;
  usage_count: number;
  created_at: string;
}

export type RegisterSkillPayload = Omit<SkillRecord, "id" | "usage_count" | "created_at">;

export interface MarketplaceResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface AuditFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
}

export interface ContractAuditResult {
  address: string;
  is_contract: boolean;
  is_verified: boolean;
  contract_name?: string;
  compiler_version?: string;
  deployer?: string;
  eth_balance: string;
  tx_count: number;
  source_available: boolean;
  findings: AuditFinding[];
  risk_score: "critical" | "high" | "medium" | "low" | "safe";
  summary: string;
  recommendations: string[];
  analyzed_at: string;
}

export interface WalletScoreResult {
  address: string;
  eth_balance: string;  
  usdc_balance: string; 
  tx_count: number;
  wallet_age_estimate: "new" | "established" | "veteran";
  score: number;   
  scored_at: string;
}

export interface GasEstimateResult {
  gas_price_gwei: number;
  estimates: {
    token_transfer: string; 
    contract_call: string;
    nft_mint: string;
  };
  network: "base";
  fetched_at: string;
}
