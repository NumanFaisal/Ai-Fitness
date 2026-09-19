"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coachActionService = exports.CoachActionService = exports.CoachActionSchema = exports.AdjustCalorieTargetActionSchema = exports.RequestPlanRegenerationActionSchema = exports.RecalculateNutritionActionSchema = exports.AdjustMealPortionActionSchema = exports.ReplaceMealActionSchema = exports.AdjustTodaysWorkoutActionSchema = exports.ReplaceExerciseActionSchema = exports.LogExerciseSetActionSchema = exports.LogWorkoutActionSchema = exports.LogWaterActionSchema = exports.LogWeightActionSchema = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const exerciseService_1 = require("./exerciseService");
const recipeService_1 = require("./recipeService");
const nutritionEngine_1 = require("../engines/nutritionEngine");
const tdeeRecalibrationService_1 = require("./tdeeRecalibrationService");
const workoutEngine_1 = require("../engines/workoutEngine");
const nutritionPlanner_1 = require("./nutritionPlanner");
const personalizationContextBuilder_1 = require("./personalizationContextBuilder");
// --- Zod Action Schemas ---
exports.LogWeightActionSchema = zod_1.z.object({
    action: zod_1.z.literal("LOG_WEIGHT"),
    parameters: zod_1.z.object({
        weightKg: zod_1.z.number().min(30).max(300),
        loggedAt: zod_1.z.string().optional(),
    }),
});
exports.LogWaterActionSchema = zod_1.z.object({
    action: zod_1.z.literal("LOG_WATER"),
    parameters: zod_1.z.object({
        amountMl: zod_1.z.number().min(50).max(4000),
    }),
});
exports.LogWorkoutActionSchema = zod_1.z.object({
    action: zod_1.z.literal("LOG_WORKOUT"),
    parameters: zod_1.z.object({
        workoutDayFocus: zod_1.z.string(),
        durationMin: zod_1.z.number().min(5).max(300).optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.LogExerciseSetActionSchema = zod_1.z.object({
    action: zod_1.z.literal("LOG_EXERCISE_SET"),
    parameters: zod_1.z.object({
        exerciseSlug: zod_1.z.string().min(1),
        setNumber: zod_1.z.number().min(1).max(20),
        reps: zod_1.z.number().min(1).max(100),
        weightKg: zod_1.z.number().min(0).max(500).optional(),
        rpe: zod_1.z.number().min(1).max(10).optional(),
    }),
});
exports.ReplaceExerciseActionSchema = zod_1.z.object({
    action: zod_1.z.literal("REPLACE_EXERCISE"),
    parameters: zod_1.z.object({
        currentExerciseSlug: zod_1.z.string().min(1),
        replacementExerciseSlug: zod_1.z.string().optional(),
        reason: zod_1.z.string().optional(),
    }),
});
exports.AdjustTodaysWorkoutActionSchema = zod_1.z.object({
    action: zod_1.z.literal("ADJUST_TODAYS_WORKOUT"),
    parameters: zod_1.z.object({
        fatigueLevel: zod_1.z.enum(["LOW", "MODERATE", "HIGH", "EXTREME"]),
        timeAvailableMin: zod_1.z.number().min(10).max(120).optional(),
        targetRPECap: zod_1.z.number().min(5).max(10).optional(),
    }),
});
exports.ReplaceMealActionSchema = zod_1.z.object({
    action: zod_1.z.literal("REPLACE_MEAL"),
    parameters: zod_1.z.object({
        mealSlot: zod_1.z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
        dietaryPreferenceOverride: zod_1.z.string().optional(),
        reason: zod_1.z.string().optional(),
    }),
});
exports.AdjustMealPortionActionSchema = zod_1.z.object({
    action: zod_1.z.literal("ADJUST_MEAL_PORTION"),
    parameters: zod_1.z.object({
        mealSlot: zod_1.z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
        calorieMultiplier: zod_1.z.number().min(0.5).max(2.0),
    }),
});
exports.RecalculateNutritionActionSchema = zod_1.z.object({
    action: zod_1.z.literal("RECALCULATE_NUTRITION"),
    parameters: zod_1.z.object({
        weightKg: zod_1.z.number().min(30).max(300).optional(),
        goal: zod_1.z.string().optional(),
        calorieDelta: zod_1.z.number().min(-1000).max(1000).optional(),
    }),
});
exports.RequestPlanRegenerationActionSchema = zod_1.z.object({
    action: zod_1.z.literal("REQUEST_PLAN_REGENERATION"),
    parameters: zod_1.z.object({
        reason: zod_1.z.string(),
        regenerateWorkout: zod_1.z.boolean().default(true),
        regenerateNutrition: zod_1.z.boolean().default(true),
    }),
});
exports.AdjustCalorieTargetActionSchema = zod_1.z.object({
    action: zod_1.z.literal("ADJUST_CALORIE_TARGET"),
    parameters: zod_1.z.object({
        deltaCalories: zod_1.z.number().min(-2000).max(2000).optional(),
        newCalorieTarget: zod_1.z.number().min(1000).max(6000).optional(),
        reason: zod_1.z.string().optional(),
    }),
});
exports.CoachActionSchema = zod_1.z.discriminatedUnion("action", [
    exports.LogWeightActionSchema,
    exports.LogWaterActionSchema,
    exports.LogWorkoutActionSchema,
    exports.LogExerciseSetActionSchema,
    exports.ReplaceExerciseActionSchema,
    exports.AdjustTodaysWorkoutActionSchema,
    exports.ReplaceMealActionSchema,
    exports.AdjustMealPortionActionSchema,
    exports.AdjustCalorieTargetActionSchema,
    exports.RecalculateNutritionActionSchema,
    exports.RequestPlanRegenerationActionSchema,
]);
class CoachActionService {
    /**
     * Validates and executes a coach structured action deterministically.
     * Enforces Zod validation, authorization, and safety gate limits.
     */
    async executeAction(userId, rawAction) {
        // 1. Zod Schema Validation
        const parseResult = exports.CoachActionSchema.safeParse(rawAction);
        if (!parseResult.success) {
            return {
                success: false,
                action: rawAction?.action || "UNKNOWN",
                summary: "Action rejected: schema validation failed",
                badge: "❌ Validation Failed",
                error: JSON.stringify(parseResult.error.format()),
            };
        }
        const actionData = parseResult.data;
        const userState = (0, db_1.getUserState)(userId);
        // 2. Authorization & Safety checks per action type
        switch (actionData.action) {
            case "LOG_WEIGHT": {
                const { weightKg } = actionData.parameters;
                if (!userState.profile) {
                    userState.profile = { name: "Athlete", age: 25, sex: "MALE", heightCm: 175, weightKg };
                }
                else {
                    userState.profile.weightKg = weightKg;
                }
                // Add to WeightLog service
                const recalResult = tdeeRecalibrationService_1.tdeeRecalibrationService.logWeightAndEvaluate(userId, weightKg);
                if (recalResult.recalibrated && recalResult.newCalorieTarget && userState.nutritionPlan) {
                    userState.nutritionPlan.calorieTarget = {
                        value: recalResult.newCalorieTarget,
                        provenance: "CALCULATED",
                    };
                }
                else if (userState.fitnessProfile && userState.goal) {
                    userState.nutritionPlan = (0, nutritionEngine_1.calculateNutrition)({
                        weightKg,
                        heightCm: userState.profile.heightCm,
                        age: userState.profile.age,
                        sex: userState.profile.sex,
                        workoutDaysPerWeek: userState.fitnessProfile.workoutDaysPerWeek,
                        goal: userState.goal.type,
                        budgetTier: userState.fitnessProfile.budgetTier,
                    });
                }
                (0, db_1.saveUserState)(userId);
                return {
                    success: true,
                    action: "LOG_WEIGHT",
                    summary: `Recorded body weight: ${weightKg.toFixed(1)} kg.${recalResult.recalibrated ? ` Caloric target recalibrated to ${recalResult.newCalorieTarget} kcal.` : ""}`,
                    badge: `⚖️ ${weightKg.toFixed(1)} kg Logged`,
                    details: { weightKg, recalibration: recalResult },
                };
            }
            case "LOG_WATER": {
                const { amountMl } = actionData.parameters;
                userState.waterLogs.push({ amountMl, loggedAt: new Date() });
                (0, db_1.saveUserState)(userId);
                const total = userState.waterLogs.reduce((acc, l) => acc + l.amountMl, 0);
                return {
                    success: true,
                    action: "LOG_WATER",
                    summary: `Logged +${amountMl}ml water (${total}ml total today)`,
                    badge: `💧 +${amountMl}ml Water`,
                    details: { amountMl, totalWaterToday: total },
                };
            }
            case "LOG_WORKOUT": {
                const { workoutDayFocus, durationMin, notes } = actionData.parameters;
                if (!userState.workoutSessionLogs) {
                    userState.workoutSessionLogs = [];
                }
                userState.workoutSessionLogs.push({
                    focus: workoutDayFocus,
                    durationMin: durationMin || 45,
                    notes: notes || "Session completed",
                    completedAt: new Date().toISOString(),
                });
                (0, db_1.saveUserState)(userId);
                return {
                    success: true,
                    action: "LOG_WORKOUT",
                    summary: `Workout session logged: ${workoutDayFocus}`,
                    badge: `🏋️ Workout Complete`,
                    details: { focus: workoutDayFocus, durationMin },
                };
            }
            case "LOG_EXERCISE_SET": {
                const { exerciseSlug, setNumber, reps, weightKg, rpe } = actionData.parameters;
                if (!userState.exerciseSetLogs) {
                    userState.exerciseSetLogs = [];
                }
                userState.exerciseSetLogs.push({
                    exerciseSlug,
                    setNumber,
                    reps,
                    weightKg: weightKg || 0,
                    rpe: rpe || 8.0,
                    completedAt: new Date().toISOString(),
                });
                (0, db_1.saveUserState)(userId);
                return {
                    success: true,
                    action: "LOG_EXERCISE_SET",
                    summary: `Logged set #${setNumber} of ${exerciseSlug}: ${reps} reps${weightKg ? ` @ ${weightKg}kg` : ""}${rpe ? ` (RPE ${rpe})` : ""}`,
                    badge: `💪 Set Logged`,
                    details: { exerciseSlug, setNumber, reps, weightKg, rpe },
                };
            }
            case "REPLACE_EXERCISE": {
                const { currentExerciseSlug, replacementExerciseSlug } = actionData.parameters;
                const injuries = userState.fitnessProfile?.injuries || [];
                const equipment = userState.fitnessProfile?.equipmentAvailable || ["barbell", "dumbbell", "bodyweight"];
                let chosenSlug = replacementExerciseSlug;
                if (!chosenSlug) {
                    const alternatives = exerciseService_1.exerciseService.getAlternatives(currentExerciseSlug, {
                        equipmentAvailable: equipment,
                        injuries,
                    });
                    if (alternatives.length > 0) {
                        chosenSlug = alternatives[0].slug;
                    }
                }
                if (!chosenSlug) {
                    return {
                        success: false,
                        action: "REPLACE_EXERCISE",
                        summary: `No safe alternative found for ${currentExerciseSlug} matching your equipment and injury constraints.`,
                        badge: "⚠️ Swap Unavailable",
                    };
                }
                // Safety verification: check replacement exercise is not contraindicated
                const replacementEx = exerciseService_1.exerciseService.getExerciseBySlug(chosenSlug);
                if (replacementEx) {
                    const hasInjuryConflict = replacementEx.contraindications?.some((c) => injuries.some((inj) => c.toLowerCase().includes(inj.toLowerCase())));
                    if (hasInjuryConflict) {
                        return {
                            success: false,
                            action: "REPLACE_EXERCISE",
                            summary: `Safety violation: ${replacementEx.name} is contraindicated for reported injuries (${injuries.join(", ")}).`,
                            badge: "⛔ Safety Violation",
                        };
                    }
                }
                // Swap in workout plan
                let replacedCount = 0;
                if (userState.workoutPlan?.days) {
                    for (const day of userState.workoutPlan.days) {
                        for (const ex of day.exercises) {
                            const exSlug = ex.exerciseSlug || ex.slug || ex.exerciseName?.toLowerCase().replace(/\s+/g, "_");
                            if (exSlug === currentExerciseSlug || ex.exerciseName?.toLowerCase() === currentExerciseSlug.toLowerCase()) {
                                ex.exerciseName = replacementEx?.name || chosenSlug;
                                ex.exerciseSlug = chosenSlug;
                                replacedCount++;
                            }
                        }
                    }
                    (0, db_1.saveUserState)(userId);
                }
                return {
                    success: true,
                    action: "REPLACE_EXERCISE",
                    summary: `Replaced ${currentExerciseSlug} with ${replacementEx?.name || chosenSlug}`,
                    badge: `🔄 Exercise Swapped`,
                    details: { oldExercise: currentExerciseSlug, newExercise: chosenSlug, replacedCount },
                };
            }
            case "ADJUST_TODAYS_WORKOUT": {
                const { fatigueLevel, timeAvailableMin, targetRPECap } = actionData.parameters;
                if (userState.workoutPlan?.days && userState.workoutPlan.days.length > 0) {
                    const today = userState.workoutPlan.days[0];
                    if (fatigueLevel === "HIGH" || fatigueLevel === "EXTREME") {
                        // Drop volume: cap sets to 2, cap RPE
                        for (const ex of today.exercises) {
                            ex.sets = Math.max(2, Math.floor(ex.sets * 0.7));
                            ex.rpeTarget = targetRPECap || 7.0;
                        }
                    }
                    if (timeAvailableMin && timeAvailableMin < 40) {
                        // Trim to first 4 exercises
                        today.exercises = today.exercises.slice(0, 4);
                    }
                    (0, db_1.saveUserState)(userId);
                }
                return {
                    success: true,
                    action: "ADJUST_TODAYS_WORKOUT",
                    summary: `Adjusted today's workout for ${fatigueLevel.toLowerCase()} fatigue (capped volume & RPE)`,
                    badge: `🔋 Workout Adjusted`,
                    details: { fatigueLevel, timeAvailableMin, targetRPECap },
                };
            }
            case "REPLACE_MEAL": {
                const { mealSlot, dietaryPreferenceOverride } = actionData.parameters;
                const allRecipes = await recipeService_1.recipeService.getAllRecipes();
                const safeCandidates = recipeService_1.recipeService.filterSafeRecipes(allRecipes, {
                    slot: mealSlot,
                    dietaryPreference: dietaryPreferenceOverride || userState.fitnessProfile?.dietaryPreference || "Omnivore",
                    allergies: userState.fitnessProfile?.allergies || [],
                    dislikedFoods: userState.fitnessProfile?.dislikedFoods || [],
                    budgetTier: userState.fitnessProfile?.budgetTier || "MEDIUM",
                });
                if (safeCandidates.length === 0) {
                    return {
                        success: false,
                        action: "REPLACE_MEAL",
                        summary: `No safe recipe candidates found for ${mealSlot} matching current dietary and allergen constraints.`,
                        badge: "⚠️ Swap Unavailable",
                    };
                }
                const chosenRecipe = safeCandidates[0];
                const aiMeals = userState.aiMeals || [];
                const idx = aiMeals.findIndex((m) => m.mealSlot === mealSlot);
                const newMeal = {
                    mealSlot,
                    recipeTitle: chosenRecipe.title,
                    ingredients: chosenRecipe.ingredients.map((i) => `${i.name} (${i.baseQty || 50}${i.scalingUnit || "g"})`),
                    instructions: chosenRecipe.instructions,
                    calories: Math.round((userState.nutritionPlan?.calorieTarget?.value || 2400) / 4),
                    proteinG: Math.round((userState.nutritionPlan?.proteinTargetG?.value || 160) / 4),
                };
                if (idx >= 0) {
                    aiMeals[idx] = newMeal;
                }
                else {
                    aiMeals.push(newMeal);
                }
                userState.aiMeals = aiMeals;
                (0, db_1.saveUserState)(userId);
                return {
                    success: true,
                    action: "REPLACE_MEAL",
                    summary: `Replaced ${mealSlot.toLowerCase()} with ${chosenRecipe.title}`,
                    badge: `🥗 Meal Swapped`,
                    details: { mealSlot, recipeTitle: chosenRecipe.title },
                };
            }
            case "ADJUST_MEAL_PORTION": {
                const { mealSlot, calorieMultiplier } = actionData.parameters;
                const aiMeals = userState.aiMeals || [];
                const targetMeal = aiMeals.find((m) => m.mealSlot === mealSlot);
                if (targetMeal) {
                    targetMeal.calories = Math.round(targetMeal.calories * calorieMultiplier);
                    targetMeal.proteinG = Math.round(targetMeal.proteinG * calorieMultiplier);
                    (0, db_1.saveUserState)(userId);
                }
                return {
                    success: true,
                    action: "ADJUST_MEAL_PORTION",
                    summary: `Portion adjusted for ${mealSlot}: ${Math.round(calorieMultiplier * 100)}% of previous size`,
                    badge: `📏 Portion Adjusted`,
                    details: { mealSlot, calorieMultiplier },
                };
            }
            case "ADJUST_CALORIE_TARGET": {
                const { deltaCalories, newCalorieTarget, reason } = actionData.parameters;
                const currentCalories = userState.nutritionPlan?.calorieTarget?.value || 2500;
                let targetCalories = currentCalories;
                if (typeof newCalorieTarget === "number") {
                    targetCalories = newCalorieTarget;
                }
                else if (typeof deltaCalories === "number") {
                    targetCalories = currentCalories + deltaCalories;
                }
                // Enforce physiological safety boundaries (1200 - 5000 kcal)
                targetCalories = Math.max(1200, Math.min(5000, targetCalories));
                const effectiveDelta = targetCalories - currentCalories;
                // If userState doesn't have nutritionPlan, build baseline
                if (!userState.nutritionPlan) {
                    userState.nutritionPlan = (0, nutritionEngine_1.calculateNutrition)({
                        weightKg: userState.profile?.weightKg || 75,
                        heightCm: userState.profile?.heightCm || 175,
                        age: userState.profile?.age || 25,
                        sex: userState.profile?.sex || "MALE",
                        workoutDaysPerWeek: userState.fitnessProfile?.workoutDaysPerWeek || 4,
                        goal: userState.goal?.type || "GENERAL_FITNESS",
                        budgetTier: userState.fitnessProfile?.budgetTier || "MEDIUM",
                    });
                }
                userState.nutritionPlan.calorieTarget = {
                    value: targetCalories,
                    provenance: "CALCULATED",
                };
                // Recalculate macro targets
                userState.nutritionPlan.carbTargetG = {
                    value: Math.round((targetCalories * 0.45) / 4),
                    provenance: "CALCULATED",
                };
                userState.nutritionPlan.fatTargetG = {
                    value: Math.round((targetCalories * 0.25) / 9),
                    provenance: "CALCULATED",
                };
                // Scale planned meals proportionally to match the exact target
                if (userState.aiMeals && Array.isArray(userState.aiMeals) && userState.aiMeals.length > 0) {
                    const meals = userState.aiMeals;
                    const currentSum = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
                    const ratio = currentSum > 0 ? targetCalories / currentSum : targetCalories / (meals.length * 500);
                    let allocated = 0;
                    for (let i = 0; i < meals.length; i++) {
                        if (i === meals.length - 1) {
                            meals[i].calories = Math.max(100, targetCalories - allocated);
                        }
                        else {
                            const mealCals = Math.round((meals[i].calories || 500) * ratio);
                            meals[i].calories = mealCals;
                            allocated += mealCals;
                        }
                    }
                }
                (0, db_1.saveUserState)(userId);
                const deltaSign = effectiveDelta > 0 ? `+${effectiveDelta}` : `${effectiveDelta}`;
                const summary = effectiveDelta !== 0
                    ? `Daily calorie target adjusted to ${targetCalories.toLocaleString()} kcal (${deltaSign} kcal). Meal portions and macro distributions updated across the app.`
                    : `Daily calorie target set to ${targetCalories.toLocaleString()} kcal. Meal portions and macro distributions updated across the app.`;
                return {
                    success: true,
                    action: "ADJUST_CALORIE_TARGET",
                    summary,
                    badge: `🎯 ${targetCalories.toLocaleString()} kcal (${deltaSign} kcal)`,
                    details: {
                        previousCalories: currentCalories,
                        newCalorieTarget: targetCalories,
                        delta: effectiveDelta,
                        reason,
                    },
                };
            }
            case "RECALCULATE_NUTRITION": {
                const { weightKg, goal, calorieDelta } = actionData.parameters;
                const currentWt = weightKg || userState.profile?.weightKg || 75;
                const currentGoal = goal || userState.goal?.type || "GENERAL_FITNESS";
                let recalculated = (0, nutritionEngine_1.calculateNutrition)({
                    weightKg: currentWt,
                    heightCm: userState.profile?.heightCm || 175,
                    age: userState.profile?.age || 25,
                    sex: userState.profile?.sex || "MALE",
                    workoutDaysPerWeek: userState.fitnessProfile?.workoutDaysPerWeek || 4,
                    goal: currentGoal,
                    budgetTier: userState.fitnessProfile?.budgetTier || "MEDIUM",
                });
                if (calorieDelta) {
                    const adjustedCals = Math.max(1200, Math.min(5000, recalculated.calorieTarget.value + calorieDelta));
                    recalculated.calorieTarget.value = adjustedCals;
                }
                userState.nutritionPlan = recalculated;
                (0, db_1.saveUserState)(userId);
                return {
                    success: true,
                    action: "RECALCULATE_NUTRITION",
                    summary: `Recalibrated daily target: ${recalculated.calorieTarget.value} kcal / ${recalculated.proteinTargetG.value}g protein`,
                    badge: `⚡ Macros Recalibrated`,
                    details: {
                        calorieTarget: recalculated.calorieTarget.value,
                        proteinTarget: recalculated.proteinTargetG.value,
                    },
                };
            }
            case "REQUEST_PLAN_REGENERATION": {
                const { reason, regenerateWorkout, regenerateNutrition } = actionData.parameters;
                const context = await personalizationContextBuilder_1.personalizationContextBuilder.buildContext(userId);
                if (regenerateWorkout) {
                    userState.workoutPlan = (0, workoutEngine_1.generateWorkoutPlan)({
                        experienceLevel: context.training.experienceLevel,
                        trainingEnvironment: context.training.trainingEnvironment,
                        equipmentAvailable: context.training.equipmentAvailable,
                        workoutDaysPerWeek: context.training.workoutDaysPerWeek,
                        sessionDurationMin: context.training.sessionDurationMin,
                        injuries: context.safety.injuries,
                        goal: context.goal.type,
                        targetPhysiqueFocus: context.targetPhysique?.standoutMuscles || [],
                        isConservativeSafeMode: context.safety.conservativeMode,
                    });
                }
                if (regenerateNutrition) {
                    const dynamicPlan = await nutritionPlanner_1.nutritionPlanner.assembleDynamicPlan(context);
                    userState.nutritionPlan = (0, nutritionEngine_1.calculateNutrition)({
                        weightKg: context.profile.weightKg,
                        heightCm: context.profile.heightCm,
                        age: context.profile.age,
                        sex: context.profile.sex,
                        workoutDaysPerWeek: context.training.workoutDaysPerWeek,
                        goal: context.goal.type,
                        budgetTier: context.nutrition.budgetTier,
                    });
                    userState.aiMeals = dynamicPlan.meals;
                }
                (0, db_1.saveUserState)(userId);
                return {
                    success: true,
                    action: "REQUEST_PLAN_REGENERATION",
                    summary: `Plan regenerated: ${reason}`,
                    badge: `🔄 Plan Regenerated`,
                    details: { reason, regenerateWorkout, regenerateNutrition },
                };
            }
            default:
                return {
                    success: false,
                    action: "UNKNOWN",
                    summary: "Unrecognized action",
                    badge: "❓ Unknown Action",
                };
        }
    }
}
exports.CoachActionService = CoachActionService;
exports.coachActionService = new CoachActionService();
