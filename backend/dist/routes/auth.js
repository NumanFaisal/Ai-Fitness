"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
exports.authRouter = (0, express_1.Router)();
const AuthSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
// POST /auth/register
exports.authRouter.post("/register", async (req, res) => {
    const parse = AuthSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: parse.error.errors[0]?.message || "Invalid email or password." });
    }
    const { email, password } = parse.data;
    const normalizedEmail = email.toLowerCase().trim();
    // 1. Check if user already exists
    const existingLocal = (0, db_1.findUserByEmail)(normalizedEmail);
    if (existingLocal) {
        return res.status(409).json({ message: "An account with this email already exists. Please log in." });
    }
    try {
        const existingPrisma = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingPrisma) {
            return res.status(409).json({ message: "An account with this email already exists. Please log in." });
        }
    }
    catch {
        // Prisma offline, proceed with persistent file store
    }
    // 2. Hash password with bcrypt
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    // 3. Create persistent account
    let userId;
    try {
        const prismaUser = await db_1.prisma.user.create({
            data: { email: normalizedEmail, passwordHash },
            select: { id: true, email: true },
        });
        userId = prismaUser.id;
    }
    catch {
        // Fallback to persistent disk store
        const localUser = (0, db_1.createUserAccount)(normalizedEmail, passwordHash);
        userId = localUser.id;
    }
    // Always mirror in disk store with the same ID
    (0, db_1.createUserAccount)(normalizedEmail, passwordHash, userId);
    (0, db_1.getUserState)(userId);
    const token = (0, auth_1.signToken)({ userId, email: normalizedEmail });
    return res.status(201).json({
        user: { id: userId, email: normalizedEmail },
        token,
    });
});
// POST /auth/login
exports.authRouter.post("/login", async (req, res) => {
    const parse = AuthSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid email or password format." });
    }
    const { email, password } = parse.data;
    const normalizedEmail = email.toLowerCase().trim();
    let user = null;
    // 1. Check PostgreSQL first if available to prioritize canonical DB ID
    try {
        const dbUser = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (dbUser) {
            user = { id: dbUser.id, email: dbUser.email, passwordHash: dbUser.passwordHash };
            // Synchronize disk store with canonical DB ID
            (0, db_1.createUserAccount)(normalizedEmail, dbUser.passwordHash, dbUser.id);
        }
    }
    catch {
        // Prisma offline
    }
    // 2. Check persistent disk store if not found in DB
    if (!user) {
        const diskUser = (0, db_1.findUserByEmail)(normalizedEmail);
        if (diskUser) {
            user = diskUser;
        }
    }
    if (!user) {
        // Check if logging in as dev user
        if (normalizedEmail === "dev@fitness.local" || normalizedEmail === "admin@fitness.local") {
            const token = (0, auth_1.signToken)({ userId: auth_1.DEV_USER_ID, email: normalizedEmail });
            return res.json({ user: { id: auth_1.DEV_USER_ID, email: normalizedEmail }, token });
        }
        return res.status(401).json({ message: "No account found with this email. Please sign up." });
    }
    // 2. Securely verify password with bcrypt
    const matches = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!matches) {
        return res.status(401).json({ message: "Incorrect password. Please try again." });
    }
    const token = (0, auth_1.signToken)({ userId: user.id, email: user.email });
    return res.json({ user: { id: user.id, email: user.email }, token });
});
// GET /auth/me
exports.authRouter.get("/me", auth_1.authMiddleware, (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: "Unauthenticated" });
    return res.json({ user });
});
