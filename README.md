# SkillBazaar

SkillBazaar is a pay-per-use marketplace for on-chain AI skills built on [pinion-os](https://github.com/chu2bard/pinion-os) and the [x402 payment protocol](https://x402.org). Each skill is a live microservice that charges USDC on Base — no API keys, no subscriptions, no wallet popups. Claude can browse and pay for skills autonomously via a built-in MCP server.

## Architecture

```
 Claude Desktop
      │  MCP (stdio)
      ▼
 ┌─────────────┐
 │  MCP Server │  src/mcp/server.ts
 │  (4 tools)  │  list_skills · get_skill_info · execute_skill · check_balance
 └──────┬──────┘
        │  HTTP  localhost:3000
        ▼
 ┌─────────────────────┐
 │  Marketplace API    │  src/marketplace/
 │  Express + SQLite   │  GET /skills · POST /skills/:name/execute · GET /wallet/balance
 └──────┬──────────────┘
        │  payX402Service (x402 micropayment)
        │
   ┌────┴───────────────────┬──────────────────────┐
   ▼                        ▼                      ▼
 ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
 │ contract-    │  │ wallet-scorer    │  │ gas-estimator    │
 │ auditor      │  │ :4002 · $0.03   │  │ :4003 · $0.02   │
 │ :4001 · $0.05│  └────────┬─────────┘  └────────┬─────────┘
 └────────┬─────┘           │                     │
          └─────────────────┴─────────────────────┘
                            │  eth_getBalance · eth_call · eth_gasPrice
                            ▼
                      Base L2 (mainnet)
```

## Install

```bash
# 1. Install backend dependencies
npm install

# 2. Install frontend dependencies
cd src/frontend && npm install && cd ../..
```

## Configure

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```env
PINION_PRIVATE_KEY=0xYOUR_PRIVATE_KEY   # Base wallet private key
ADDRESS=0xYOUR_WALLET_ADDRESS           # Corresponding public address
```

> Your wallet needs USDC on Base mainnet to pay for skill calls.
> Bridge ETH → USDC at [bridge.base.org](https://bridge.base.org).

## Run

```bash
npm run dev
```

This starts all four services concurrently:

| Label | Service | URL |
|---|---|---|
| `marketplace` | Registry API + execute proxy | http://localhost:3000 |
| `skills` | contract-auditor, wallet-scorer, gas-estimator | :4001 / :4002 / :4003 |
| `mcp` | MCP stdio server for Claude | (stdio) |
| `frontend` | React UI | http://localhost:5173 |

Or run services individually:

```bash
npm run dev:marketplace   # API only
npm run dev:skills        # skill servers only
npm run dev:frontend      # UI only
npm run demo              # run the CLI demo script
```

## Connect Claude Desktop

1. Open [Claude Desktop](https://claude.ai/download) settings → Developer → Edit Config
2. Merge `claude-mcp-config.json` from this repo into your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skillbazaar": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/skillbazaar/src/mcp/server.ts"],
      "env": {
        "PINION_PRIVATE_KEY": "0xYOUR_KEY",
        "ADDRESS": "0xYOUR_ADDRESS"
      }
    }
  }
}
```

3. Restart Claude Desktop. You'll see **4 SkillBazaar tools** available in the tool list.

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Or register via Claude Code CLI:**
```bash
claude mcp add --transport stdio skillbazaar \
  --env PINION_PRIVATE_KEY=0xYOUR_KEY \
  --env ADDRESS=0xYOUR_ADDRESS \
  -- npx tsx /absolute/path/to/src/mcp/server.ts
```

## Available Skills

| Skill | Price | What it does | Param |
|---|---|---|---|
| `contract-auditor` | $0.05 | Audits an EVM contract — bytecode analysis, tx count, risk signals, score | EVM address |
| `wallet-scorer` | $0.03 | Scores a wallet's on-chain history, ETH + USDC balance, veteran/new rating | EVM address |
| `gas-estimator` | $0.02 | Live Base gas price + USD cost estimates for token transfer, contract call, NFT mint | none |

All skills query Base mainnet directly via JSON-RPC — no third-party APIs.

## Add a New Skill

**1. Create the skill server** in `src/skills/my-skill.ts`:

```typescript
import { createSkillServer, skill } from "pinion-os/server";

const server = createSkillServer({ payTo: process.env.ADDRESS! });

server.add(skill("my-skill", {
  price: "$0.01",
  handler: async (req, res) => {
    res.json({ result: "hello" });
  },
}));

server.listen(4004);
```

**2. Register it in the marketplace:**

```bash
curl -X POST http://localhost:3000/skills/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-skill",
    "description": "Does something useful",
    "endpoint": "http://localhost:4004/my-skill",
    "price_usd": 0.01,
    "publisher_wallet": "0xYOUR_ADDRESS",
    "category": "utility",
    "port": 4004
  }'
```

**3. Add it to `dev:skills` in `package.json`:**

```json
"dev:skills": "tsx src/skills/contract-auditor.ts & tsx src/skills/wallet-scorer.ts & tsx src/skills/gas-estimator.ts & tsx src/skills/my-skill.ts"
```

Claude will automatically discover it via `list_skills` on the next call.

## How x402 Payments Work

1. `execute_skill` calls `payX402Service(signer, skillUrl, { maxAmount })`
2. The skill server returns `402 Payment Required` with Base USDC payment details
3. The SDK signs an **EIP-3009** USDC transfer — no popup, no approval tx
4. The skill server verifies via the x402 facilitator and returns the result
5. USDC lands in the publisher's wallet, settled on Base L2

One HTTP request. One payment. No gas fees for the payer.
