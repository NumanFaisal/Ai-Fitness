import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth";
import { onboardingRouter } from "./routes/onboarding";
import { planRouter } from "./routes/plan";
import { coachRouter } from "./routes/coach";
import { mediaRouter } from "./routes/media";

dotenv.config(); // Supabase PostgreSQL 17 active

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Health Check & Root
app.get("/", (_req, res) => {
  res.json({
    name: "Fitness Transformation API",
    status: "online",
    health: "/health",
    version: "0.1.0",
  });
});

import { prisma } from "./db";

app.get("/health", async (_req, res) => {
  let dbStatus = "unknown";
  let dbLatencyMs: number | null = null;
  const start = Date.now();

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB probe timeout")), 6000)),
    ]);
    dbStatus = "connected";
    dbLatencyMs = Date.now() - start;
  } catch (err: any) {
    dbStatus = "disconnected (fallback to persistent store)";
  }

  const uptimeSeconds = Math.round(process.uptime());
  const mem = process.memoryUsage();

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      provider: "postgresql/supabase",
    },
    system: {
      uptimeSeconds,
      nodeVersion: process.version,
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
    },
  });
});

// Mount Routes
app.use("/auth", authRouter);
app.use("/", onboardingRouter); // /profile, /profile/fitness, /goals
app.use("/", planRouter);       // /analysis/start, /workout/today, /nutrition/today, /water, etc.
app.use("/ai", coachRouter);     // /ai/chat
app.use("/coach", coachRouter);  // /coach/chat, /coach/action, /coach/history
app.use("/api/coach", coachRouter); // /api/coach/chat, /api/coach/action
app.use("/media", mediaRouter);  // /media/upload, /media/status

// Global 404 Handler
app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint not found." });
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal server error." });
});

const portNumber = typeof PORT === "string" ? parseInt(PORT, 10) : PORT;

app.listen(portNumber, "0.0.0.0", () => {
  console.log(`Fitness Backend API server running on http://0.0.0.0:${portNumber}`);
});

export default app;
