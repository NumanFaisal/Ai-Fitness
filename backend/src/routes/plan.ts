import { Router, Response } from "express";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth";
import { getUserState, saveUserState } from "../db";
import { evaluateSafetyGate } from "../engines/safetyGate";
import { calculateNutrition } from "../engines/nutritionEngine";
import { calculateHydration } from "../engines/hydrationEngine";
import { generateWorkoutPlan } from "../engines/workoutEngine";
import { generateAIPlanDetails } from "../services/aiService";

export const planRouter = Router();

planRouter.use(authMiddleware);

// POST /analysis/start
planRouter.post("/analysis/start", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const jobId = `job_${Date.now()}`;

  userState.jobs.set(jobId, { status: "PROCESSING" });

  // Execute async processing
  setTimeout(() => {
    // 1. Run safety gate
    const safety = evaluateSafetyGate({
      age: userState.profile?.age ?? 25,
      injuries: userState.fitnessProfile?.injuries ?? [],
      physicalLimitations: userState.fitnessProfile?.physicalLimitations ?? [],
      goal: userState.goal?.type ?? "GENERAL_FITNESS",
      targetDate: userState.fitnessProfile?.targetDate,
    });

    // 2. Run deterministic nutrition engine
    const nutrition = calculateNutrition({
      weightKg: userState.profile?.weightKg ?? 75,
      heightCm: userState.profile?.heightCm ?? 175,
      age: userState.profile?.age ?? 25,
      sex: userState.profile?.sex ?? "MALE",
      workoutDaysPerWeek: userState.fitnessProfile?.workoutDaysPerWeek ?? 4,
      goal: userState.goal?.type ?? "GENERAL_FITNESS",
      budgetTier: userState.fitnessProfile?.budgetTier ?? "MEDIUM",
      isConservativeSafeMode: !safety.isSafe,
    });

    // 3. Run deterministic workout engine
    const workout = generateWorkoutPlan({
      experienceLevel: userState.fitnessProfile?.experienceLevel ?? "BEGINNER",
      trainingEnvironment: userState.fitnessProfile?.trainingEnvironment ?? "GYM",
      equipmentAvailable: userState.fitnessProfile?.equipmentAvailable ?? ["barbell", "dumbbell"],
      workoutDaysPerWeek: userState.fitnessProfile?.workoutDaysPerWeek ?? 4,
      sessionDurationMin: userState.fitnessProfile?.sessionDurationMin ?? 45,
      injuries: userState.fitnessProfile?.injuries ?? [],
      goal: userState.goal?.type ?? "GENERAL_FITNESS",
      targetPhysiqueFocus: (userState as any).targetPhysique?.standoutMuscles || [],
    });

    // Store in user state
    userState.nutritionPlan = nutrition;
    userState.workoutPlan = workout;

    userState.jobs.set(jobId, {
      status: "COMPLETE",
      result: { safety, nutrition, workout },
    });
  }, 1200);

  return res.json({ jobId });
});

// GET /analysis/:jobId
planRouter.get("/analysis/:jobId", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const job = userState.jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ message: "Job not found." });
  }

  return res.json({ status: job.status });
});

