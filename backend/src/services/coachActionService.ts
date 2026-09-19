import { z } from "zod";
import { getUserState, saveUserState, prisma } from "../db";
import { exerciseService } from "./exerciseService";
import { recipeService } from "./recipeService";
import { calculateNutrition } from "../engines/nutritionEngine";
import { tdeeRecalibrationService } from "./tdeeRecalibrationService";
import { generateWorkoutPlan } from "../engines/workoutEngine";
import { nutritionPlanner } from "./nutritionPlanner";
import { personalizationContextBuilder } from "./personalizationContextBuilder";

// --- Zod Action Schemas ---
export const LogWeightActionSchema = z.object({
  action: z.literal("LOG_WEIGHT"),
  parameters: z.object({
    weightKg: z.number().min(30).max(300),
    loggedAt: z.string().optional(),
  }),
});

export const LogWaterActionSchema = z.object({
  action: z.literal("LOG_WATER"),
  parameters: z.object({
    amountMl: z.number().min(50).max(4000),
  }),
});

export const LogWorkoutActionSchema = z.object({
  action: z.literal("LOG_WORKOUT"),
  parameters: z.object({
    workoutDayFocus: z.string(),
    durationMin: z.number().min(5).max(300).optional(),
    notes: z.string().optional(),
  }),
});

export const LogExerciseSetActionSchema = z.object({
  action: z.literal("LOG_EXERCISE_SET"),
  parameters: z.object({
    exerciseSlug: z.string().min(1),
    setNumber: z.number().min(1).max(20),
    reps: z.number().min(1).max(100),
    weightKg: z.number().min(0).max(500).optional(),
    rpe: z.number().min(1).max(10).optional(),
  }),
});

