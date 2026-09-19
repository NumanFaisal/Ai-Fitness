import { Router, Response } from "express";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth";
import { getUserState, saveUserState, prisma, ensureUserExists } from "../db";
import { evaluateSafetyGate } from "../engines/safetyGate";
import { calculateNutrition } from "../engines/nutritionEngine";
import { calculateHydration } from "../engines/hydrationEngine";
import { generateWorkoutPlan } from "../engines/workoutEngine";
import { generateAIPlanDetails } from "../services/aiService";
import { personalizationContextBuilder } from "../services/personalizationContextBuilder";
import { progressionService } from "../services/progressionService";
import { nutritionPlanner } from "../services/nutritionPlanner";
import { generateDynamicWorkoutPlan } from "../services/aiWorkoutPlanner";
import { analyzeUserBodyPhoto } from "../services/aiVisionService";

export const planRouter = Router();

planRouter.use(authMiddleware);

async function persistPlanToSupabase(userId: string, email: string | undefined, workout: any, nutrition: any) {
  try {
    const dbUserId = await ensureUserExists(userId, email);

    if (workout?.days && workout.days.length > 0) {
      await prisma.workoutPlan.deleteMany({ where: { userId: dbUserId } }).catch(() => {});
      await prisma.workoutPlan.create({
        data: {
          userId: dbUserId,
          status: "ACTIVE",
          startDate: new Date(),
          generatedBy: workout.generatedBy || "AI_VISION_AND_PROFILE_ENGINE",
          days: {
            create: workout.days.map((d: any) => ({
              dayOfWeek: d.dayOfWeek,
              focus: d.focus,
              exercises: {
                create: d.exercises.map((ex: any, idx: number) => ({
                  exercise: {
                    connectOrCreate: {
                      where: { slug: ex.exerciseSlug || ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "_") },
                      create: {
                        name: ex.exerciseName,
                        slug: ex.exerciseSlug || ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                        primaryMuscle: ex.primaryMuscle || "Compound",
                        instructions: ex.progressionNote || "Standard form and full ROM.",
                      },
                    },
                  },
                  sets: ex.sets,
                  repRangeLow: ex.repRangeLow,
                  repRangeHigh: ex.repRangeHigh,
                  restSeconds: ex.restSeconds,
                  rpeTarget: ex.rpeTarget,
                  orderIndex: idx + 1,
                })),
              },
            })),
          },
        },
      });
    }

    if (nutrition?.calorieTarget?.value) {
      await prisma.nutritionPlan.deleteMany({ where: { userId: dbUserId } }).catch(() => {});
      await prisma.nutritionPlan.create({
        data: {
          userId: dbUserId,
          status: "ACTIVE",
          calorieTarget: nutrition.calorieTarget.value,
          proteinTargetG: nutrition.proteinTargetG.value,
          carbTargetG: nutrition.carbTargetG.value,
          fatTargetG: nutrition.fatTargetG.value,
          startDate: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn("[Plan Route] Supabase persistence notice:", err);
  }
}

// POST /analysis/start
planRouter.post("/analysis/start", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const jobId = `job_${Date.now()}`;

  userState.jobs.set(jobId, { status: "PROCESSING" });

  // Execute processing
  setTimeout(async () => {
    try {
      const context = await personalizationContextBuilder.buildContext(userId);

      // Run automatic body photo analysis if photo exists and analysis not yet saved
      if (!(userState as any).userPhysiqueAnalysis && userState.bodyPhotos) {
        const photoKey = Object.keys(userState.bodyPhotos)[0];
        if (photoKey && userState.bodyPhotos[photoKey]) {
          try {
            const scan = await analyzeUserBodyPhoto({
              imageBase64: userState.bodyPhotos[photoKey],
              angle: photoKey as any,
              heightCm: context.profile.heightCm,
              currentWeightKg: context.profile.weightKg,
              sex: context.profile.sex,
              age: context.profile.age,
              goal: context.goal.type,
            });
            (userState as any).userPhysiqueAnalysis = scan;
            (context as any).userPhysiqueAnalysis = scan;
          } catch {}
        }
      }

      // 1. Run safety gate
      const safety = evaluateSafetyGate({
        age: context.profile.age,
        injuries: context.safety.injuries,
        physicalLimitations: context.safety.physicalLimitations,
        goal: context.goal.type,
        targetDate: context.training.targetDate,
      });

      // 2. Run deterministic nutrition engine
      const nutrition = calculateNutrition({
        weightKg: context.profile.weightKg,
        heightCm: context.profile.heightCm,
        age: context.profile.age,
        sex: context.profile.sex,
        workoutDaysPerWeek: context.training.workoutDaysPerWeek,
        goal: context.goal.type,
        budgetTier: context.nutrition.budgetTier,
        isConservativeSafeMode: context.safety.conservativeMode,
      });

      // 3. Run dynamic AI workout engine driven by user image, profile, and goal
      const rawWorkout = await generateDynamicWorkoutPlan({
        userId,
        profile: context.profile,
        goal: context.goal,
        training: context.training,
        safety: {
          conservativeMode: context.safety.conservativeMode,
          injuries: context.safety.injuries,
          physicalLimitations: context.safety.physicalLimitations,
          maxRPE: context.safety.maxRPE,
          maxSetsPerExercise: context.safety.maxSetsPerExercise,
        },
        userPhysiqueAnalysis: (userState as any).userPhysiqueAnalysis || (context as any).userPhysiqueAnalysis,
        targetPhysique: context.targetPhysique,
      });

      // 4. Apply progression cycle
      const workout = progressionService.applyProgressionToWorkout(userId, rawWorkout);

      // 5. Store in user state
      userState.nutritionPlan = nutrition;
      userState.workoutPlan = workout;

      // 6. Dynamic nutrition assembly
      const dynamicNutrition = await nutritionPlanner.assembleDynamicPlan(context);
      (userState as any).aiMeals = dynamicNutrition.meals;

      const currentVer = (userState as any).planVersion;
      const nextVerNum = currentVer ? parseInt(currentVer.replace(/\D/g, ""), 10) + 1 : 1;
      (userState as any).planVersion = `Plan v${nextVerNum}`;
      (userState as any).planGeneratedAt = new Date().toISOString();
      (userState as any).planSource = dynamicNutrition.generatedBy;

      userState.jobs.set(jobId, {
        status: "COMPLETE",
        result: {
          safety,
          nutrition,
          workout,
          planVersion: (userState as any).planVersion,
          generatedBy: dynamicNutrition.generatedBy,
        },
      });

      saveUserState(userId);
      await persistPlanToSupabase(userId, req.user?.email, workout, nutrition);
    } catch (err: any) {
      console.error("Analysis job error:", err);
      userState.jobs.set(jobId, {
        status: "FAILED",
        error: err?.message || "Analysis generation failure",
      });
    }
  }, 500);

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

  return res.json({ status: job.status, result: job.result, error: job.error });
});

// POST /plan/generate
planRouter.post("/plan/generate", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const jobId = `plan_${Date.now()}`;

  let context = await personalizationContextBuilder.buildContext(userId);

  // Run automatic body photo analysis if photo exists and analysis not yet saved
  if (!(userState as any).userPhysiqueAnalysis && userState.bodyPhotos) {
    const photoKey = Object.keys(userState.bodyPhotos)[0];
    if (photoKey && userState.bodyPhotos[photoKey]) {
      try {
        const scan = await analyzeUserBodyPhoto({
          imageBase64: userState.bodyPhotos[photoKey],
          angle: photoKey as any,
          heightCm: context.profile.heightCm,
          currentWeightKg: context.profile.weightKg,
          sex: context.profile.sex,
          age: context.profile.age,
          goal: context.goal.type,
        });
        (userState as any).userPhysiqueAnalysis = scan;
        (context as any).userPhysiqueAnalysis = scan;
      } catch {}
    }
  }

  // 1. Run safety gate
  const safety = evaluateSafetyGate({
    age: context.profile.age,
    injuries: context.safety.injuries,
    physicalLimitations: context.safety.physicalLimitations,
    goal: context.goal.type,
    targetDate: context.training.targetDate,
  });

  // 2. Run deterministic nutrition engine
  const nutrition = calculateNutrition({
    weightKg: context.profile.weightKg,
    heightCm: context.profile.heightCm,
    age: context.profile.age,
    sex: context.profile.sex,
    workoutDaysPerWeek: context.training.workoutDaysPerWeek,
    goal: context.goal.type,
    budgetTier: context.nutrition.budgetTier,
    isConservativeSafeMode: context.safety.conservativeMode,
  });

  // 3. Run dynamic AI workout engine driven by user image, profile, and goal
  const rawWorkout = await generateDynamicWorkoutPlan({
    userId,
    profile: context.profile,
    goal: context.goal,
    training: context.training,
    safety: {
      conservativeMode: context.safety.conservativeMode,
      injuries: context.safety.injuries,
      physicalLimitations: context.safety.physicalLimitations,
      maxRPE: context.safety.maxRPE,
      maxSetsPerExercise: context.safety.maxSetsPerExercise,
    },
    userPhysiqueAnalysis: (userState as any).userPhysiqueAnalysis || (context as any).userPhysiqueAnalysis,
    targetPhysique: context.targetPhysique,
  });

  // 4. Apply progression service
  const workout = progressionService.applyProgressionToWorkout(userId, rawWorkout);

  // Store in user state
  userState.nutritionPlan = nutrition;
  userState.workoutPlan = workout;

  // 5. Generate AI Meals or Algorithmic Database Fallback
  let generatedBy = "ALGORITHMIC_FOOD_DATABASE";
  try {
    const aiDetails = await generateAIPlanDetails({
      name: context.profile.name,
      age: context.profile.age,
      sex: context.profile.sex,
      goal: context.goal.type,
      calorieTarget: nutrition.calorieTarget.value,
      proteinTarget: nutrition.proteinTargetG.value,
      dietaryPreference: context.nutrition.dietaryPreference,
      allergies: context.nutrition.allergies || [],
      dislikedFoods: context.nutrition.dislikedFoods,
      budgetTier: context.nutrition.budgetTier,
      workoutFocus: workout.days[0]?.focus || "Full Body",
      exercises: workout.days[0]?.exercises.map((e: any) => e.exerciseName) || [],
      experienceLevel: context.training.experienceLevel,
      trainingEnvironment: context.training.trainingEnvironment,
      equipmentAvailable: context.training.equipmentAvailable,
      injuries: context.safety.injuries,
      userPhysiqueAnalysis: (userState as any).userPhysiqueAnalysis || (context as any).userPhysiqueAnalysis,
      targetPhysique: context.targetPhysique,
    });

    if (aiDetails && aiDetails.meals && aiDetails.meals.length > 0) {
      (userState as any).aiPlan = aiDetails;
      (userState as any).aiMeals = aiDetails.meals;
      generatedBy = (aiDetails as any).generatedBy || "AI_GROQ_GEMINI";
    } else {
      const dynamicNutrition = await nutritionPlanner.assembleDynamicPlan(context);
      (userState as any).aiMeals = dynamicNutrition.meals;
      generatedBy = dynamicNutrition.generatedBy;
    }
  } catch (err) {
    console.warn("AI plan detail generation error, assembling algorithmic plan:", err);
    const dynamicNutrition = await nutritionPlanner.assembleDynamicPlan(context);
    (userState as any).aiMeals = dynamicNutrition.meals;
    generatedBy = dynamicNutrition.generatedBy;
  }

  const currentVer = (userState as any).planVersion;
  const nextVerNum = currentVer ? parseInt(currentVer.replace(/\D/g, ""), 10) + 1 : 1;
  (userState as any).planVersion = `Plan v${nextVerNum}`;
  (userState as any).planGeneratedAt = new Date().toISOString();
  (userState as any).planSource = generatedBy;

  userState.hasCompletedOnboarding = true;

  userState.jobs.set(jobId, {
    status: "COMPLETE",
    result: {
      safety,
      nutrition,
      workout,
      planVersion: (userState as any).planVersion,
      generatedBy,
    },
  });

  saveUserState(userId);
  await persistPlanToSupabase(userId, req.user?.email, workout, nutrition);

  return res.json({
    jobId,
    planVersion: (userState as any).planVersion,
    generatedBy,
  });
});

// GET /user/status - Check if user has a generated plan in database
planRouter.get("/user/status", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const hasPlan = Boolean(userState.hasCompletedOnboarding && userState.workoutPlan && userState.nutritionPlan);
  return res.json({
    hasPlan,
    hasCompletedOnboarding: Boolean(userState.hasCompletedOnboarding),
    planVersion: (userState as any).planVersion || "Plan v1",
  });
});