// POST /plan/generate
planRouter.post("/plan/generate", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const jobId = `plan_${Date.now()}`;

  // 1. Run safety gate
  const safety = evaluateSafetyGate({
    age: userState.profile?.age ?? 25,
    injuries: userState.fitnessProfile?.injuries ?? [],
    physicalLimitations: userState.fitnessProfile?.physicalLimitations ?? [],
    goal: userState.goal?.type ?? "GENERAL_FITNESS",
    targetDate: userState.fitnessProfile?.targetDate,
  });

  // 2. Run deterministic nutrition engine
  const nutrition = calculateNutrition({
    weightKg: userState.profile?.weightKg ?? 75,
    heightCm: userState.profile?.heightCm ?? 175,
    age: userState.profile?.age ?? 25,
    sex: userState.profile?.sex ?? "MALE",
    workoutDaysPerWeek: userState.fitnessProfile?.workoutDaysPerWeek ?? 4,
    goal: userState.goal?.type ?? "GENERAL_FITNESS",
    budgetTier: userState.fitnessProfile?.budgetTier ?? "MEDIUM",
    isConservativeSafeMode: !safety.isSafe,
  });

  // 3. Run deterministic workout engine
  const workout = generateWorkoutPlan({
    experienceLevel: userState.fitnessProfile?.experienceLevel ?? "BEGINNER",
    trainingEnvironment: userState.fitnessProfile?.trainingEnvironment ?? "GYM",
    equipmentAvailable: userState.fitnessProfile?.equipmentAvailable ?? ["barbell", "dumbbell"],
    workoutDaysPerWeek: userState.fitnessProfile?.workoutDaysPerWeek ?? 4,
    sessionDurationMin: userState.fitnessProfile?.sessionDurationMin ?? 45,
    injuries: userState.fitnessProfile?.injuries ?? [],
    goal: userState.goal?.type ?? "GENERAL_FITNESS",
    targetPhysiqueFocus: (userState as any).targetPhysique?.standoutMuscles || [],
  });

  // Store in user state
  userState.nutritionPlan = nutrition;
  userState.workoutPlan = workout;

  // 4. Generate AI Meals & Coaching Narrative
  try {
    const aiDetails = await generateAIPlanDetails({
      name: userState.profile?.name || "Athlete",
      age: userState.profile?.age || 25,
      sex: userState.profile?.sex || "MALE",
      goal: userState.goal?.type || "GENERAL_FITNESS",
      calorieTarget: nutrition.calorieTarget.value,
      proteinTarget: nutrition.proteinTargetG.value,
      dietaryPreference: userState.fitnessProfile?.dietaryPreference || "None",
      allergies: userState.fitnessProfile?.allergies || [],
      dislikedFoods: userState.fitnessProfile?.dislikedFoods || [],
      budgetTier: userState.fitnessProfile?.budgetTier || "MEDIUM",
      workoutFocus: workout.days[0]?.focus || "Full Body",
      exercises: workout.days[0]?.exercises.map((e: any) => e.exerciseName) || [],
      experienceLevel: userState.fitnessProfile?.experienceLevel,
      trainingEnvironment: userState.fitnessProfile?.trainingEnvironment,
      equipmentAvailable: userState.fitnessProfile?.equipmentAvailable,
      injuries: userState.fitnessProfile?.injuries,
    });

    if (aiDetails) {
      (userState as any).aiPlan = aiDetails;
      (userState as any).aiMeals = aiDetails.meals;
    }
  } catch (err) {
    console.warn("AI plan detail generation error:", err);
  }

  userState.hasCompletedOnboarding = true;

  userState.jobs.set(jobId, {
    status: "COMPLETE",
    result: { safety, nutrition, workout },
  });

  saveUserState(userId);

  return res.json({ jobId });
});

// GET /user/status - Check if user has a generated plan in database
planRouter.get("/user/status", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const hasPlan = Boolean(userState.hasCompletedOnboarding && userState.workoutPlan && userState.nutritionPlan);
  return res.json({
    hasPlan,
    hasCompletedOnboarding: Boolean(userState.hasCompletedOnboarding),
  });
});

function enrichExercise(ex: any) {
  return {
    ...ex,
    youtubeUrl: `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.exerciseName)}+form`,
  };
}

// GET /workout/week - All 7 days
planRouter.get("/workout/week", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  if (!userState.workoutPlan?.days) {
    return res.json([]);
  }

  const enrichedDays = userState.workoutPlan.days.map((day: any) => ({
    ...day,
    exercises: day.exercises.map(enrichExercise),
  }));

  return res.json(enrichedDays);
});

// GET /workout/today
planRouter.get("/workout/today", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  if (!userState.workoutPlan?.days) {
    return res.json(null);
  }

  const todayDayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon ...
  const match = userState.workoutPlan.days.find(
    (d: any) => d.dayOfWeek === todayDayOfWeek
  ) || userState.workoutPlan.days[0];

  if (!match) return res.json(null);

  return res.json({
    ...match,
    exercises: match.exercises.map(enrichExercise),
  });
});

