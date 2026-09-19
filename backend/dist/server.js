"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const onboarding_1 = require("./routes/onboarding");
const plan_1 = require("./routes/plan");
const coach_1 = require("./routes/coach");
const media_1 = require("./routes/media");
dotenv_1.default.config(); // Supabase PostgreSQL 17 active
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "15mb" }));
// Health Check & Root
app.get("/", (_req, res) => {
    res.json({
        name: "Fitness Transformation API",
        status: "online",
        health: "/health",
        version: "0.1.0",
    });
});
const db_1 = require("./db");
app.get("/health", async (_req, res) => {
    let dbStatus = "unknown";
    let dbLatencyMs = null;
    const start = Date.now();
    try {
        await Promise.race([
            db_1.prisma.$queryRaw `SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error("DB probe timeout")), 6000)),
        ]);
        dbStatus = "connected";
        dbLatencyMs = Date.now() - start;
    }
    catch (err) {
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
app.use("/auth", auth_1.authRouter);
app.use("/", onboarding_1.onboardingRouter); // /profile, /profile/fitness, /goals
app.use("/", plan_1.planRouter); // /analysis/start, /workout/today, /nutrition/today, /water, etc.
app.use("/ai", coach_1.coachRouter); // /ai/chat
app.use("/coach", coach_1.coachRouter); // /coach/chat, /coach/action, /coach/history
app.use("/api/coach", coach_1.coachRouter); // /api/coach/chat, /api/coach/action
app.use("/media", media_1.mediaRouter); // /media/upload, /media/status
// Global 404 Handler
app.use((_req, res) => {
    res.status(404).json({ message: "Endpoint not found." });
});
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error("Server Error:", err);
    res.status(500).json({ message: "Internal server error." });
});
const portNumber = typeof PORT === "string" ? parseInt(PORT, 10) : PORT;
app.listen(portNumber, "0.0.0.0", () => {
    console.log(`Fitness Backend API server running on http://0.0.0.0:${portNumber}`);
});
exports.default = app;
