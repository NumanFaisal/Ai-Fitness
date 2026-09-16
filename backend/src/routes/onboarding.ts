import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth";
import { prisma, getUserState, saveUserState } from "../db";
import { calculateNutrition } from "../engines/nutritionEngine";
import { generateWorkoutPlan } from "../engines/workoutEngine";

export const onboardingRouter = Router();

onboardingRouter.use(authMiddleware);

const UserProfileSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(14).max(120),
  sex: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(30).max(300).optional(),
});

const FitnessProfileSchema = z.object({
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  trainingEnvironment: z.enum(["GYM", "HOME", "OUTDOOR"]),
  equipmentAvailable: z.array(z.string()),
  workoutDaysPerWeek: z.number().min(1).max(7),
  sessionDurationMin: z.number().min(15).max(180),
  injuries: z.array(z.string()),
  physicalLimitations: z.array(z.string()),
  dietaryPreference: z.string(),
  allergies: z.array(z.string()),
  dislikedFoods: z.array(z.string()),
  cuisinePreferences: z.array(z.string()),
  mealsPerDay: z.number().optional(),
  cookingAbility: z.string().optional(),
  budgetTier: z.enum(["LOW", "MEDIUM", "FLEXIBLE"]),
  targetDate: z.string().optional(),
});

const GoalSchema = z.object({
  type: z.enum([
    "FAT_LOSS",
    "MUSCLE_GAIN",
    "RECOMPOSITION",
    "STRENGTH",
    "ENDURANCE",
    "GENERAL_FITNESS",
    "ATHLETIC_PERFORMANCE",
    "MAINTENANCE",
  ]),
  isPrimary: z.boolean(),
});

async function ensureUserExists(userId: string, email?: string) {
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: email || `${userId}@fitness.local`,
        passwordHash: "dev-password-hash",
      },
    });
  } catch (err) {
    // Ignore if DB is unreachable
  }
}

onboardingRouter.post("/profile", async (req: AuthRequest, res: Response) => {
  const parse = UserProfileSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid profile data.", errors: parse.error.format() });
  }

  const userId = req.user!.userId;
  const userState = getUserState(userId);
  userState.profile = parse.data;
  saveUserState(userId);

  try {
    await ensureUserExists(userId, req.user?.email);
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...parse.data },
      update: parse.data,
    });
  } catch {
    // Persistent disk store populated above
  }

  return res.status(204).send();
});

onboardingRouter.post("/profile/fitness", async (req: AuthRequest, res: Response) => {
  const parse = FitnessProfileSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid fitness profile data.", errors: parse.error.format() });
  }

  const userId = req.user!.userId;
  const userState = getUserState(userId);
  userState.fitnessProfile = parse.data;
  saveUserState(userId);

  try {
    await ensureUserExists(userId, req.user?.email);
    await prisma.fitnessProfile.upsert({
      where: { userId },
      create: { userId, ...parse.data, targetDate: parse.data.targetDate ? new Date(parse.data.targetDate) : null },
      update: { ...parse.data, targetDate: parse.data.targetDate ? new Date(parse.data.targetDate) : null },
    });
  } catch {
    // Persistent disk store populated above
  }

  return res.status(204).send();
});

onboardingRouter.post("/goals", async (req: AuthRequest, res: Response) => {
  const parse = GoalSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid goal data.", errors: parse.error.format() });
  }

  const userId = req.user!.userId;
  const userState = getUserState(userId);
  userState.goal = parse.data;
  saveUserState(userId);

  try {
    await ensureUserExists(userId, req.user?.email);
    await prisma.goal.create({
      data: {
        userId,
        type: parse.data.type,
        isPrimary: parse.data.isPrimary,
      },
    });
  } catch {
    // Persistent disk store populated above
  }

  return res.status(204).send();
});

// GET /profile - Return current user profile, fitness profile, and goals
onboardingRouter.get("/profile", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  return res.json({
    profile: userState.profile,
    fitnessProfile: userState.fitnessProfile,
    goal: userState.goal,
  });
});

