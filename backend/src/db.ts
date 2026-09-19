import { PrismaClient } from "@prisma/client";
import postgres from "postgres";

// Supabase Direct Postgres Client
const connectionString = process.env.DATABASE_URL || "";
export const sql = postgres(connectionString);

// Global Prisma instance
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// In-memory runtime cache for quick development and offline engine execution
export interface UserSessionState {
  profile?: {
    name: string;
    age: number;
    sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    heightCm: number;
    weightKg?: number;
  };
  fitnessProfile?: {
    experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    trainingEnvironment: "GYM" | "HOME" | "OUTDOOR";
    equipmentAvailable: string[];
    workoutDaysPerWeek: number;
    sessionDurationMin: number;
    injuries: string[];
    physicalLimitations: string[];
    dietaryPreference: string;
    allergies: string[];
    dislikedFoods: string[];
    cuisinePreferences: string[];
    budgetTier: "LOW" | "MEDIUM" | "FLEXIBLE";
    targetDate?: string;
  };
  goal?: {
    type: "FAT_LOSS" | "MUSCLE_GAIN" | "RECOMPOSITION" | "STRENGTH" | "ENDURANCE" | "GENERAL_FITNESS" | "ATHLETIC_PERFORMANCE" | "MAINTENANCE";
    isPrimary: boolean;
  };
  workoutPlan?: any;
  nutritionPlan?: any;
  waterLogs: { amountMl: number; loggedAt: Date }[];
  jobs: Map<string, { status: "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED"; result?: any; error?: string }>;
  hasCompletedOnboarding?: boolean;
  bodyPhotos?: { frontUrl?: string; sideUrl?: string; backUrl?: string; analysis?: any; [key: string]: any };
}

import fs from "fs";
import path from "path";
import { calculateNutrition } from "./engines/nutritionEngine";
import { generateWorkoutPlan } from "./engines/workoutEngine";

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "db_store.json");

