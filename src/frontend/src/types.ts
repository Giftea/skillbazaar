export interface Skill {
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

export interface ExecuteResult {
  skill: string;
  param: string | null;
  price_usd: number;
  status: number;
  data: unknown;
}
