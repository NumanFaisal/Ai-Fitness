import { Router, Response } from "express";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth";
import { getUserState } from "../db";
import {
  executeFitnessAgent,
  getConversationHistory,
  getOrCreateConversation,
} from "../services/aiAgentService";
import { coachActionService } from "../services/coachActionService";
import { personalizationContextBuilder } from "../services/personalizationContextBuilder";
import { calculateHydration } from "../engines/hydrationEngine";

export const coachRouter = Router();

coachRouter.use(authMiddleware);

/**
 * POST /chat or POST /coach/chat
 * Standard conversational response or SSE streaming when Accept: text/event-stream
 */
coachRouter.post("/chat", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const message: string = (req.body.message || "").trim();
  const conversationId: string | undefined = req.body.conversationId;

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
      const agentResponse = await executeFitnessAgent(userId, message, conversationId);

      // Stream words or chunks for real-time responsiveness
      const words = agentResponse.content.split(" ");
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join(" ") + " ";
        res.write(`data: ${JSON.stringify({ chunk, isComplete: false })}\n\n`);
        // Small yield
        await new Promise((r) => setTimeout(r, 20));
      }

      // Final event with complete payload and app vitals
      res.write(
        `data: ${JSON.stringify({
          chunk: "",
          isComplete: true,
          response: agentResponse,
        })}\n\n`
      );
      res.write("event: done\ndata: {}\n\n");
      return res.end();
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err?.message || "Stream error" })}\n\n`);
      return res.end();
    }
  }

  const agentResponse = await executeFitnessAgent(userId, message, conversationId);
  return res.json(agentResponse);
});

/**
 * POST /chat/stream
 * Dedicated explicit SSE streaming endpoint
 */
coachRouter.post("/chat/stream", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const message: string = (req.body.message || "").trim();
  const conversationId: string | undefined = req.body.conversationId;

  if (!message) {
    return res.status(400).json({ message: "Message cannot be empty." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const agentResponse = await executeFitnessAgent(userId, message, conversationId);
    const words = agentResponse.content.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(" ") + " ";
      res.write(`data: ${JSON.stringify({ chunk, isComplete: false })}\n\n`);
      await new Promise((r) => setTimeout(r, 20));
    }

    res.write(
      `data: ${JSON.stringify({
        chunk: "",
        isComplete: true,
        response: agentResponse,
      })}\n\n`
    );
    res.write("event: done\ndata: {}\n\n");
    return res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err?.message || "Stream error" })}\n\n`);
    return res.end();
  }
});

/**
 * GET /history/:conversationId
 * Returns the recorded messages in a conversation
 */
coachRouter.get("/history/:conversationId", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const conversationId = req.params.conversationId;
  const convo = getConversationHistory(userId, conversationId);

  if (!convo) {
    return res.status(404).json({ message: "Conversation not found." });
  }

  return res.json(convo);
});

/**
 * GET /history
 * Returns the user's latest conversation
 */
coachRouter.get("/history", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const convo = getOrCreateConversation(userId);
  return res.json(convo);
});

/**
 * GET /vitals
 * Returns live authoritative app vitals (calories, protein, hydration, weight, focus)
 */
coachRouter.get("/vitals", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const context = await personalizationContextBuilder.buildContext(userId);

  const currentWeight = context.profile.weightKg;
  const currentCalories = userState.nutritionPlan?.calorieTarget?.value || context.nutrition.authoritativeCalorieTarget;
  const currentProtein = userState.nutritionPlan?.proteinTargetG?.value || context.nutrition.authoritativeProteinTarget || 150;
  const hydration = calculateHydration({
    weightKg: currentWeight,
    sessionDurationMin: context.training.sessionDurationMin,
  });
  const waterConsumed = userState.waterLogs.reduce((acc, l) => acc + l.amountMl, 0);
  const todayDayOfWeek = new Date().getDay();
  const todayWorkout =
    userState.workoutPlan?.days?.find((d: any) => d.dayOfWeek === todayDayOfWeek) ||
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
coachRouter.post("/action", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const rawAction = req.body;

  if (!rawAction || !rawAction.action) {
    return res.status(400).json({
      success: false,
      message: "Action payload must contain 'action' and 'parameters'.",
    });
  }

  const result = await coachActionService.executeAction(userId, rawAction);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});