function loadStoreFromDisk(): Record<string, any> {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("Failed to read db_store.json:", err);
  }
  return {};
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export function findUserByEmail(email: string): UserAccount | null {
  const store = loadStoreFromDisk();
  const users: Record<string, UserAccount> = store._users || {};
  return Object.values(users).find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function createUserAccount(email: string, passwordHash: string, customId?: string): UserAccount {
  const store = loadStoreFromDisk();
  if (!store._users) store._users = {};
  const normalizedEmail = email.toLowerCase().trim();

  // If user with this email already exists in disk store, preserve or update
  const existingKey = Object.keys(store._users).find(
    (k) => store._users[k].email?.toLowerCase() === normalizedEmail
  );

  const id = customId || (existingKey ? store._users[existingKey].id : `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  const account: UserAccount = {
    id,
    email: normalizedEmail,
    passwordHash,
    createdAt: existingKey ? store._users[existingKey].createdAt : new Date().toISOString(),
  };

  // Clean up old key if customId changed it
  if (existingKey && existingKey !== id) {
    delete store._users[existingKey];
    if (store[existingKey] && !store[id]) {
      store[id] = store[existingKey];
      delete store[existingKey];
    }
  }

  store._users[id] = account;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  return account;
}

export async function ensureUserExists(userId: string, email?: string): Promise<string> {
  try {
    const existingById = await prisma.user.findUnique({ where: { id: userId } });
    if (existingById) return existingById.id;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingByEmail) return existingByEmail.id;
    }

    const userEmail = (email || `${userId}@fitness.local`).toLowerCase().trim();
    const created = await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        passwordHash: "dev-password-hash",
      },
    });
    return created.id;
  } catch (err: any) {
    console.warn("ensureUserExists DB notice:", err?.message || err);
    if (email) {
      try {
        const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (u) return u.id;
      } catch {}
    }
    return userId;
  }
}

export async function clearAllDatabaseData(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const deleted = await prisma.user.deleteMany({});
    await prisma.workoutExercise.deleteMany({}).catch(() => ({ count: 0 }));
    await prisma.workoutDay.deleteMany({}).catch(() => ({ count: 0 }));
    await prisma.workoutPlan.deleteMany({}).catch(() => ({ count: 0 }));
    await prisma.meal.deleteMany({}).catch(() => ({ count: 0 }));
    await prisma.nutritionPlan.deleteMany({}).catch(() => ({ count: 0 }));
    await prisma.photoAnalysis.deleteMany({}).catch(() => ({ count: 0 }));

    memoryStore.clear();
    if (fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2), "utf-8");
    }

    return { success: true, deletedCount: deleted.count };
  } catch (err: any) {
    console.error("clearAllDatabaseData error:", err);
    throw err;
  }
}

export function saveUserState(userId: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = loadStoreFromDisk();
    const state = memoryStore.get(userId);
    if (state) {
      current[userId] = {
        profile: state.profile,
        fitnessProfile: state.fitnessProfile,
        goal: state.goal,
        nutritionPlan: state.nutritionPlan,
        workoutPlan: state.workoutPlan,
        waterLogs: state.waterLogs,
        reminders: (state as any).reminders,
        aiPlan: (state as any).aiPlan,
        aiMeals: (state as any).aiMeals,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        bodyPhotos: state.bodyPhotos,
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(current, null, 2), "utf-8");
    }
  } catch (err) {
    console.warn("Failed to persist user state to disk:", err);
  }
}

const memoryStore = new Map<string, UserSessionState>();

export function getUserState(userId: string): UserSessionState {
  if (!memoryStore.has(userId)) {
    // 1. Try loading from persistent disk database
    const diskData = loadStoreFromDisk();
    if (diskData[userId]) {
      const saved = diskData[userId];
      memoryStore.set(userId, {
        profile: saved.profile,
        fitnessProfile: saved.fitnessProfile,
        goal: saved.goal,
        nutritionPlan: saved.nutritionPlan,
        workoutPlan: saved.workoutPlan,
        waterLogs: saved.waterLogs || [],
        jobs: new Map(),
        hasCompletedOnboarding: Boolean(saved.hasCompletedOnboarding),
        bodyPhotos: saved.bodyPhotos,
      });
      const st = memoryStore.get(userId)!;
      if (saved.reminders) (st as any).reminders = saved.reminders;
      if (saved.aiPlan) (st as any).aiPlan = saved.aiPlan;
      if (saved.aiMeals) (st as any).aiMeals = saved.aiMeals;
    } else {
      // 2. Initialize default profile and engines
      const defaultProfile: UserSessionState["profile"] = {
        name: "Athlete",
        age: 25,
        sex: "MALE",
        heightCm: 178,
        weightKg: 75,
      };

      const defaultFitness: UserSessionState["fitnessProfile"] = {
        experienceLevel: "BEGINNER",
        trainingEnvironment: "GYM",
        equipmentAvailable: ["barbell", "dumbbell", "cables", "bench", "pullup_bar"],
        workoutDaysPerWeek: 4,
        sessionDurationMin: 45,
        injuries: [],
        physicalLimitations: [],
        dietaryPreference: "High Protein / Balanced",
        allergies: [],
        dislikedFoods: [],
        cuisinePreferences: ["mediterranean", "healthy"],
        budgetTier: "MEDIUM",
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };

      const defaultGoal: UserSessionState["goal"] = {
        type: "MUSCLE_GAIN",
        isPrimary: true,
      };

      const nutrition = calculateNutrition({
        weightKg: defaultProfile.weightKg || 75,
        heightCm: defaultProfile.heightCm || 178,
        age: defaultProfile.age || 25,
        sex: defaultProfile.sex || "MALE",
        workoutDaysPerWeek: defaultFitness.workoutDaysPerWeek || 4,
        goal: defaultGoal.type || "MUSCLE_GAIN",
        budgetTier: defaultFitness.budgetTier || "MEDIUM",
      });

      const workout = generateWorkoutPlan({
        experienceLevel: defaultFitness.experienceLevel || "BEGINNER",
        trainingEnvironment: defaultFitness.trainingEnvironment || "GYM",
        equipmentAvailable: defaultFitness.equipmentAvailable || ["barbell", "dumbbell"],
        workoutDaysPerWeek: defaultFitness.workoutDaysPerWeek || 4,
        sessionDurationMin: defaultFitness.sessionDurationMin || 45,
        injuries: defaultFitness.injuries || [],
        goal: defaultGoal.type || "MUSCLE_GAIN",
      });

      memoryStore.set(userId, {
        profile: defaultProfile,
        fitnessProfile: defaultFitness,
        goal: defaultGoal,
        nutritionPlan: nutrition,
        workoutPlan: workout,
        waterLogs: [],
        jobs: new Map(),
        hasCompletedOnboarding: false,
      });

      saveUserState(userId);
    }
  }

  const state = memoryStore.get(userId)!;

  // Guarantee plans exist even if profile was partially populated
  if (!state.nutritionPlan && state.profile) {
    state.nutritionPlan = calculateNutrition({
      weightKg: state.profile.weightKg || 75,
      heightCm: state.profile.heightCm || 178,
      age: state.profile.age || 25,
      sex: state.profile.sex || "MALE",
      workoutDaysPerWeek: state.fitnessProfile?.workoutDaysPerWeek || 4,
      goal: state.goal?.type || "MUSCLE_GAIN",
      budgetTier: state.fitnessProfile?.budgetTier || "MEDIUM",
    });
    saveUserState(userId);
  }

  if (!state.workoutPlan && state.fitnessProfile) {
    state.workoutPlan = generateWorkoutPlan({
      experienceLevel: state.fitnessProfile.experienceLevel || "BEGINNER",
      trainingEnvironment: state.fitnessProfile.trainingEnvironment || "GYM",
      equipmentAvailable: state.fitnessProfile.equipmentAvailable || ["barbell", "dumbbell"],
      workoutDaysPerWeek: state.fitnessProfile.workoutDaysPerWeek || 4,
      sessionDurationMin: state.fitnessProfile.sessionDurationMin || 45,
      injuries: state.fitnessProfile.injuries || [],
      goal: state.goal?.type || "MUSCLE_GAIN",
    });
    saveUserState(userId);
  }

  return state;
}
