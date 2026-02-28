import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import routes from "./routes.js";
import { initDB } from "./registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve the built frontend relative to this file:
// src/marketplace/server.ts → ../../src/frontend/dist
const FRONTEND_DIST = join(__dirname, "../../src/frontend/dist");

const PORT = parseInt(process.env.PORT ?? "3000", 10);

initDB();

const app = express();

app.use(express.json());

// Request logger: [METHOD] /path - timestamp
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${req.method}] ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use("/api", routes);

// Serve built frontend in production (when FRONTEND_DIST exists)
import { existsSync } from "fs";
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback — send index.html for any non-API route
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(join(FRONTEND_DIST, "index.html"));
  });
}

// Global error handler — prevents stack traces from leaking to clients
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = app.listen(PORT, () => {
  console.log(`SkillBazaar marketplace running on http://localhost:${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`[marketplace] ${signal} received, shutting down...`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[marketplace] Unhandled:', err));
