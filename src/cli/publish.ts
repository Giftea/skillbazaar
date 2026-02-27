#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";

const MARKETPLACE = process.env.MARKETPLACE_URL ?? "http://localhost:3000";

interface SkillRecord {
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

const program = new Command();

program
  .name("skillbazaar")
  .description("SkillBazaar CLI — publish and browse on-chain skills")
  .version("1.0.0");

// ── skillbazaar publish ─────────────────────────────────────────────────────

program
  .command("publish")
  .description("Interactively register a new skill on SkillBazaar")
  .action(async () => {
    console.log();
    console.log(chalk.bold("  SkillBazaar — Publish a Skill"));
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log();

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Skill name:",
        validate: (v: string) =>
          /^[a-z][a-z0-9-]*$/.test(v.trim())
            ? true
            : "Lowercase letters, numbers, and hyphens only (no spaces, must start with a letter)",
        filter: (v: string) => v.trim(),
      },
      {
        type: "input",
        name: "description",
        message: "Description:",
        validate: (v: string) =>
          v.trim().length >= 20
            ? true
            : `At least 20 characters (currently ${v.trim().length})`,
        filter: (v: string) => v.trim(),
      },
      {
        type: "input",
        name: "publisher_wallet",
        message: "Your wallet address:",
        validate: (v: string) =>
          /^0x[0-9a-fA-F]{40}$/.test(v.trim())
            ? true
            : "Must be a valid EVM address (0x followed by 40 hex chars)",
        filter: (v: string) => v.trim(),
      },
      {
        type: "input",
        name: "price_usd",
        message: "Price per call in USD (e.g. 0.05):",
        validate: (v: string) => {
          const n = parseFloat(v);
          if (isNaN(n)) return "Must be a number";
          if (n < 0.001 || n > 10) return "Price must be between $0.001 and $10.00";
          return true;
        },
        filter: (v: string) => parseFloat(v),
      },
      {
        type: "list",
        name: "category",
        message: "Category:",
        choices: ["web3", "ai", "data", "analytics", "utility"],
      },
      {
        type: "input",
        name: "server_url",
        message: "Skill server base URL (e.g. http://localhost:4004):",
        validate: (v: string) =>
          v.trim().startsWith("http")
            ? true
            : "Must start with http:// or https://",
        filter: (v: string) => v.trim().replace(/\/$/, ""),
      },
      {
        type: "input",
        name: "endpoint_path",
        message: "Endpoint path (e.g. /audit/:address or /run):",
        validate: (v: string) =>
          v.trim().startsWith("/") ? true : "Must start with /",
        filter: (v: string) => v.trim(),
      },
    ]);

    const endpoint = `${answers.server_url}${answers.endpoint_path}`;
    // Derive port from server_url
    const portMatch = (answers.server_url as string).match(/:(\d+)/);
    const port = portMatch ? parseInt(portMatch[1], 10) : 80;

    // ── Summary ────────────────────────────────────────────────────────────
    console.log();
    console.log(chalk.bold("  Review your skill:"));
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log(`  ${chalk.dim("Name:")}        ${chalk.bold.white(answers.name)}`);
    console.log(`  ${chalk.dim("Description:")} ${answers.description}`);
    console.log(`  ${chalk.dim("Wallet:")}      ${chalk.dim(answers.publisher_wallet)}`);
    console.log(`  ${chalk.dim("Price:")}       ${chalk.green("$" + (answers.price_usd as number).toFixed(3))} USDC per call`);
    console.log(`  ${chalk.dim("Category:")}    ${answers.category}`);
    console.log(`  ${chalk.dim("Endpoint:")}    ${chalk.gray(endpoint)}`);
    console.log();

    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Register this skill on SkillBazaar?",
        default: true,
      },
    ]);

    if (!confirmed) {
      console.log(chalk.yellow("\n  Cancelled.\n"));
      process.exit(0);
    }

    // ── POST to marketplace ────────────────────────────────────────────────
    console.log();
    const spinner = ora({ text: "Registering skill…", color: "cyan" }).start();

    try {
      const res = await fetch(`${MARKETPLACE}/skills/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: answers.name,
          description: answers.description,
          publisher_wallet: answers.publisher_wallet,
          price_usd: answers.price_usd,
          category: answers.category,
          endpoint,
          port,
        }),
      });

      const data = (await res.json()) as SkillRecord & { error?: string };

      if (!res.ok) {
        spinner.fail(chalk.red(`Registration failed: ${data.error ?? res.statusText}`));
        process.exit(1);
      }

      spinner.succeed(
        chalk.green("✅  Skill registered! Your skill is now live on SkillBazaar.")
      );
      console.log();
      console.log(
        `  ${chalk.dim("ID:")}       ${data.id}  ·  ` +
        `${chalk.dim("registered:")} ${data.created_at}`
      );
      console.log(
        `  Browse it: ${chalk.cyan(`${MARKETPLACE}/skills/${data.name}`)}`
      );
      console.log();
    } catch (err) {
      spinner.fail(
        chalk.red(`Network error: ${(err as Error).message}`) +
        chalk.dim("\n  Is the marketplace running?  npm run dev:marketplace")
      );
      process.exit(1);
    }
  });

// ── skillbazaar list ────────────────────────────────────────────────────────

program
  .command("list")
  .description("List all skills available on SkillBazaar")
  .action(async () => {
    const spinner = ora({ text: "Fetching skills…", color: "cyan" }).start();

    try {
      const res = await fetch(`${MARKETPLACE}/skills`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { skills: SkillRecord[]; count: number };
      spinner.stop();

      if (data.skills.length === 0) {
        console.log(chalk.yellow("\n  No skills registered yet.\n"));
        return;
      }

      console.log();
      console.log(
        chalk.bold(`  SkillBazaar — ${data.count} skill(s)`)
      );
      console.log(chalk.dim("  ────────────────────────────────────────────────────────────────────────"));
      console.log(
        chalk.dim(
          `  ${"NAME".padEnd(22)}  ${"PRICE".padEnd(8)}  ${"CATEGORY".padEnd(12)}  ${"CALLS".padEnd(6)}  ENDPOINT`
        )
      );
      console.log(chalk.dim("  ────────────────────────────────────────────────────────────────────────"));

      for (const s of data.skills) {
        console.log(
          `  ${chalk.bold.white(s.name.padEnd(22))}` +
          `  ${chalk.green(("$" + s.price_usd.toFixed(2)).padEnd(8))}` +
          `  ${chalk.cyan(s.category.padEnd(12))}` +
          `  ${String(s.usage_count).padEnd(6)}` +
          `  ${chalk.dim(s.endpoint)}`
        );
      }
      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Failed to fetch skills: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ── skillbazaar info <skillName> ────────────────────────────────────────────

program
  .command("info <skillName>")
  .description("Show detailed info for a specific skill")
  .action(async (skillName: string) => {
    const spinner = ora({ text: `Looking up ${skillName}…`, color: "cyan" }).start();

    try {
      const res = await fetch(`${MARKETPLACE}/skills/${encodeURIComponent(skillName)}`);

      if (res.status === 404) {
        spinner.fail(chalk.red(`Skill "${skillName}" not found.`));
        process.exit(1);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const s = (await res.json()) as SkillRecord;
      spinner.stop();

      const needsParam = /:address|:token/.test(s.endpoint);

      console.log();
      console.log(`  ${chalk.bold.white(s.name)}`);
      console.log(chalk.dim("  ───────────────────────────────────────────"));
      console.log(`  ${chalk.dim("Description:")}  ${s.description}`);
      console.log(`  ${chalk.dim("Price:")}        ${chalk.green("$" + s.price_usd.toFixed(3))} USDC per call`);
      console.log(`  ${chalk.dim("Category:")}     ${chalk.cyan(s.category)}`);
      console.log(`  ${chalk.dim("Endpoint:")}     ${chalk.gray(s.endpoint)}`);
      console.log(`  ${chalk.dim("Needs param:")}  ${needsParam ? chalk.yellow("yes — EVM address") : chalk.dim("no")}`);
      console.log(`  ${chalk.dim("Port:")}         ${s.port}`);
      console.log(`  ${chalk.dim("Total calls:")}  ${chalk.bold(String(s.usage_count))}`);
      console.log(`  ${chalk.dim("Publisher:")}    ${chalk.dim(s.publisher_wallet)}`);
      console.log(`  ${chalk.dim("Registered:")}   ${chalk.dim(s.created_at)}`);
      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ── skillbazaar balance ─────────────────────────────────────────────────────

program
  .command("balance")
  .description("Check your USDC wallet balance")
  .action(async () => {
    const spinner = ora({ text: "Fetching balance…", color: "cyan" }).start();

    try {
      const res = await fetch(`${MARKETPLACE}/wallet/balance`);
      const data = (await res.json()) as {
        balance_usdc: string;
        address: string;
        error?: string;
      };

      if (!res.ok) {
        spinner.fail(chalk.red(`Error: ${data.error}`));
        process.exit(1);
      }

      spinner.stop();
      console.log();
      console.log(
        `  💰  Balance: ${chalk.bold.green("$" + parseFloat(data.balance_usdc).toFixed(2) + " USDC")} on Base`
      );
      console.log(`      ${chalk.dim("Wallet: " + data.address)}`);
      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