export const ReplaceExerciseActionSchema = z.object({
  action: z.literal("REPLACE_EXERCISE"),
  parameters: z.object({
    currentExerciseSlug: z.string().min(1),
    replacementExerciseSlug: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export const AdjustTodaysWorkoutActionSchema = z.object({
  action: z.literal("ADJUST_TODAYS_WORKOUT"),
  parameters: z.object({
    fatigueLevel: z.enum(["LOW", "MODERATE", "HIGH", "EXTREME"]),
    timeAvailableMin: z.number().min(10).max(120).optional(),
    targetRPECap: z.number().min(5).max(10).optional(),
  }),
});

export const ReplaceMealActionSchema = z.object({
  action: z.literal("REPLACE_MEAL"),
  parameters: z.object({
    mealSlot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
    dietaryPreferenceOverride: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export const AdjustMealPortionActionSchema = z.object({
  action: z.literal("ADJUST_MEAL_PORTION"),
  parameters: z.object({
    mealSlot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
    calorieMultiplier: z.number().min(0.5).max(2.0),
  }),
});

export const RecalculateNutritionActionSchema = z.object({
  action: z.literal("RECALCULATE_NUTRITION"),
  parameters: z.object({
    weightKg: z.number().min(30).max(300).optional(),
    goal: z.string().optional(),
    calorieDelta: z.number().min(-1000).max(1000).optional(),
  }),
});

export const RequestPlanRegenerationActionSchema = z.object({
  action: z.literal("REQUEST_PLAN_REGENERATION"),
  parameters: z.object({
    reason: z.string(),
    regenerateWorkout: z.boolean().default(true),
    regenerateNutrition: z.boolean().default(true),
  }),
});

export const AdjustCalorieTargetActionSchema = z.object({
  action: z.literal("ADJUST_CALORIE_TARGET"),
  parameters: z.object({
    deltaCalories: z.number().min(-2000).max(2000).optional(),
    newCalorieTarget: z.number().min(1000).max(6000).optional(),
    reason: z.string().optional(),
  }),
});

export const CoachActionSchema = z.discriminatedUnion("action", [
  LogWeightActionSchema,
  LogWaterActionSchema,
  LogWorkoutActionSchema,
  LogExerciseSetActionSchema,
  ReplaceExerciseActionSchema,
  AdjustTodaysWorkoutActionSchema,
  ReplaceMealActionSchema,
  AdjustMealPortionActionSchema,
  AdjustCalorieTargetActionSchema,
  RecalculateNutritionActionSchema,
  RequestPlanRegenerationActionSchema,
]);

export type CoachAction = z.infer<typeof CoachActionSchema>;

export interface CoachActionResult {
  success: boolean;
  action: string;
  summary: string;
  badge: string;
  details?: any;
  error?: string;
}

export class CoachActionService {
  /**
   * Validates and executes a coach structured action deterministically.
   * Enforces Zod validation, authorization, and safety gate limits.
   */
  async executeAction(userId: string, rawAction: any): Promise<CoachActionResult> {
    // 1. Zod Schema Validation
    const parseResult = CoachActionSchema.safeParse(rawAction);
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
    const userState = getUserState(userId);

    // 2. Authorization & Safety checks per action type
    switch (actionData.action) {
      case "LOG_WEIGHT": {
        const { weightKg } = actionData.parameters;
        if (!userState.profile) {
          userState.profile = { name: "Athlete", age: 25, sex: "MALE", heightCm: 175, weightKg };
        } else {
          userState.profile.weightKg = weightKg;
        }

        // Add to WeightLog service
        const recalResult = tdeeRecalibrationService.logWeightAndEvaluate(userId, weightKg);

        if (recalResult.recalibrated && recalResult.newCalorieTarget && userState.nutritionPlan) {
          userState.nutritionPlan.calorieTarget = {
            value: recalResult.newCalorieTarget,
            provenance: "CALCULATED",
          };
        } else if (userState.fitnessProfile && userState.goal) {
          userState.nutritionPlan = calculateNutrition({
            weightKg,
            heightCm: userState.profile.heightCm,
            age: userState.profile.age,
            sex: userState.profile.sex,
            workoutDaysPerWeek: userState.fitnessProfile.workoutDaysPerWeek,
            goal: userState.goal.type,
            budgetTier: userState.fitnessProfile.budgetTier,
          });
        }

        saveUserState(userId);
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
        saveUserState(userId);
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
        if (!(userState as any).workoutSessionLogs) {
          (userState as any).workoutSessionLogs = [];
        }
        (userState as any).workoutSessionLogs.push({
          focus: workoutDayFocus,
          durationMin: durationMin || 45,
          notes: notes || "Session completed",
          completedAt: new Date().toISOString(),
        });
        saveUserState(userId);

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
        if (!(userState as any).exerciseSetLogs) {
          (userState as any).exerciseSetLogs = [];
        }
        (userState as any).exerciseSetLogs.push({
          exerciseSlug,
          setNumber,
          reps,
          weightKg: weightKg || 0,
          rpe: rpe || 8.0,
          completedAt: new Date().toISOString(),
        });
        saveUserState(userId);

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
          const alternatives = exerciseService.getAlternatives(currentExerciseSlug, {
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
        const replacementEx = exerciseService.getExerciseBySlug(chosenSlug);
        if (replacementEx) {
          const hasInjuryConflict = replacementEx.contraindications?.some((c) =>
            injuries.some((inj) => c.toLowerCase().includes(inj.toLowerCase()))
          );
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
          saveUserState(userId);
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
          saveUserState(userId);
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
        const allRecipes = await recipeService.getAllRecipes();
        const safeCandidates = recipeService.filterSafeRecipes(allRecipes, {
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
        const aiMeals = (userState as any).aiMeals || [];
        const idx = aiMeals.findIndex((m: any) => m.mealSlot === mealSlot);
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
        } else {
          aiMeals.push(newMeal);
        }
        (userState as any).aiMeals = aiMeals;
        saveUserState(userId);

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
        const aiMeals = (userState as any).aiMeals || [];
        const targetMeal = aiMeals.find((m: any) => m.mealSlot === mealSlot);
        if (targetMeal) {
          targetMeal.calories = Math.round(targetMeal.calories * calorieMultiplier);
          targetMeal.proteinG = Math.round(targetMeal.proteinG * calorieMultiplier);
          saveUserState(userId);
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
        } else if (typeof deltaCalories === "number") {
          targetCalories = currentCalories + deltaCalories;
        }

        // Enforce physiological safety boundaries (1200 - 5000 kcal)
        targetCalories = Math.max(1200, Math.min(5000, targetCalories));
        const effectiveDelta = targetCalories - currentCalories;

        // If userState doesn't have nutritionPlan, build baseline
        if (!userState.nutritionPlan) {
          userState.nutritionPlan = calculateNutrition({
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
        if ((userState as any).aiMeals && Array.isArray((userState as any).aiMeals) && (userState as any).aiMeals.length > 0) {
          const meals = (userState as any).aiMeals;
          const currentSum = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
          const ratio = currentSum > 0 ? targetCalories / currentSum : targetCalories / (meals.length * 500);

          let allocated = 0;
          for (let i = 0; i < meals.length; i++) {
            if (i === meals.length - 1) {
              meals[i].calories = Math.max(100, targetCalories - allocated);
            } else {
              const mealCals = Math.round((meals[i].calories || 500) * ratio);
              meals[i].calories = mealCals;
              allocated += mealCals;
            }
          }
        }

        saveUserState(userId);

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
        const currentGoal = (goal as any) || userState.goal?.type || "GENERAL_FITNESS";

        let recalculated = calculateNutrition({
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
        saveUserState(userId);

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
        const context = await personalizationContextBuilder.buildContext(userId);

        if (regenerateWorkout) {
          userState.workoutPlan = generateWorkoutPlan({
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
          const dynamicPlan = await nutritionPlanner.assembleDynamicPlan(context);
          userState.nutritionPlan = calculateNutrition({
            weightKg: context.profile.weightKg,
            heightCm: context.profile.heightCm,
            age: context.profile.age,
            sex: context.profile.sex,
            workoutDaysPerWeek: context.training.workoutDaysPerWeek,
            goal: context.goal.type,
            budgetTier: context.nutrition.budgetTier,
          });
          (userState as any).aiMeals = dynamicPlan.meals;
        }

        saveUserState(userId);

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

export const coachActionService = new CoachActionService();
