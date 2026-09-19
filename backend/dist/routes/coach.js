"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coachRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const aiAgentService_1 = require("../services/aiAgentService");
const coachActionService_1 = require("../services/coachActionService");
const personalizationContextBuilder_1 = require("../services/personalizationContextBuilder");
const hydrationEngine_1 = require("../engines/hydrationEngine");
exports.coachRouter = (0, express_1.Router)();
exports.coachRouter.use(auth_1.authMiddleware);
/**
 * POST /chat or POST /coach/chat
 * Standard conversational response or SSE streaming when Accept: text/event-stream
 */
exports.coachRouter.post("/chat", async (req, res) => {
    const userId = req.user.userId;
    const message = (req.body.message || "").trim();
    const conversationId = req.body.conversationId;
    if (!message) {
        return res.status(400).json({ message: "Message cannot be empty." });
    }
    // Check if client requested Server-Sent Events (SSE) streaming
    const acceptsSSE = req.headers.accept === "text/event-stream" || req.query.stream === "true";
    if (acceptsSSE) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();
        try {
            const agentResponse = await (0, aiAgentService_1.executeFitnessAgent)(userId, message, conversationId);
            // Stream words or chunks for real-time responsiveness
            const words = agentResponse.content.split(" ");
            for (let i = 0; i < words.length; i += 3) {
                const chunk = words.slice(i, i + 3).join(" ") + " ";
                res.write(`data: ${JSON.stringify({ chunk, isComplete: false })}\n\n`);
                // Small yield
                await new Promise((r) => setTimeout(r, 20));
            }
            // Final event with complete payload and app vitals
            res.write(`data: ${JSON.stringify({
                chunk: "",
                isComplete: true,
                response: agentResponse,
            })}\n\n`);
            res.write("event: done\ndata: {}\n\n");
            return res.end();
        }
        catch (err) {
            res.write(`data: ${JSON.stringify({ error: err?.message || "Stream error" })}\n\n`);
            return res.end();
        }
    }
    const agentResponse = await (0, aiAgentService_1.executeFitnessAgent)(userId, message, conversationId);
    return res.json(agentResponse);
});
/**
 * POST /chat/stream
 * Dedicated explicit SSE streaming endpoint
 */
exports.coachRouter.post("/chat/stream", async (req, res) => {
    const userId = req.user.userId;
    const message = (req.body.message || "").trim();
    const conversationId = req.body.conversationId;
    if (!message) {
        return res.status(400).json({ message: "Message cannot be empty." });
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    try {
        const agentResponse = await (0, aiAgentService_1.executeFitnessAgent)(userId, message, conversationId);
        const words = agentResponse.content.split(" ");
        for (let i = 0; i < words.length; i += 3) {
            const chunk = words.slice(i, i + 3).join(" ") + " ";
            res.write(`data: ${JSON.stringify({ chunk, isComplete: false })}\n\n`);
            await new Promise((r) => setTimeout(r, 20));
        }
        res.write(`data: ${JSON.stringify({
            chunk: "",
            isComplete: true,
            response: agentResponse,
        })}\n\n`);
        res.write("event: done\ndata: {}\n\n");
        return res.end();
    }
    catch (err) {
        res.write(`data: ${JSON.stringify({ error: err?.message || "Stream error" })}\n\n`);
        return res.end();
    }
});
/**
 * GET /history/:conversationId
 * Returns the recorded messages in a conversation
 */
exports.coachRouter.get("/history/:conversationId", (req, res) => {
    const userId = req.user.userId;
    const conversationId = req.params.conversationId;
    const convo = (0, aiAgentService_1.getConversationHistory)(userId, conversationId);
    if (!convo) {
        return res.status(404).json({ message: "Conversation not found." });
    }
    return res.json(convo);
});
/**
 * GET /history
 * Returns the user's latest conversation
 */
exports.coachRouter.get("/history", (req, res) => {
    const userId = req.user.userId;
    const convo = (0, aiAgentService_1.getOrCreateConversation)(userId);
    return res.json(convo);
});
/**
 * GET /vitals
 * Returns live authoritative app vitals (calories, protein, hydration, weight, focus)
 */
exports.coachRouter.get("/vitals", async (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const context = await personalizationContextBuilder_1.personalizationContextBuilder.buildContext(userId);
    const currentWeight = context.profile.weightKg;
    const currentCalories = userState.nutritionPlan?.calorieTarget?.value || context.nutrition.authoritativeCalorieTarget;
    const currentProtein = userState.nutritionPlan?.proteinTargetG?.value || context.nutrition.authoritativeProteinTarget || 150;
    const hydration = (0, hydrationEngine_1.calculateHydration)({
        weightKg: currentWeight,
        sessionDurationMin: context.training.sessionDurationMin,
    });
    const waterConsumed = userState.waterLogs.reduce((acc, l) => acc + l.amountMl, 0);
    const todayDayOfWeek = new Date().getDay();
    const todayWorkout = userState.workoutPlan?.days?.find((d) => d.dayOfWeek === todayDayOfWeek) ||
        userState.workoutPlan?.days?.[0];
    return res.json({
        weightKg: currentWeight,
        calorieTarget: currentCalories,
        proteinTarget: currentProtein,
        waterConsumedMl: waterConsumed,
        waterTargetMl: hydration.targetMl,
        todayWorkoutFocus: todayWorkout?.focus || "Active Training",
        goal: context.goal.type.replace(/_/g, " "),
    });
});
/**
 * POST /action
 * Execute a structured coach action with Zod schema validation and safety gating
 */
exports.coachRouter.post("/action", async (req, res) => {
    const userId = req.user.userId;
    const rawAction = req.body;
    if (!rawAction || !rawAction.action) {
        return res.status(400).json({
            success: false,
            message: "Action payload must contain 'action' and 'parameters'.",
        });
    }
    const result = await coachActionService_1.coachActionService.executeAction(userId, rawAction);
    if (!result.success) {
        return res.status(400).json(result);
    }
    return res.json(result);
});