// GET /profile/target-body - Return comprehensive target body blueprint & roadmap
onboardingRouter.get("/profile/target-body", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  const profile = userState.profile || {
    name: "Athlete",
    age: 25,
    sex: "MALE" as const,
    heightCm: 178,
    weightKg: 75,
  };
  const fitness = userState.fitnessProfile || {
    experienceLevel: "BEGINNER" as const,
    trainingEnvironment: "GYM" as const,
    equipmentAvailable: ["barbell", "dumbbell"],
    workoutDaysPerWeek: 4,
    sessionDurationMin: 45,
    injuries: [],
    dietaryPreference: "High Protein",
    budgetTier: "MEDIUM" as const,
    targetDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split("T")[0],
  };
  const goal = userState.goal || {
    type: "MUSCLE_GAIN" as const,
    isPrimary: true,
  };
  const nutrition = userState.nutritionPlan;

  // Calculate body metrics
  const heightM = (profile.heightCm || 178) / 100;
  const currentWeight = profile.weightKg || 75;
  const currentBmi = Math.round((currentWeight / (heightM * heightM)) * 10) / 10;

  // Target estimation based on goal
  let targetWeightKg = currentWeight;
  let targetDescription = "Lean, athletic physique with balanced strength, dense muscle, and optimal stamina.";
  let calorieStrategy = "Maintenance caloric intake with progressive resistance stimulus.";
  let estimatedWeeks = 12;

  if (goal.type === "MUSCLE_GAIN" || goal.type === "STRENGTH") {
    targetWeightKg = Math.round(currentWeight + 4);
    targetDescription = "Hypertrophy focus: Pack on lean muscle mass, broad shoulders, dense chest, and muscular arms while keeping body fat controlled.";
    calorieStrategy = `Caloric surplus of +250-350 kcal/day (targeting ${nutrition?.calorieTarget?.value || 2700} kcal) to fuel protein synthesis without excess fat gain.`;
  } else if (goal.type === "FAT_LOSS") {
    targetWeightKg = Math.round(currentWeight - 6);
    targetDescription = "Fat loss focus: Chiseled abs, lower body fat percentage, vascularity, and defined muscular lines.";
    calorieStrategy = `Moderate deficit of -400-500 kcal/day (targeting ${nutrition?.calorieTarget?.value || 2100} kcal) while keeping protein high at ${nutrition?.proteinTargetG?.value || 160}g to preserve lean muscle.`;
  } else if (goal.type === "RECOMPOSITION") {
    targetWeightKg = currentWeight;
    targetDescription = "Body Recomposition: Simultaneously burn stubborn fat while building dense athletic muscle tissue.";
    calorieStrategy = `Eucaloric target (${nutrition?.calorieTarget?.value || 2400} kcal) with high protein (${nutrition?.proteinTargetG?.value || 165}g) and high workout intensity.`;
  }

  const blueprint = {
    currentStats: {
      name: profile.name || "Athlete",
      weightKg: currentWeight,
      heightCm: profile.heightCm,
      bmi: currentBmi,
      age: profile.age,
      sex: profile.sex,
    },
    targetPhysique: {
      goalType: goal.type,
      targetWeightKg,
      targetDescription,
      estimatedWeeks,
      targetDate: fitness.targetDate || new Date(Date.now() + estimatedWeeks * 7 * 24 * 3600 * 1000).toISOString().split("T")[0],
    },
    nutritionBlueprint: {
      calorieTarget: nutrition?.calorieTarget?.value || 2500,
      proteinTargetG: nutrition?.proteinTargetG?.value || 160,
      carbTargetG: nutrition?.carbTargetG?.value || 280,
      fatTargetG: nutrition?.fatTargetG?.value || 70,
      strategy: calorieStrategy,
      dailyMeals: 4,
      waterTargetMl: 3000,
    },
    trainingBlueprint: {
      environment: fitness.trainingEnvironment,
      experienceLevel: fitness.experienceLevel,
      daysPerWeek: fitness.workoutDaysPerWeek,
      sessionDurationMin: fitness.sessionDurationMin,
      focusSplit: userState.workoutPlan?.splitType || "UPPER_LOWER",
      progressiveOverloadRule: "Add 1-2 reps or 2-5% weight once top of rep range is reached cleanly.",
      cardioRecommendation: "20-30 min low-intensity steady-state (LISS) cardio 2x/week for cardiovascular recovery.",
    },
    transformationRoadmap: [
      {
        phase: "Phase 1: Adaptation & Neuromuscular Baseline",
        weeks: "Weeks 1 - 4",
        objective: "Establish form consistency, neurological muscle recruitment, and habit compliance.",
        keyMilestone: "Hit daily protein target 6+ days/week; complete all scheduled training sessions.",
      },
      {
        phase: "Phase 2: Progressive Hypertrophy & Overload",
        weeks: "Weeks 5 - 8",
        objective: "Maximize mechanical tension and progressive volume on compound exercises.",
        keyMilestone: "Noticeable increase in lift numbers and visible muscle pump/vascularity.",
      },
      {
        phase: "Phase 3: Body Refinement & Target Physique",
        weeks: "Weeks 9 - 12",
        objective: "Solidify body composition changes, muscle density, and sustainable lifestyle maintenance.",
        keyMilestone: "Target physique metrics achieved; compare with day-1 baseline.",
      },
    ],
    actionableHabits: [
      `Hit your daily protein target (${nutrition?.proteinTargetG?.value || 160}g) divided across 4 meals.`,
      "Track progressive overload: log your weights and strive to beat your previous session.",
      "Drink at least 3,000 ml of water daily to keep muscle cells hydrated.",
      "Get 7-8 hours of quality sleep for peak growth hormone release and muscle recovery.",
    ],
  };

  return res.json(blueprint);
});

