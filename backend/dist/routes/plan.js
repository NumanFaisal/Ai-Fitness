"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const safetyGate_1 = require("../engines/safetyGate");
const nutritionEngine_1 = require("../engines/nutritionEngine");
const hydrationEngine_1 = require("../engines/hydrationEngine");
const aiService_1 = require("../services/aiService");
const personalizationContextBuilder_1 = require("../services/personalizationContextBuilder");
const progressionService_1 = require("../services/progressionService");
const nutritionPlanner_1 = require("../services/nutritionPlanner");
const aiWorkoutPlanner_1 = require("../services/aiWorkoutPlanner");
const aiVisionService_1 = require("../services/aiVisionService");
exports.planRouter = (0, express_1.Router)();
exports.planRouter.use(auth_1.authMiddleware);
// POST /analysis/start
exports.planRouter.post("/analysis/start", async (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const jobId = `job_${Date.now()}`;
    userState.jobs.set(jobId, { status: "PROCESSING" });
    // Execute processing
    setTimeout(async () => {
        try {
            const context = await personalizationContextBuilder_1.personalizationContextBuilder.buildContext(userId);
            // Run automatic body photo analysis if photo exists and analysis not yet saved
            if (!userState.userPhysiqueAnalysis && userState.bodyPhotos) {
                const photoKey = Object.keys(userState.bodyPhotos)[0];
                if (photoKey && userState.bodyPhotos[photoKey]) {
                    try {
                        const scan = await (0, aiVisionService_1.analyzeUserBodyPhoto)({
                            imageBase64: userState.bodyPhotos[photoKey],
                            angle: photoKey,
                            heightCm: context.profile.heightCm,
                            currentWeightKg: context.profile.weightKg,
                            sex: context.profile.sex,
                            age: context.profile.age,
                            goal: context.goal.type,
                        });
                        userState.userPhysiqueAnalysis = scan;
                        context.userPhysiqueAnalysis = scan;
                    }
                    catch { }
                }
            }
            // 1. Run safety gate
            const safety = (0, safetyGate_1.evaluateSafetyGate)({
                age: context.profile.age,
                injuries: context.safety.injuries,
                physicalLimitations: context.safety.physicalLimitations,
                goal: context.goal.type,
                targetDate: context.training.targetDate,
            });
            // 2. Run deterministic nutrition engine
            const nutrition = (0, nutritionEngine_1.calculateNutrition)({
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
            const rawWorkout = await (0, aiWorkoutPlanner_1.generateDynamicWorkoutPlan)({
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
                userPhysiqueAnalysis: userState.userPhysiqueAnalysis || context.userPhysiqueAnalysis,
                targetPhysique: context.targetPhysique,
            });
            // 4. Apply progression cycle
            const workout = progressionService_1.progressionService.applyProgressionToWorkout(userId, rawWorkout);
            // 5. Store in user state
            userState.nutritionPlan = nutrition;
            userState.workoutPlan = workout;
            // 6. Dynamic nutrition assembly
            const dynamicNutrition = await nutritionPlanner_1.nutritionPlanner.assembleDynamicPlan(context);
            userState.aiMeals = dynamicNutrition.meals;
            const currentVer = userState.planVersion;
            const nextVerNum = currentVer ? parseInt(currentVer.replace(/\D/g, ""), 10) + 1 : 1;
            userState.planVersion = `Plan v${nextVerNum}`;
            userState.planGeneratedAt = new Date().toISOString();
            userState.planSource = dynamicNutrition.generatedBy;
            userState.jobs.set(jobId, {
                status: "COMPLETE",
                result: {
                    safety,
                    nutrition,
                    workout,
                    planVersion: userState.planVersion,
                    generatedBy: dynamicNutrition.generatedBy,
                },
            });
            (0, db_1.saveUserState)(userId);
        }
        catch (err) {
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
exports.planRouter.get("/analysis/:jobId", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const job = userState.jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ message: "Job not found." });
    }
    return res.json({ status: job.status, result: job.result, error: job.error });
});
// POST /plan/generate
exports.planRouter.post("/plan/generate", async (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const jobId = `plan_${Date.now()}`;
    let context = await personalizationContextBuilder_1.personalizationContextBuilder.buildContext(userId);
    // Run automatic body photo analysis if photo exists and analysis not yet saved
    if (!userState.userPhysiqueAnalysis && userState.bodyPhotos) {
        const photoKey = Object.keys(userState.bodyPhotos)[0];
        if (photoKey && userState.bodyPhotos[photoKey]) {
            try {
                const scan = await (0, aiVisionService_1.analyzeUserBodyPhoto)({
                    imageBase64: userState.bodyPhotos[photoKey],
                    angle: photoKey,
                    heightCm: context.profile.heightCm,
                    currentWeightKg: context.profile.weightKg,
                    sex: context.profile.sex,
                    age: context.profile.age,
                    goal: context.goal.type,
                });
                userState.userPhysiqueAnalysis = scan;
                context.userPhysiqueAnalysis = scan;
            }
            catch { }
        }
    }
    // 1. Run safety gate
    const safety = (0, safetyGate_1.evaluateSafetyGate)({
        age: context.profile.age,
        injuries: context.safety.injuries,
        physicalLimitations: context.safety.physicalLimitations,
        goal: context.goal.type,
        targetDate: context.training.targetDate,
    });
    // 2. Run deterministic nutrition engine
    const nutrition = (0, nutritionEngine_1.calculateNutrition)({
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
    const rawWorkout = await (0, aiWorkoutPlanner_1.generateDynamicWorkoutPlan)({
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
        userPhysiqueAnalysis: userState.userPhysiqueAnalysis || context.userPhysiqueAnalysis,
        targetPhysique: context.targetPhysique,
    });
    // 4. Apply progression service
    const workout = progressionService_1.progressionService.applyProgressionToWorkout(userId, rawWorkout);
    // Store in user state
    userState.nutritionPlan = nutrition;
    userState.workoutPlan = workout;
    // 5. Generate AI Meals or Algorithmic Database Fallback
    let generatedBy = "ALGORITHMIC_FOOD_DATABASE";
    try {
        const aiDetails = await (0, aiService_1.generateAIPlanDetails)({
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
            exercises: workout.days[0]?.exercises.map((e) => e.exerciseName) || [],
            experienceLevel: context.training.experienceLevel,
            trainingEnvironment: context.training.trainingEnvironment,
            equipmentAvailable: context.training.equipmentAvailable,
            injuries: context.safety.injuries,
            userPhysiqueAnalysis: userState.userPhysiqueAnalysis || context.userPhysiqueAnalysis,
            targetPhysique: context.targetPhysique,
        });
        if (aiDetails && aiDetails.meals && aiDetails.meals.length > 0) {
            userState.aiPlan = aiDetails;
            userState.aiMeals = aiDetails.meals;
            generatedBy = aiDetails.generatedBy || "AI_GROQ_GEMINI";
        }
        else {
            const dynamicNutrition = await nutritionPlanner_1.nutritionPlanner.assembleDynamicPlan(context);
            userState.aiMeals = dynamicNutrition.meals;
            generatedBy = dynamicNutrition.generatedBy;
        }
    }
    catch (err) {
        console.warn("AI plan detail generation error, assembling algorithmic plan:", err);
        const dynamicNutrition = await nutritionPlanner_1.nutritionPlanner.assembleDynamicPlan(context);
        userState.aiMeals = dynamicNutrition.meals;
        generatedBy = dynamicNutrition.generatedBy;
    }
    const currentVer = userState.planVersion;
    const nextVerNum = currentVer ? parseInt(currentVer.replace(/\D/g, ""), 10) + 1 : 1;
    userState.planVersion = `Plan v${nextVerNum}`;
    userState.planGeneratedAt = new Date().toISOString();
    userState.planSource = generatedBy;
    userState.hasCompletedOnboarding = true;
    userState.jobs.set(jobId, {
        status: "COMPLETE",
        result: {
            safety,
            nutrition,
            workout,
            planVersion: userState.planVersion,
            generatedBy,
        },
    });
    (0, db_1.saveUserState)(userId);
    return res.json({
        jobId,
        planVersion: userState.planVersion,
        generatedBy,
    });
});
// GET /user/status - Check if user has a generated plan in database
exports.planRouter.get("/user/status", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const hasPlan = Boolean(userState.hasCompletedOnboarding && userState.workoutPlan && userState.nutritionPlan);
    return res.json({
        hasPlan,
        hasCompletedOnboarding: Boolean(userState.hasCompletedOnboarding),
        planVersion: userState.planVersion || "Plan v1",
    });
});
function enrichExercise(ex) {
    return {
        ...ex,
        youtubeUrl: `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.exerciseName || ex.name)}+form`,
    };
}
// GET /workout/week - All days
exports.planRouter.get("/workout/week", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    if (!userState.workoutPlan?.days) {
        return res.json([]);
    }
    const enrichedDays = userState.workoutPlan.days.map((day) => ({
        ...day,
        exercises: day.exercises.map(enrichExercise),
    }));
    return res.json(enrichedDays);
});
// GET /workout/today
exports.planRouter.get("/workout/today", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    if (!userState.workoutPlan?.days) {
        return res.json(null);
    }
    const todayDayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon ...
    const match = userState.workoutPlan.days.find((d) => d.dayOfWeek === todayDayOfWeek) ||
        userState.workoutPlan.days[0];
    if (!match)
        return res.json(null);
    return res.json({
        ...match,
        exercises: match.exercises.map(enrichExercise),
    });
});
// GET /nutrition/today
exports.planRouter.get("/nutrition/today", async (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    if (!userState.nutritionPlan) {
        return res.json(null);
    }
    const np = userState.nutritionPlan;
    let aiMeals = userState.aiMeals;
    // If aiMeals is not present, dynamically assemble meals from database
    if (!aiMeals || aiMeals.length === 0) {
        const context = await personalizationContextBuilder_1.personalizationContextBuilder.buildContext(userId);
        const dynamicPlan = await nutritionPlanner_1.nutritionPlanner.assembleDynamicPlan(context);
        aiMeals = dynamicPlan.meals;
        userState.aiMeals = aiMeals;
        (0, db_1.saveUserState)(userId);
    }
    const meals = aiMeals.map((m) => ({
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
        planVersion: userState.planVersion || "Plan v1",
        generatedBy: userState.planSource || "ALGORITHMIC_FOOD_DATABASE",
        meals,
    });
});
// GET /user/reminders
exports.planRouter.get("/user/reminders", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const reminders = userState.reminders || {
        gymTime: "18:00",
        gymDays: [1, 2, 4, 5],
        mealReminders: true,
        waterReminders: true,
        waterIntervalHours: 2,
    };
    return res.json(reminders);
});
// POST /user/reminders
exports.planRouter.post("/user/reminders", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    userState.reminders = {
        gymTime: req.body.gymTime || "18:00",
        gymDays: Array.isArray(req.body.gymDays) ? req.body.gymDays : [1, 2, 4, 5],
        mealReminders: Boolean(req.body.mealReminders ?? true),
        waterReminders: Boolean(req.body.waterReminders ?? true),
        waterIntervalHours: Number(req.body.waterIntervalHours) || 2,
    };
    (0, db_1.saveUserState)(userId);
    return res.json({ success: true, reminders: userState.reminders });
});
// GET /water/today
exports.planRouter.get("/water/today", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const weight = userState.profile?.weightKg ?? 75;
    const hydration = (0, hydrationEngine_1.calculateHydration)({
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
exports.planRouter.post("/water", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    const amountMl = Number(req.body.amountMl);
    if (!amountMl || amountMl <= 0) {
        return res.status(400).json({ message: "Invalid water amount." });
    }
    userState.waterLogs.push({ amountMl, loggedAt: new Date() });
    (0, db_1.saveUserState)(userId);
    const weight = userState.profile?.weightKg ?? 75;
    const hydration = (0, hydrationEngine_1.calculateHydration)({ weightKg: weight });
    const consumedMl = userState.waterLogs.reduce((acc, log) => acc + log.amountMl, 0);
    return res.json({
        targetMl: hydration.targetMl,
        consumedMl,
    });
});
// GET /progress/dashboard
exports.planRouter.get("/progress/dashboard", (req, res) => {
    const userId = req.user.userId;
    const userState = (0, db_1.getUserState)(userId);
    if (!userState.workoutPlan && !userState.nutritionPlan) {
        return res.json([]);
    }
    return res.json([
        {
            snapshotDate: new Date().toISOString().split("T")[0],
            weightKg: userState.profile?.weightKg ?? 75,
            planVersion: userState.planVersion || "Plan v1",
            aiNarrative: userState.aiPlan?.coachNarrative ||
                "Baseline registered. Your strength progression and habit compliance are calibrated against your targets.",
        },
    ]);
});
