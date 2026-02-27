import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import routes from "./routes.js";
import { initDB } from "./registry.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

initDB();

const app = express();

app.use(express.json());

// Request logger: [METHOD] /path - timestamp
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${req.method}] ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use("/", routes);

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