// PUT /profile/edit - Update biometrics, goal, preferences and recalibrate plan
onboardingRouter.put("/profile/edit", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const {
    name,
    age,
    weightKg,
    heightCm,
    goal,
    dietaryPreference,
    budgetTier,
    workoutDaysPerWeek,
  } = req.body;

  // 1. Update Profile
  if (!userState.profile) {
    userState.profile = {
      name: name || "Athlete",
      age: Number(age) || 25,
      sex: "MALE",
      heightCm: Number(heightCm) || 175,
      weightKg: Number(weightKg) || 75,
    };
  } else {
    if (name) userState.profile.name = String(name).trim();
    if (age) userState.profile.age = Number(age);
    if (heightCm) userState.profile.heightCm = Number(heightCm);
    if (weightKg) userState.profile.weightKg = Number(weightKg);
  }

  // 2. Update Fitness Profile
  if (!userState.fitnessProfile) {
    userState.fitnessProfile = {
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell"],
      workoutDaysPerWeek: Number(workoutDaysPerWeek) || 4,
      sessionDurationMin: 45,
      injuries: [],
      physicalLimitations: [],
      dietaryPreference: dietaryPreference || "None",
      allergies: [],
      dislikedFoods: [],
      cuisinePreferences: [],
      budgetTier: budgetTier || "MEDIUM",
    };
  } else {
    if (dietaryPreference) userState.fitnessProfile.dietaryPreference = String(dietaryPreference);
    if (budgetTier) userState.fitnessProfile.budgetTier = budgetTier;
    if (workoutDaysPerWeek) userState.fitnessProfile.workoutDaysPerWeek = Number(workoutDaysPerWeek);
  }

  // 3. Update Goal
  if (goal) {
    userState.goal = { type: goal, isPrimary: true };
  }

  // 4. Recalibrate Nutrition
  const recalculatedNutrition = calculateNutrition({
    weightKg: userState.profile.weightKg || 75,
    heightCm: userState.profile.heightCm || 175,
    age: userState.profile.age || 25,
    sex: userState.profile.sex || "MALE",
    workoutDaysPerWeek: userState.fitnessProfile.workoutDaysPerWeek || 4,
    goal: userState.goal?.type || "GENERAL_FITNESS",
    budgetTier: userState.fitnessProfile.budgetTier || "MEDIUM",
  });
  userState.nutritionPlan = recalculatedNutrition;

  // 5. Recalibrate Workout Plan
  const recalculatedWorkout = generateWorkoutPlan({
    experienceLevel: userState.fitnessProfile.experienceLevel || "INTERMEDIATE",
    trainingEnvironment: userState.fitnessProfile.trainingEnvironment || "GYM",
    equipmentAvailable: userState.fitnessProfile.equipmentAvailable || ["barbell", "dumbbell"],
    workoutDaysPerWeek: userState.fitnessProfile.workoutDaysPerWeek || 4,
    sessionDurationMin: userState.fitnessProfile.sessionDurationMin || 45,
    injuries: userState.fitnessProfile.injuries || [],
    goal: userState.goal?.type || "GENERAL_FITNESS",
  });
  userState.workoutPlan = recalculatedWorkout;

  // 6. Persist to Disk Store
  saveUserState(userId);

  return res.json({
    success: true,
    message: "Profile and transformation blueprint updated successfully.",
    profile: userState.profile,
    fitnessProfile: userState.fitnessProfile,
    goal: userState.goal,
    nutritionPlan: userState.nutritionPlan,
    workoutPlan: userState.workoutPlan,
  });
});