function enrichExercise(ex: any) {
  return {
    ...ex,
    youtubeUrl: `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.exerciseName || ex.name)}+form`,
  };
}

// GET /workout/week - All days
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
  const match =
    userState.workoutPlan.days.find((d: any) => d.dayOfWeek === todayDayOfWeek) ||
    userState.workoutPlan.days[0];

  if (!match) return res.json(null);

  return res.json({
    ...match,
    exercises: match.exercises.map(enrichExercise),
  });
});

// GET /nutrition/today
planRouter.get("/nutrition/today", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);

  if (!userState.nutritionPlan) {
    return res.json(null);
  }

  const np = userState.nutritionPlan;
  let aiMeals = (userState as any).aiMeals;

  // If aiMeals is not present, dynamically assemble meals from database
  if (!aiMeals || aiMeals.length === 0) {
    const context = await personalizationContextBuilder.buildContext(userId);
    const dynamicPlan = await nutritionPlanner.assembleDynamicPlan(context);
    aiMeals = dynamicPlan.meals;
    (userState as any).aiMeals = aiMeals;
    saveUserState(userId);
  }

  const meals = aiMeals.map((m: any) => ({
    mealSlot: m.mealSlot,
    recipeTitle: m.recipeTitle,
    ingredients: m.ingredients || [],
    instructions: m.instructions || [
      "Prepare all measured ingredients as specified.",
      "Cook protein and complex carbs according to package directions.",
      "Plate meal with healthy greens and enjoy fresh.",
    ],
    youtubeUrl: `https://www.youtube.com/results?search_query=how+to+make+${encodeURIComponent(m.recipeTitle)}`,
    calories: { value: m.calories, provenance: "CALCULATED" },
    proteinG: { value: m.proteinG, provenance: "CALCULATED" },
  }));

  return res.json({
    calorieTarget: np.calorieTarget,
    proteinTargetG: np.proteinTargetG,
    carbTargetG: np.carbTargetG,
    fatTargetG: np.fatTargetG,
    planVersion: (userState as any).planVersion || "Plan v1",
    generatedBy: (userState as any).planSource || "ALGORITHMIC_FOOD_DATABASE",
    meals,
  });
});

// GET /user/reminders
planRouter.get("/user/reminders", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const userState = getUserState(userId);
  const reminders = (userState as any).reminders || {
    gymTime: "18:00",
    gymDays: [1, 2, 4, 5],
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
      planVersion: (userState as any).planVersion || "Plan v1",
      aiNarrative:
        (userState as any).aiPlan?.coachNarrative ||
        "Baseline registered. Your strength progression and habit compliance are calibrated against your targets.",
    },
  ]);
});
