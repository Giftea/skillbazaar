# ⚙️ SkillBazaar
> The pay-per-use AI skill marketplace built on PinionOS x402

## What is it?

SkillBazaar is an open marketplace where anyone can publish and monetize on-chain AI skills — tiny microservices that charge USDC on Base per call via the x402 payment protocol. Callers pay fractions of a cent with no API keys, no subscriptions, and no wallet popups. Claude can browse and pay for skills autonomously via a built-in MCP server.

## Demo

[▶ Watch the demo video](https://your-demo-link-here)

## Architecture

```
 Browser UI (React + Vite)
      │  REST  localhost:5173 → proxy → localhost:3000
      ▼
 Claude Desktop
      │  MCP (stdio)
      ▼
 ┌─────────────┐
 │  MCP Server │  src/mcp/server.ts
 │  (4 tools)  │  list_skills · get_skill_info · execute_skill · check_balance
 └──────┬──────┘
        │  HTTP  localhost:3000
        ▼
 ┌──────────────────────┐
 │   Marketplace API    │  src/marketplace/
 │   Express + SQLite   │  /skills · /skills/:name/execute · /wallet/balance
 └──────┬───────────────┘
        │  payX402Service  (EIP-3009 USDC transfer, no gas for payer)
        │
   ┌────┴────────────────────┬────────────────────┬──────────────────┐
   ▼                         ▼                    ▼                  ▼
 ┌───────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
 │ contract-     │  │ wallet-scorer   │  │ gas-estimator│  │ ens-resolver │
 │ auditor       │  │ :4002 · $0.03  │  │ :4003 · $0.02│  │ :4004 · $0.02│
 │ :4001 · $0.05 │  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘
 └───────┬───────┘           │                  │                  │
         └───────────────────┴──────────────────┴──────────────────┘
                                        │
                              Base L2 + Ethereum mainnet
                         (eth_call · eth_getBalance · eth_gasPrice)
```

## Skills Available

| Skill | Price | Description |
|-------|-------|-------------|
| `contract-auditor` | $0.05 | Audits an EVM contract — bytecode analysis, tx count, risk signals, 0–100 safety score |
| `wallet-scorer` | $0.03 | Scores a wallet's on-chain history, ETH + USDC balance, veteran/new/whale rating |
| `gas-estimator` | $0.02 | Live Base gas price + USD cost estimates for token transfer, contract call, NFT mint |
| `ens-resolver` | $0.02 | Resolve ENS names → addresses or reverse-lookup addresses → ENS names on Ethereum mainnet |

All skills query Base mainnet directly via JSON-RPC — no third-party APIs.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/giftea/skillbazaar
cd skillbazaar

# 2. Install backend dependencies
npm install

# 3. Install frontend dependencies
cd src/frontend && npm install && cd ../..

# 4. Configure environment
cp .env.example .env
# Edit .env — fill in PINION_PRIVATE_KEY and ADDRESS
# Your wallet needs USDC on Base mainnet to pay for skill calls.
# Bridge ETH → USDC at https://bridge.base.org

# 5. Start everything
npm run dev
```

Open **http://localhost:5173** to see the marketplace UI.

| Service | URL |
|---------|-----|
| Marketplace API | http://localhost:3000 |
| React UI | http://localhost:5173 |
| Skill servers | :4001 / :4002 / :4003 / :4004 |
| MCP server | stdio |

## Connect Claude Desktop

1. Open [Claude Desktop](https://claude.ai/download) → Settings → Developer → Edit Config
2. Add the MCP server to your `claude_desktop_config.json`:

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

Config file locations:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

3. Restart Claude Desktop. You'll see **4 SkillBazaar tools** in the tool list.

Or add via Claude Code CLI:
```bash
claude mcp add --transport stdio skillbazaar \
  --env PINION_PRIVATE_KEY=0xYOUR_KEY \
  --env ADDRESS=0xYOUR_ADDRESS \
  -- npx tsx /absolute/path/to/src/mcp/server.ts
```

## Register Your Own Skill

**1. Build your skill server** using the PinionOS SDK:

```typescript
import { createSkillServer, skill } from "pinion-os/server";

const server = createSkillServer({ payTo: process.env.ADDRESS! });
server.add(skill("my-skill", {
  price: "$0.01",
  handler: async (req, res) => { res.json({ result: "hello" }); },
}));
server.listen(4005);
```

**2. Register it via the CLI** (interactive):

```bash
npm run cli
```

**3. Or register via the UI** — click **+ Register Skill** in the top-right of the marketplace.

Claude will automatically discover the new skill on the next `list_skills` call.

## Built With

- [PinionOS x402](https://github.com/chu2bard/pinion-os) — micropayment infrastructure for AI skills
- [Base L2](https://base.org) — USDC settlement, near-zero gas fees
- [Node.js + TypeScript](https://www.typescriptlang.org) — skill servers and marketplace API
- [React + Vite](https://vitejs.dev) — marketplace frontend
- [Model Context Protocol](https://modelcontextprotocol.io) — Claude Desktop integration
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — skill registry database
