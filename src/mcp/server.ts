import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const MARKETPLACE = "http://localhost:3000";

// Fetch with 8s timeout — prevents the MCP process from hanging
async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timeout));
}

interface SkillRecord {
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

const server = new Server(
  { name: "skillbazaar", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Tool definitions

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_skills",
      description: "Browse all available skills on SkillBazaar marketplace",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "get_skill_info",
      description: "Get detailed info about a specific skill before buying",
      inputSchema: {
        type: "object" as const,
        properties: {
          skill_name: {
            type: "string",
            description: "Name of the skill to look up (e.g. 'gas-estimator')",
          },
        },
        required: ["skill_name"],
      },
    },
    {
      name: "execute_skill",
      description:
        "Pay and execute a skill from the marketplace. Payment is automatic via x402 on Base.",
      inputSchema: {
        type: "object" as const,
        properties: {
          skill_name: {
            type: "string",
            description: "Name of the skill to execute",
          },
          param: {
            type: "string",
            description:
              "Optional parameter passed to the skill (e.g. an EVM address for contract-auditor or wallet-scorer). Omit for skills that take no input like gas-estimator.",
          },
        },
        required: ["skill_name"],
      },
    },
    {
      name: "check_balance",
      description: "Check current USDC balance available for paying skills",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

// Tool handlers

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, string | undefined>;

  try {
    switch (name) {
      // list_skills 
      case "list_skills": {
        const res = await fetchWithTimeout(`${MARKETPLACE}/skills`);
        if (!res.ok) throw new Error(`Marketplace returned HTTP ${res.status}`);
        const data = (await res.json()) as { skills: SkillRecord[]; count: number };

        const lines = data.skills.map(
          (s) =>
            `• ${s.name} — $${s.price_usd.toFixed(2)}/call\n` +
            `  ${s.description}\n` +
            `  Category: ${s.category} | Used ${s.usage_count} time(s)`
        );

        return {
          content: [
            {
              type: "text" as const,
              text:
                `SkillBazaar — ${data.count} skill(s) available:\n\n` +
                lines.join("\n\n"),
            },
          ],
        };
      }

      // get_skill_info 
      case "get_skill_info": {
        const skillName = a.skill_name;
        if (!skillName) throw new Error("skill_name is required");

        const res = await fetchWithTimeout(`${MARKETPLACE}/skills/${encodeURIComponent(skillName)}`);
        if (res.status === 404) {
          return {
            content: [{ type: "text" as const, text: `Skill "${skillName}" not found.` }],
          };
        }
        if (!res.ok) throw new Error(`Marketplace returned HTTP ${res.status}`);

        const s = (await res.json()) as SkillRecord;
        const needsParam = /:address|:token/.test(s.endpoint);

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Skill:       ${s.name}`,
                `Description: ${s.description}`,
                `Price:       $${s.price_usd.toFixed(2)} USDC per call`,
                `Category:    ${s.category}`,
                `Endpoint:    ${s.endpoint}`,
                `Needs param: ${needsParam ? "yes (EVM address)" : "no"}`,
                `Total calls: ${s.usage_count}`,
                `Port:        ${s.port}`,
                `Registered:  ${s.created_at}`,
              ].join("\n"),
            },
          ],
        };
      }

      // execute_skill 
      case "execute_skill": {
        const skillName = a.skill_name;
        if (!skillName) throw new Error("skill_name is required");

        const res = await fetchWithTimeout(
          `${MARKETPLACE}/skills/${encodeURIComponent(skillName)}/execute`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ param: a.param ?? null }),
          }
        );

        const data = (await res.json()) as {
          result: unknown;
          paid_usd: number;
          skill: string;
          error?: string;
        };

        if (!res.ok) {
          return {
            content: [{ type: "text" as const, text: `Error: ${data.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Skill executed: ${data.skill}\n` +
                `Paid: $${data.paid_usd.toFixed(2)} USDC via x402\n\n` +
                `Result:\n${JSON.stringify(data.result, null, 2)}`,
            },
          ],
        };
      }

      // check_balance 
      case "check_balance": {
        const res = await fetchWithTimeout(`${MARKETPLACE}/wallet/balance`);
        const data = (await res.json()) as {
          balance_usdc: string;
          address: string;
          error?: string;
        };

        if (!res.ok) {
          return {
            content: [{ type: "text" as const, text: `Error: ${data.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Wallet:  ${data.address}\nBalance: $${data.balance_usdc} USDC`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const msg = (err as Error).message ?? "";
    const isOffline = msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("aborted");
    const text = isOffline
      ? "SkillBazaar marketplace is not running. Start it with: npm run dev:marketplace"
      : `Error: ${msg}`;
    return {
      content: [{ type: "text" as const, text }],
      isError: true,
    };
  }
});

process.on('unhandledRejection', (err) => console.error('[skillbazaar-mcp] Unhandled:', err));
process.on('uncaughtException', (err) => console.error('[skillbazaar-mcp] Uncaught:', err));

const transport = new StdioServerTransport();
await server.connect(transport);
