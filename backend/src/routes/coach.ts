import { Router, Response } from "express";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth";
import { executeFitnessAgent } from "../services/aiAgentService";

export const coachRouter = Router();

coachRouter.use(authMiddleware);

coachRouter.post("/chat", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const message: string = (req.body.message || "").trim();

  if (!message) {
    return res.status(400).json({ message: "Message cannot be empty." });
  }

  const agentResponse = await executeFitnessAgent(userId, message);

  return res.json(agentResponse);
});
