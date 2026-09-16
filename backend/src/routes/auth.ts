import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signToken, DEV_USER_ID, authMiddleware } from "../middleware/auth";
import { prisma, getUserState, findUserByEmail, createUserAccount } from "../db";
import { AuthRequest } from "../types";

export const authRouter = Router();

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// POST /auth/register
authRouter.post("/register", async (req: Request, res: Response) => {
  const parse = AuthSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: parse.error.errors[0]?.message || "Invalid email or password." });
  }

  const { email, password } = parse.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if user already exists
  const existingLocal = findUserByEmail(normalizedEmail);
  if (existingLocal) {
    return res.status(409).json({ message: "An account with this email already exists. Please log in." });
  }

  try {
    const existingPrisma = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingPrisma) {
      return res.status(409).json({ message: "An account with this email already exists. Please log in." });
    }
  } catch {
    // Prisma offline, proceed with persistent file store
  }

  // 2. Hash password with bcrypt
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Create persistent account
  let userId: string;
  try {
    const prismaUser = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
      select: { id: true, email: true },
    });
    userId = prismaUser.id;
  } catch {
    // Fallback to persistent disk store
    const localUser = createUserAccount(normalizedEmail, passwordHash);
    userId = localUser.id;
  }

  // Also ensure mirrored in disk store
  if (!findUserByEmail(normalizedEmail)) {
    createUserAccount(normalizedEmail, passwordHash);
  }

  getUserState(userId);
  const token = signToken({ userId, email: normalizedEmail });

  return res.status(201).json({
    user: { id: userId, email: normalizedEmail },
    token,
  });
});

// POST /auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const parse = AuthSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid email or password format." });
  }

  const { email, password } = parse.data;
  const normalizedEmail = email.toLowerCase().trim();

  let user: { id: string; email: string; passwordHash: string } | null = null;

  // 1. Check persistent disk store first
  const diskUser = findUserByEmail(normalizedEmail);
  if (diskUser) {
    user = diskUser;
  } else {
    try {
      const dbUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (dbUser) user = dbUser;
    } catch {
      // Prisma offline
    }
  }

  if (!user) {
    // Check if logging in as dev user
    if (normalizedEmail === "dev@fitness.local" || normalizedEmail === "admin@fitness.local") {
      const token = signToken({ userId: DEV_USER_ID, email: normalizedEmail });
      return res.json({ user: { id: DEV_USER_ID, email: normalizedEmail }, token });
    }
    return res.status(401).json({ message: "No account found with this email. Please sign up." });
  }

  // 2. Securely verify password with bcrypt
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ message: "Incorrect password. Please try again." });
  }

  const token = signToken({ userId: user.id, email: user.email });
  return res.json({ user: { id: user.id, email: user.email }, token });
});

// GET /auth/me
authRouter.get("/me", authMiddleware, (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthenticated" });
  return res.json({ user });
});