// GET /nutrition/today
planRouter.get("/nutrition/today", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  if (!userState.nutritionPlan) {
    return res.json(null);
  }

  const np = userState.nutritionPlan;
  const aiMeals = (userState as any).aiMeals;

  const meals = (aiMeals && aiMeals.length > 0)
    ? aiMeals.map((m: any) => ({
        mealSlot: m.mealSlot,
        recipeTitle: m.recipeTitle,
        ingredients: m.ingredients || [],
        instructions: m.instructions || [
          "Prepare all measured ingredients as specified.",
          "Cook protein and complex carbs according to package directions.",
          "Plate meal with healthy greens and enjoy fresh."
        ],
        youtubeUrl: `https://www.youtube.com/results?search_query=how+to+make+${encodeURIComponent(m.recipeTitle)}`,
        calories: { value: m.calories, provenance: "CALCULATED" },
        proteinG: { value: m.proteinG, provenance: "CALCULATED" },
      }))
    : np.recommendedMealSlots.map((slot: string) => ({
        mealSlot: slot,
        recipeTitle: `${np.budgetTier.toLowerCase()} tier healthy ${slot.toLowerCase()}`,
        ingredients: ["Balanced lean proteins and complex carbohydrates"],
        instructions: ["Prepare ingredients fresh and season to taste."],
        youtubeUrl: `https://www.youtube.com/results?search_query=healthy+${encodeURIComponent(slot)}+fitness+meal`,
        calories: { value: Math.round(np.calorieTarget.value / 4), provenance: "CALCULATED" },
        proteinG: { value: Math.round(np.proteinTargetG.value / 4), provenance: "CALCULATED" },
      }));

  return res.json({
    calorieTarget: np.calorieTarget,
    proteinTargetG: np.proteinTargetG,
    carbTargetG: np.carbTargetG,
    fatTargetG: np.fatTargetG,
    meals,
  });
});

// GET /user/reminders
planRouter.get("/user/reminders", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const reminders = (userState as any).reminders || {
    gymTime: "18:00",
    gymDays: [1, 2, 4, 5], // Mon, Tue, Thu, Fri
    mealReminders: true,
    waterReminders: true,
    waterIntervalHours: 2,
  };
  return res.json(reminders);
});

// POST /user/reminders
planRouter.post("/user/reminders", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  (userState as any).reminders = {
    gymTime: req.body.gymTime || "18:00",
    gymDays: Array.isArray(req.body.gymDays) ? req.body.gymDays : [1, 2, 4, 5],
    mealReminders: Boolean(req.body.mealReminders ?? true),
    waterReminders: Boolean(req.body.waterReminders ?? true),
    waterIntervalHours: Number(req.body.waterIntervalHours) || 2,
  };
  saveUserState(userId);
  return res.json({ success: true, reminders: (userState as any).reminders });
});

// GET /water/today
planRouter.get("/water/today", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  const weight = userState.profile?.weightKg ?? 75;
  const hydration = calculateHydration({
    weightKg: weight,
    sessionDurationMin: userState.fitnessProfile?.sessionDurationMin ?? 45,
  });

  const consumedMl = userState.waterLogs.reduce((acc, log) => acc + log.amountMl, 0);

  return res.json({
    targetMl: hydration.targetMl,
    consumedMl,
  });
});

// POST /water
planRouter.post("/water", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const amountMl = Number(req.body.amountMl);

  if (!amountMl || amountMl <= 0) {
    return res.status(400).json({ message: "Invalid water amount." });
  }

  userState.waterLogs.push({ amountMl, loggedAt: new Date() });
  saveUserState(userId);

  const weight = userState.profile?.weightKg ?? 75;
  const hydration = calculateHydration({ weightKg: weight });
  const consumedMl = userState.waterLogs.reduce((acc, log) => acc + log.amountMl, 0);

  return res.json({
    targetMl: hydration.targetMl,
    consumedMl,
  });
});

// GET /progress/dashboard
planRouter.get("/progress/dashboard", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  if (!userState.workoutPlan && !userState.nutritionPlan) {
    return res.json([]);
  }

  return res.json([
    {
      snapshotDate: new Date().toISOString().split("T")[0],
      weightKg: userState.profile?.weightKg ?? 75,
      aiNarrative: (userState as any).aiPlan?.coachNarrative || "Baseline registered. Your strength progression and habit compliance are calibrated against your targets.",
    },
  ]);
});
