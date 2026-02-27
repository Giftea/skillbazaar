# SkillBazaar — Hackathon Demo Script

> **Before you hit record**
> - `npm run dev:marketplace` is running on port 3000
> - `npm run dev:skills` is running (ports 4001, 4002, 4003)
> - `npm run dev:frontend` is running on port 5173
> - Claude Desktop is open with the `skillbazaar` MCP config loaded
> - Browser is at `http://localhost:5173`, window is full screen
> - Terminal windows are hidden

---

## Scene 1 — The Marketplace UI

**[Camera: browser, full screen]**

> "This is SkillBazaar — a pay-per-use marketplace for on-chain AI skills,
> built on top of the x402 payment protocol and Base."

*Pause. Let the UI sit for a moment. Let the audience read the three cards.*

> "Every skill here is a live microservice running on Base mainnet.
> You browse it like an app store, and you pay only when you use it —
> automatically, in USDC, with no wallet popups, no approvals, no friction."

*Slowly move the mouse over each card, one by one.*

> "Three skills are live right now."

*Hover over **contract-auditor**. Let the card lift.*

> "Contract Auditor — audits any EVM smart contract for risk signals.
> Five cents per call."

*Hover over **wallet-scorer**.*

> "Wallet Scorer — scores a wallet's on-chain history and USDC holdings.
> Three cents."

*Hover over **gas-estimator**.*

> "And Gas Estimator — pulls live gas prices from Base and gives you
> cost estimates for common transaction types. Two cents."

*Point cursor at the stats bar — total skills, categories, total calls, avg price.*

> "Every call is tracked. Usage counts update in real time as payments flow
> through x402."

---

## Scene 2 — Try It via the UI

**[Camera: browser, still full screen]**

> "Let's try one live, right now."

*Click the **gas-estimator** card. The modal opens.*

> "The Gas Estimator takes no parameters — it just reads the current Base
> network state. I'll hit Execute."

*Click the **Execute** button. Pause on the spinner for 1–2 seconds.*

> "What's happening right now: the marketplace is calling `payX402Service`
> under the hood, which submits an EIP-3009 signed USDC transfer directly
> on Base — no wallet popup, no MetaMask, nothing."

*The JSON result appears. Move cursor slowly over the response fields.*

> "And there it is. Live gas price from Base, cost estimates for a token
> transfer, a contract call, an NFT mint — fetched and paid for in one
> round trip."

*Point at the "Paid $0.02 USDC" confirmation line.*

> "Two cents, paid on-chain, automatically. That's x402."

*Close the modal. Point at the usage count on the gas-estimator card.*

> "Notice the usage count just ticked up. Every paid call is recorded."

---

## Scene 3 — Claude Using SkillBazaar Autonomously

**[Switch to Claude Desktop. Full screen.]**

> "Now here's where it gets interesting."

*Show Claude Desktop with the SkillBazaar MCP tools visible in the sidebar
or tool list. Point to it briefly.*

> "I've registered SkillBazaar as an MCP server in Claude. That means Claude
> can browse the marketplace, select skills, and pay for them — on its own,
> without me doing anything."

*Click into the chat input. Type slowly so the audience can read:*

```
Check my SkillBazaar balance, then browse available skills,
then audit this contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

*Hit Enter. Don't talk while Claude is processing — let the tool calls speak.*

*As `check_balance` fires:*

> "Claude is checking the wallet balance first — confirming there's enough
> USDC to pay for what's coming."

*As `list_skills` fires:*

> "Now it's browsing the marketplace. It sees the three skills, reads the
> prices and descriptions, and decides which one fits the task."

*As `execute_skill` fires with `contract-auditor`:*

> "And now it's executing. No prompt from me. Claude chose the right skill,
> passed the contract address as the parameter, and `payX402Service` is
> handling the payment on Base right now."

*The result comes back. Move cursor over the JSON output — `is_contract`,
`risk_signals`, `score`.*

> "On-chain audit. Risk signals pulled directly from Base RPC.
> Claude is reading this result and will summarise it for me."

*Let Claude's summary text finish rendering.*

> "Five cents, paid automatically. Claude didn't ask me to approve anything.
> It found the skill, evaluated the price, paid it, and returned the answer.
> That's the whole point."

---

## Scene 4 — The Stats Updated

**[Switch back to the browser at http://localhost:5173]**

*Refresh the page. Let it reload.*

> "Back in the marketplace UI — let's refresh."

*Point at the usage counts on each card.*

> "Usage counts have updated. The contract-auditor now shows one more call —
> the one Claude just made."

*Point at the stats bar — total calls number.*

> "Total calls across the marketplace have incremented."

*Optional: if you want to show the balance route — open browser dev tools or
a terminal and hit `curl http://localhost:3000/wallet/balance`.*

> "And the wallet balance has decreased by exactly the cost of that audit.
> No rounding, no gas fees absorbed by the user — the skill publisher receives
> the payment directly, settled on Base."

*Pause. Pull back to show the full UI.*

> "SkillBazaar. Browse, pay, execute — in one step, on-chain.
> Skills are a primitive. x402 is the payment layer. And now Claude can shop."

---

## Timing Guide

| Scene | Target duration |
|-------|----------------|
| Scene 1 — UI walkthrough | ~60 seconds |
| Scene 2 — Try It in browser | ~45 seconds |
| Scene 3 — Claude MCP demo | ~90 seconds |
| Scene 4 — Stats refresh | ~30 seconds |
| **Total** | **~3.5 minutes** |

---

## Backup Lines (if something goes wrong)

**If the skill call times out:**
> "The skill server is returning a 402 — that's actually the x402 protocol
> at work, requiring payment before serving the response. Let me make sure
> the marketplace wallet has USDC funded."

**If Claude doesn't pick up the MCP tools:**
> "Let me confirm the MCP server is connected — you can see the skillbazaar
> tools registered here."  *(point to MCP tool list in Claude Desktop)*

**If usage count doesn't increment:**
> "The count updates on the next marketplace poll — let me hit refresh."
