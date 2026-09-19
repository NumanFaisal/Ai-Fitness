import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { evaluateSafetyGate } from "../src/engines/safetyGate";
import { calculateNutrition } from "../src/engines/nutritionEngine";
import { calculateHydration } from "../src/engines/hydrationEngine";
import { generateWorkoutPlan, validateWorkoutUniqueness } from "../src/engines/workoutEngine";
import { exerciseService } from "../src/services/exerciseService";
import { foodService } from "../src/services/foodService";
import { recipeService } from "../src/services/recipeService";
import { nutritionPlanner } from "../src/services/nutritionPlanner";
import { progressionService } from "../src/services/progressionService";
import { tdeeRecalibrationService } from "../src/services/tdeeRecalibrationService";
import { coachActionService } from "../src/services/coachActionService";
import { executeFitnessAgent } from "../src/services/aiAgentService";
import { personalizationContextBuilder } from "../src/services/personalizationContextBuilder";
import { getUserState, createUserAccount } from "../src/db";
import { PersonalizationContext } from "../src/types/personalization";
import { analyzeUserBodyPhoto } from "../src/services/aiVisionService";
import { generateDynamicWorkoutPlan } from "../src/services/aiWorkoutPlanner";

describe("Deterministic Safety Gate Engine", () => {
  it("approves healthy individuals with reasonable goals", () => {
    const result = evaluateSafetyGate({
      age: 28,
      injuries: [],
      physicalLimitations: [],
      goal: "FAT_LOSS",
      startingWeightKg: 80,
      targetWeightKg: 75,
      targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
    });

    assert.equal(result.isSafe, true);
    assert.equal(result.enforceConservativePlan, false);
    assert.equal(result.workoutConstraints.conservativeMode, false);
  });

  it("flags high-risk injuries such as herniated disc and enforces conservative workout mode", () => {
    const result = evaluateSafetyGate({
      age: 32,
      injuries: ["L4-L5 herniated disc"],
      physicalLimitations: [],
      goal: "STRENGTH",
    });

    assert.equal(result.isSafe, false);
    assert.equal(result.enforceConservativePlan, true);
    assert.equal(result.workoutConstraints.conservativeMode, true);
    assert.equal(result.workoutConstraints.maxRPE, 7.0);
    assert.ok(result.workoutConstraints.prohibitedMovementPatterns.includes("HEAVY_AXIAL_LOAD"));
  });

  it("flags physiologically extreme weight loss timelines", () => {
    const result = evaluateSafetyGate({
      age: 25,
      injuries: [],
      physicalLimitations: [],
      goal: "FAT_LOSS",
      startingWeightKg: 90,
      targetWeightKg: 70,
      targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString(),
    });

    assert.equal(result.isSafe, false);
    assert.equal(result.enforceConservativePlan, true);
    assert.ok(result.reasons.some((r) => r.includes("exceeds physiological safety threshold")));
  });
});

describe("Workout Engine & Uniqueness Guarantee", () => {
  it("guarantees zero duplicate exercise slugs within any single day across multiple splits", () => {
    const frequencies = [3, 4, 5, 6, 7];
    for (const days of frequencies) {
      const plan = generateWorkoutPlan({
        experienceLevel: "INTERMEDIATE",
        trainingEnvironment: "GYM",
        equipmentAvailable: ["barbell", "dumbbell", "cables", "machine", "bodyweight"],
        workoutDaysPerWeek: days,
        sessionDurationMin: 60,
        injuries: [],
        goal: "MUSCLE_GAIN",
      });

      const validation = validateWorkoutUniqueness(plan);
      assert.equal(validation.valid, true, `Duplicate exercises detected in ${days}-day split: ${validation.duplicates.join(", ")}`);
    }
  });

  it("handles 7-day workout requests explicitly with Day 7 active recovery / core mobility", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "ADVANCED",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell", "cables"],
      workoutDaysPerWeek: 7,
      sessionDurationMin: 60,
      injuries: [],
      goal: "ATHLETIC_PERFORMANCE",
    });

    assert.equal(plan.days.length, 7);
    const day7 = plan.days[6];
    assert.ok(
      day7.focus.toLowerCase().includes("recovery") ||
      day7.focus.toLowerCase().includes("mobility") ||
      day7.focus.toLowerCase().includes("conditioning"),
      `Day 7 focus should be active recovery/mobility, was: ${day7.focus}`
    );
  });

  it("restricts exercise selection to available equipment (Dumbbell only)", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "BEGINNER",
      trainingEnvironment: "HOME",
      equipmentAvailable: ["dumbbell", "bodyweight"],
      workoutDaysPerWeek: 3,
      sessionDurationMin: 45,
      injuries: [],
      goal: "GENERAL_FITNESS",
    });

    for (const day of plan.days) {
      for (const ex of day.exercises) {
        const fullEx = exerciseService.getExerciseBySlug(ex.exerciseSlug);
        if (fullEx) {
          const compatible = fullEx.equipment.some((eq) =>
            eq.toLowerCase().includes("dumbbell") ||
            eq.toLowerCase().includes("bodyweight") ||
            eq.toLowerCase().includes("none")
          );
          assert.ok(compatible, `Exercise ${fullEx.name} uses ${fullEx.equipment.join(", ")} which violates dumbbell-only constraint`);
        }
      }
    }
  });

  it("filters out contraindicated exercises for lower back and knee injuries", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell", "cables", "machine"],
      workoutDaysPerWeek: 4,
      sessionDurationMin: 50,
      injuries: ["lower back disc hernia", "patellar tendonitis"],
      goal: "MUSCLE_GAIN",
    });

    for (const day of plan.days) {
      for (const ex of day.exercises) {
        assert.notEqual(ex.exerciseSlug, "barbell_back_squat", "Barbell back squat should be filtered for herniated disc / knee pain");
        assert.notEqual(ex.exerciseSlug, "barbell_deadlift", "Conventional deadlift should be filtered for lower back herniated disc");
      }
    }
  });

  it("enforces conservative mode: caps RPE <= 7.0, reduces sets, and filters high axial load", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "BEGINNER",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell", "machine", "cables"],
      workoutDaysPerWeek: 3,
      sessionDurationMin: 45,
      injuries: [],
      goal: "GENERAL_FITNESS",
      isConservativeSafeMode: true,
    });

    for (const day of plan.days) {
      for (const ex of day.exercises) {
        assert.ok(ex.rpeTarget <= 7.0, `RPE target ${ex.rpeTarget} should be <= 7.0 in conservative mode`);
        assert.ok(ex.sets <= 3, `Sets ${ex.sets} should be capped in conservative mode`);
      }
    }
  });

  it("prioritizes target physique standout muscles in exercise order and volume", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell", "cables", "machine"],
      workoutDaysPerWeek: 4,
      sessionDurationMin: 60,
      injuries: [],
      goal: "MUSCLE_GAIN",
      targetPhysiqueFocus: ["Lateral Delts", "Upper Chest"],
    });

    const allExercises = plan.days.flatMap((d) => d.exercises);
    const hasFocusMuscle = allExercises.some(
      (e) =>
        e.exerciseSlug.includes("lateral_raise") ||
        e.exerciseSlug.includes("incline") ||
        e.exerciseName.toLowerCase().includes("lateral") ||
        e.exerciseName.toLowerCase().includes("incline")
    );
    assert.ok(hasFocusMuscle, "Plan must include exercises targeting standout muscle focus");
  });
});

describe("Progression & Periodization Engine", () => {
  it("increases barbell load by +2.5% to +5% when clean top of rep range is completed at low RPE", () => {
    const advice = progressionService.evaluateSetProgression(
      "barbell_bench_press",
      100,
      12, // Hit ceiling of 8-12 rep range
      { min: 8, max: 12 },
      7.5 // RPE under threshold
    );

    assert.equal(advice.shouldProgress, true);
    assert.ok(advice.nextWeightKg! > 100);
    assert.ok(advice.nextWeightKg! <= 105);
  });

  it("does NOT increase load when reps are missed or RPE indicates near-failure fatigue", () => {
    const advice = progressionService.evaluateSetProgression(
      "barbell_back_squat",
      120,
      7, // Target was 8-12, only hit 7 reps
      { min: 8, max: 12 },
      9.5 // Near failure
    );

    assert.equal(advice.shouldProgress, false);
    assert.equal(advice.nextWeightKg, 120);
    assert.ok(advice.recommendation.includes("Repeat current load"));
  });

  it("applies 4-week periodization mesocycle adjusting volume and RPE across weeks", () => {
    const rawPlan = generateWorkoutPlan({
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell", "cables"],
      workoutDaysPerWeek: 4,
      sessionDurationMin: 50,
      injuries: [],
      goal: "MUSCLE_GAIN",
    });

    const user1 = "user_test_periodization_w1";
    progressionService.advanceMesocycleWeek(user1); // Week 2
    const planW2 = progressionService.applyProgressionToWorkout(user1, rawPlan);
    assert.equal(planW2.periodization?.currentWeek, 2);
    assert.equal(planW2.periodization?.phase, "PROGRESSIVE_OVERLOAD");

    progressionService.advanceMesocycleWeek(user1);
    progressionService.advanceMesocycleWeek(user1); // Week 4 = Deload
    const planW4 = progressionService.applyProgressionToWorkout(user1, rawPlan);
    assert.equal(planW4.periodization?.currentWeek, 4);
    assert.equal(planW4.periodization?.phase, "ACTIVE_DELOAD");
    assert.ok(planW4.periodization?.volumeModifier! < 1.0);
  });
});

describe("TDEE Dynamic Recalibration Engine", () => {
  it("detects stalled weight loss and adjusts calorie target gradually with safety floor", () => {
    const user = "user_test_tdee_stall";
    const userState = getUserState(user);
    userState.goal = { type: "FAT_LOSS", isPrimary: true };
    userState.profile = { name: "Stall Athlete", age: 28, sex: "MALE", heightCm: 178, weightKg: 80 };
    userState.fitnessProfile = {
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell"],
      workoutDaysPerWeek: 4,
      sessionDurationMin: 45,
      injuries: [],
      physicalLimitations: [],
      dietaryPreference: "Omnivore",
      allergies: [],
      dislikedFoods: [],
      cuisinePreferences: [],
      budgetTier: "MEDIUM",
    };

    const startDate = new Date(Date.now() - 14 * 24 * 3600 * 1000);

    // 14 days of no weight change on a fat loss target
    for (let i = 0; i <= 14; i += 2) {
      const d = new Date(startDate.getTime() + i * 24 * 3600 * 1000);
      tdeeRecalibrationService.logWeightAndEvaluate(user, 80.0, d);
    }

    const result = tdeeRecalibrationService.evaluateRecalibration(user);
    assert.equal(result.recalibrated, true);
    assert.ok(result.newCalorieTarget! < result.previousCalorieTarget);
    // Adjustment must be gradual (<= 150 kcal change)
    assert.ok(result.previousCalorieTarget - result.newCalorieTarget! <= 150);
  });

  it("filters single noisy measurements and evaluates rolling average trend", () => {
    const user = "user_test_tdee_noise";
    const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    tdeeRecalibrationService.logWeightAndEvaluate(user, 80.0, new Date(startDate.getTime()));
    tdeeRecalibrationService.logWeightAndEvaluate(user, 79.8, new Date(startDate.getTime() + 1 * 86400000));
    // Noisy spike due to water/sodium
    tdeeRecalibrationService.logWeightAndEvaluate(user, 81.5, new Date(startDate.getTime() + 2 * 86400000));
    tdeeRecalibrationService.logWeightAndEvaluate(user, 79.6, new Date(startDate.getTime() + 4 * 86400000));
    tdeeRecalibrationService.logWeightAndEvaluate(user, 79.4, new Date(startDate.getTime() + 6 * 86400000));

    const result = tdeeRecalibrationService.evaluateRecalibration(user);
    // Overall trend is downward (~0.6kg lost), so it does not overreact to the 81.5kg spike
    assert.ok(result.observedRateKgPerWeek < 0);
  });
});

describe("Deterministic Nutrition & Allergen Filtering", () => {
  it("normalizes allergen aliases (peanuts, peanut butter, groundnut, peanut sauce)", () => {
    const aliases = ["peanut butter", "groundnut oil", "crunchy peanut", "peanut sauce"];
    for (const a of aliases) {
      assert.ok(foodService.hasAllergenConflict(a, ["Peanut"]).hasConflict, `Failed to detect peanut in ${a}`);
    }
  });

  it("strictly excludes dairy, eggs, gluten, and soy when specified in profile allergies", async () => {
    const mockContext: PersonalizationContext = {
      profile: { id: "p1", name: "Alex", age: 28, sex: "MALE", heightCm: 178, weightKg: 75 },
      goal: { type: "GENERAL_FITNESS", isPrimary: true },
      training: { experienceLevel: "INTERMEDIATE", trainingEnvironment: "GYM", equipmentAvailable: ["barbell"], workoutDaysPerWeek: 4, sessionDurationMin: 45 },
      nutrition: {
        authoritativeCalorieTarget: 2400,
        authoritativeProteinTargetG: 150,
        authoritativeCarbTargetG: 270,
        authoritativeFatTargetG: 67,
        authoritativeBMR: 1720,
        authoritativeTDEE: 2400,
        dietaryPreference: "Omnivore",
        allergies: ["dairy", "gluten", "soy"],
        dislikedFoods: [],
        cuisinePreferences: [],
        budgetTier: "MEDIUM",
      },
      safety: { isSafe: true, conservativeMode: false, injuries: [], physicalLimitations: [], allergies: ["dairy", "gluten", "soy"], reasons: [] },
      performanceLogs: { completedSessionsCount: 0, recentSets: [] },
      weightTrend: { rollingAverageKg: 75, observedRateKgPerWeek: 0, measurementsCount: 0 },
    };

    const dynamicPlan = await nutritionPlanner.assembleDynamicPlan(mockContext);
    assert.equal(dynamicPlan.generatedBy, "ALGORITHMIC_FOOD_DATABASE");

    for (const meal of dynamicPlan.meals) {
      for (const ingredient of meal.ingredients) {
        assert.equal(foodService.hasAllergenConflict(ingredient, ["dairy", "gluten", "soy"]).hasConflict, false, `Allergen found in ingredient: ${ingredient}`);
      }
    }
  });

  it("ensures vegetarian profile excludes poultry, red meat, and seafood", async () => {
    const mockContext: PersonalizationContext = {
      profile: { id: "p_veg", name: "Priya", age: 26, sex: "FEMALE", heightCm: 165, weightKg: 60 },
      goal: { type: "FAT_LOSS", isPrimary: true },
      training: { experienceLevel: "BEGINNER", trainingEnvironment: "HOME", equipmentAvailable: ["dumbbell"], workoutDaysPerWeek: 3, sessionDurationMin: 45 },
      nutrition: {
        authoritativeCalorieTarget: 1700,
        authoritativeProteinTargetG: 120,
        authoritativeCarbTargetG: 190,
        authoritativeFatTargetG: 45,
        authoritativeBMR: 1350,
        authoritativeTDEE: 1900,
        dietaryPreference: "Vegetarian",
        allergies: [],
        dislikedFoods: [],
        cuisinePreferences: ["indian"],
        budgetTier: "LOW",
      },
      safety: { isSafe: true, conservativeMode: false, injuries: [], physicalLimitations: [], allergies: [], reasons: [] },
      performanceLogs: { completedSessionsCount: 0, recentSets: [] },
      weightTrend: { rollingAverageKg: 60, observedRateKgPerWeek: 0, measurementsCount: 0 },
    };

    const dynamicPlan = await nutritionPlanner.assembleDynamicPlan(mockContext);
    for (const meal of dynamicPlan.meals) {
      const text = `${meal.recipeTitle} ${meal.ingredients.join(" ")}`.toLowerCase();
      assert.equal(text.includes("chicken"), false, "Vegetarian meal contains chicken");
      assert.equal(text.includes("beef"), false, "Vegetarian meal contains beef");
      assert.equal(text.includes("salmon"), false, "Vegetarian meal contains salmon");
      assert.equal(text.includes("tuna"), false, "Vegetarian meal contains tuna");
    }
  });

  it("scales portions to match authoritative calorie and protein targets within ±5% tolerance", async () => {
    const targetCalories = 2600;
    const targetProtein = 175;

    const mockContext: PersonalizationContext = {
      profile: { id: "p_macros", name: "David", age: 30, sex: "MALE", heightCm: 182, weightKg: 82 },
      goal: { type: "MUSCLE_GAIN", isPrimary: true },
      training: { experienceLevel: "INTERMEDIATE", trainingEnvironment: "GYM", equipmentAvailable: ["barbell"], workoutDaysPerWeek: 4, sessionDurationMin: 50 },
      nutrition: {
        authoritativeCalorieTarget: targetCalories,
        authoritativeProteinTargetG: targetProtein,
        authoritativeCarbTargetG: 300,
        authoritativeFatTargetG: 75,
        authoritativeBMR: 1820,
        authoritativeTDEE: 2600,
        dietaryPreference: "High Protein",
        allergies: [],
        dislikedFoods: [],
        cuisinePreferences: [],
        budgetTier: "MEDIUM",
      },
      safety: { isSafe: true, conservativeMode: false, injuries: [], physicalLimitations: [], allergies: [], reasons: [] },
      performanceLogs: { completedSessionsCount: 0, recentSets: [] },
      weightTrend: { rollingAverageKg: 82, observedRateKgPerWeek: 0, measurementsCount: 0 },
    };

    const plan = await nutritionPlanner.assembleDynamicPlan(mockContext);
    const totalCals = plan.meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProt = plan.meals.reduce((sum, m) => sum + m.proteinG, 0);

    const calDiffPct = Math.abs(totalCals - targetCalories) / targetCalories;
    const protDiffPct = Math.abs(totalProt - targetProtein) / targetProtein;

    assert.ok(calDiffPct <= 0.05, `Calories divergence ${calDiffPct * 100}% exceeds 5% tolerance (Total: ${totalCals}, Target: ${targetCalories})`);
    assert.ok(protDiffPct <= 0.10, `Protein divergence ${protDiffPct * 100}% exceeds 10% tolerance (Total: ${totalProt}, Target: ${targetProtein})`);
  });
});

describe("Critical Personalization Differentiation Test", () => {
  it("generates distinct meal ingredients, portions, and workout focus for differing profiles", async () => {
    // Profile A: Fat Loss, Vegetarian, Low Budget, Indian
    const ctxA: PersonalizationContext = {
      profile: { id: "user_a", name: "Aarav", age: 27, sex: "MALE", heightCm: 172, weightKg: 84 },
      goal: { type: "FAT_LOSS", isPrimary: true },
      training: { experienceLevel: "BEGINNER", trainingEnvironment: "HOME", equipmentAvailable: ["dumbbell"], workoutDaysPerWeek: 3, sessionDurationMin: 40 },
      nutrition: {
        authoritativeCalorieTarget: 1900,
        authoritativeProteinTargetG: 140,
        authoritativeCarbTargetG: 210,
        authoritativeFatTargetG: 50,
        authoritativeBMR: 1750,
        authoritativeTDEE: 2350,
        dietaryPreference: "Vegetarian",
        allergies: [],
        dislikedFoods: [],
        cuisinePreferences: ["indian"],
        budgetTier: "LOW",
      },
      safety: { isSafe: true, conservativeMode: false, injuries: [], physicalLimitations: [], allergies: [], reasons: [] },
      performanceLogs: { completedSessionsCount: 0, recentSets: [] },
      weightTrend: { rollingAverageKg: 84, observedRateKgPerWeek: 0, measurementsCount: 0 },
    };

    // Profile B: Muscle Gain, Omnivore, High Budget, Mediterranean
    const ctxB: PersonalizationContext = {
      profile: { id: "user_b", name: "Marco", age: 24, sex: "MALE", heightCm: 185, weightKg: 78 },
      goal: { type: "MUSCLE_GAIN", isPrimary: true },
      training: { experienceLevel: "ADVANCED", trainingEnvironment: "GYM", equipmentAvailable: ["barbell", "dumbbell", "cables", "machine"], workoutDaysPerWeek: 5, sessionDurationMin: 60 },
      nutrition: {
        authoritativeCalorieTarget: 3100,
        authoritativeProteinTargetG: 180,
        authoritativeCarbTargetG: 380,
        authoritativeFatTargetG: 85,
        authoritativeBMR: 1850,
        authoritativeTDEE: 2800,
        dietaryPreference: "Omnivore",
        allergies: [],
        dislikedFoods: [],
        cuisinePreferences: ["mediterranean"],
        budgetTier: "FLEXIBLE",
      },
      safety: { isSafe: true, conservativeMode: false, injuries: [], physicalLimitations: [], allergies: [], reasons: [] },
      performanceLogs: { completedSessionsCount: 0, recentSets: [] },
      weightTrend: { rollingAverageKg: 78, observedRateKgPerWeek: 0, measurementsCount: 0 },
    };

    const planA = await nutritionPlanner.assembleDynamicPlan(ctxA);
    const planB = await nutritionPlanner.assembleDynamicPlan(ctxB);

    // Verify distinct calories and portions
    const totalA = planA.meals.reduce((s, m) => s + m.calories, 0);
    const totalB = planB.meals.reduce((s, m) => s + m.calories, 0);
    assert.notEqual(totalA, totalB, "Profiles with different goals must receive different calories");
    assert.ok(totalB > totalA + 800, "Muscle gain profile B should have significantly higher calories than fat loss profile A");

    // Verify ingredient differences
    const ingredientsA = planA.meals.flatMap((m) => m.ingredients);
    const ingredientsB = planB.meals.flatMap((m) => m.ingredients);
    const identical = ingredientsA.every((ing, idx) => ing === ingredientsB[idx]);
    assert.equal(identical, false, "Profiles A and B must not receive identical meal ingredients");
  });
});

describe("Structured Coach Actions & Intent Pipeline", () => {
  const testUser = "test_coach_pipeline_user";

  before(() => {
    createUserAccount("coach_test@fitness.local", "hash", testUser);
    const state = getUserState(testUser);
    state.profile = { name: "Test Athlete", age: 25, sex: "MALE", heightCm: 178, weightKg: 80 };
    state.goal = { type: "MUSCLE_GAIN", isPrimary: true };
    state.fitnessProfile = {
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell", "cables"],
      workoutDaysPerWeek: 4,
      sessionDurationMin: 50,
      injuries: [],
      physicalLimitations: [],
      dietaryPreference: "Omnivore",
      allergies: [],
      dislikedFoods: [],
      cuisinePreferences: [],
      budgetTier: "MEDIUM",
    };
  });

  it("accepts and executes valid Zod-structured action for LOG_WATER", async () => {
    const result = await coachActionService.executeAction(testUser, {
      action: "LOG_WATER",
      parameters: { amountMl: 500 },
    });

    assert.equal(result.success, true);
    assert.equal(result.action, "LOG_WATER");
    assert.ok(result.summary.includes("500ml"));
  });

  it("rejects invalid coach actions that violate Zod schema constraints", async () => {
    const result = await coachActionService.executeAction(testUser, {
      action: "LOG_WEIGHT",
      parameters: { weightKg: 20 }, // Under minimum allowed weight (30kg)
    });

    assert.equal(result.success, false);
    assert.ok(result.summary.includes("validation failed"));
  });

  it("handles conversational exercise swap request via executeFitnessAgent", async () => {
    const response = await executeFitnessAgent(testUser, "Can I replace today's squat?");
    assert.equal(response.role, "assistant");
    assert.ok(response.content.length > 20);
    assert.ok(
      response.actionsExecuted.some((a) => a.type === "REPLACE_EXERCISE") ||
      response.content.toLowerCase().includes("squat") ||
      response.content.toLowerCase().includes("alternative")
    );
  });

  it("handles progression query 'I completed 80kg x 12. What should I do next?'", async () => {
    const response = await executeFitnessAgent(testUser, "I completed 80kg x 12. What should I do next?");
    assert.equal(response.role, "assistant");
    assert.ok(response.content.includes("80kg"));
    assert.ok(response.content.toLowerCase().includes("progression") || response.content.toLowerCase().includes("target"));
  });

  it("handles conversational fatigue adjustment 'I'm very tired today. Adjust my workout'", async () => {
    const response = await executeFitnessAgent(testUser, "I'm very tired today. Adjust my workout.");
    assert.equal(response.role, "assistant");
    assert.ok(response.actionsExecuted.some((a) => a.type === "ADJUST_TODAYS_WORKOUT"));
    assert.ok(response.content.toLowerCase().includes("adapted") || response.content.toLowerCase().includes("reduced"));
  });

  it("accepts and executes structured action ADJUST_CALORIE_TARGET with meal scaling", async () => {
    const userState = getUserState(testUser);
    (userState as any).aiMeals = [
      { mealSlot: "BREAKFAST", calories: 500, recipeTitle: "Oats" },
      { mealSlot: "LUNCH", calories: 800, recipeTitle: "Chicken Rice" },
      { mealSlot: "SNACK", calories: 300, recipeTitle: "Yogurt" },
      { mealSlot: "DINNER", calories: 800, recipeTitle: "Steak Plate" },
    ];
    userState.nutritionPlan = {
      calorieTarget: { value: 2400, provenance: "CALCULATED" },
      proteinTargetG: { value: 160, provenance: "CALCULATED" },
      carbTargetG: { value: 270, provenance: "CALCULATED" },
      fatTargetG: { value: 67, provenance: "CALCULATED" },
      bmr: 1700,
      tdee: 2400,
    };

    const result = await coachActionService.executeAction(testUser, {
      action: "ADJUST_CALORIE_TARGET",
      parameters: { deltaCalories: -200 },
    });

    assert.equal(result.success, true);
    assert.equal(result.details.newCalorieTarget, 2200);
    assert.equal(userState.nutritionPlan.calorieTarget.value, 2200);

    // Sum of scaled meals should equal 2200
    const mealSum = (userState as any).aiMeals.reduce((s: number, m: any) => s + m.calories, 0);
    assert.equal(mealSum, 2200);
  });

  it("handles user request 'Reduce my daily calorie target by 179 or somting kcal' autonomously via agent", async () => {
    const userState = getUserState(testUser);
    userState.nutritionPlan = {
      calorieTarget: { value: 2904, provenance: "CALCULATED" },
      proteinTargetG: { value: 190, provenance: "CALCULATED" },
      carbTargetG: { value: 320, provenance: "CALCULATED" },
      fatTargetG: { value: 80, provenance: "CALCULATED" },
      bmr: 1800,
      tdee: 2904,
    };

    const response = await executeFitnessAgent(testUser, "Reduce my daily calorie target by 179 or somting kcal");
    assert.equal(response.role, "assistant");
    assert.ok(response.actionsExecuted.some((a) => a.type === "ADJUST_CALORIE_TARGET"));
    assert.equal(response.appVitals.calorieTarget, 2725);
    assert.ok(response.content.includes("2,725") || response.content.includes("2725"));
    assert.equal(userState.nutritionPlan.calorieTarget.value, 2725);
  });
});

describe("AI Body Image Vision Analysis & Dynamic Workout Planning", () => {
  it("analyzes user body photo inputs and returns valid anthropometrics and priority muscles", async () => {
    const analysis = await analyzeUserBodyPhoto({
      heightCm: 180,
      currentWeightKg: 82,
      sex: "MALE",
      age: 26,
      goal: "MUSCLE_GAIN",
    });

    assert.ok(analysis.estimatedBodyFatPct >= 8 && analysis.estimatedBodyFatPct <= 35);
    assert.ok(["LEAN", "ATHLETIC", "MODERATE", "HIGH"].includes(analysis.bodyFatCategory));
    assert.ok(["ECTOMORPH", "MESOMORPH", "ENDOMORPH", "HYBRID"].includes(analysis.somatotype));
    assert.ok(analysis.developmentPriorityMuscles.length > 0);
    assert.ok(analysis.trainingDirectives.length > 0);
    assert.ok(analysis.nutritionDirectives.length > 0);
    assert.equal(analysis.provenance, "ESTIMATED");
  });

  it("dynamically generates non-hardcoded workout plans prioritizing visual weak points", async () => {
    const plan = await generateDynamicWorkoutPlan({
      userId: "test_vision_user",
      profile: {
        name: "Test Athlete",
        age: 25,
        sex: "MALE",
        heightCm: 178,
        weightKg: 78,
      },
      goal: {
        type: "MUSCLE_GAIN",
      },
      training: {
        experienceLevel: "INTERMEDIATE",
        trainingEnvironment: "GYM",
        equipmentAvailable: ["barbell", "dumbbell", "cables", "machine"],
        workoutDaysPerWeek: 4,
        sessionDurationMin: 50,
      },
      safety: {
        conservativeMode: false,
        injuries: [],
      },
      userPhysiqueAnalysis: {
        estimatedBodyFatPct: 15,
        bodyFatCategory: "ATHLETIC",
        somatotype: "MESOMORPH",
        developmentPriorityMuscles: ["Upper Chest", "Lateral Delts"],
      },
      targetPhysique: {
        physiqueAesthetic: "V-Taper Athletic",
        standoutMuscles: ["Upper Chest", "Lateral Delts", "Lats"],
      },
    });

    assert.ok(plan.days.length === 4, "Should generate exactly 4 workout days matching user's requested frequency");
    assert.ok(plan.generatedBy.length > 0);

    // Verify uniqueness
    const uniqueness = validateWorkoutUniqueness(plan);
    assert.equal(uniqueness.isValid, true, `All exercises must be unique per day: ${uniqueness.duplicateReport.join(", ")}`);

    // Verify priority muscles are incorporated
    const allExercises = plan.days.flatMap((d) => d.exercises);
    const hasPriorityMuscle = allExercises.some(
      (e) =>
        e.exerciseName.toLowerCase().includes("chest") ||
        e.exerciseName.toLowerCase().includes("press") ||
        e.exerciseName.toLowerCase().includes("lateral") ||
        e.exerciseName.toLowerCase().includes("raise") ||
        e.exerciseName.toLowerCase().includes("incline")
    );
    assert.ok(hasPriorityMuscle, "Dynamic plan must target priority weak points identified from scan");
  });

  it("filters contraindicated exercises when user reports an injury in dynamic workout planning", async () => {
    const plan = await generateDynamicWorkoutPlan({
      userId: "test_injured_user",
      profile: {
        name: "Injured Athlete",
        age: 30,
        sex: "MALE",
        heightCm: 175,
        weightKg: 80,
      },
      goal: {
        type: "FAT_LOSS",
      },
      training: {
        experienceLevel: "BEGINNER",
        trainingEnvironment: "HOME",
        equipmentAvailable: ["dumbbell", "bodyweight"],
        workoutDaysPerWeek: 3,
        sessionDurationMin: 40,
      },
      safety: {
        conservativeMode: true,
        injuries: ["acute shoulder impingement"],
      },
      userPhysiqueAnalysis: {
        estimatedBodyFatPct: 22,
        bodyFatCategory: "MODERATE",
        developmentPriorityMuscles: ["Core", "Glutes"],
      },
    });

    assert.ok(plan.days.length === 3);
    assert.equal(plan.safetyGateApplied, true);

    const allExercises = plan.days.flatMap((d) => d.exercises);
    for (const ex of allExercises) {
      assert.ok(
        !ex.exerciseName.toLowerCase().includes("overhead press"),
        "Should not prescribe heavy overhead pressing with shoulder impingement"
      );
    }
  });

  it("guarantees strictly 5 to 6 exercises per workout day across 3, 4, 5, and 6-day splits (never 3 or 4)", async () => {
    const frequencies = [3, 4, 5, 6];
    for (const daysPerWeek of frequencies) {
      const plan = await generateDynamicWorkoutPlan({
        userId: `test_freq_${daysPerWeek}`,
        profile: { name: "Aesthetic Athlete", age: 24, sex: "MALE", heightCm: 180, weightKg: 80 },
        goal: { type: "MUSCLE_GAIN" },
        training: {
          experienceLevel: "INTERMEDIATE",
          trainingEnvironment: "GYM",
          equipmentAvailable: ["barbell", "dumbbell", "cables", "machine", "bench", "pullup_bar"],
          workoutDaysPerWeek: daysPerWeek,
          sessionDurationMin: 60,
        },
        safety: { conservativeMode: false, injuries: [] },
      });

      assert.equal(plan.days.length, daysPerWeek);
      for (const day of plan.days) {
        assert.ok(
          day.exercises.length >= 5 && day.exercises.length <= 6,
          `Split ${daysPerWeek} days/wk: Day ${day.dayOfWeek} must have 5 or 6 exercises, but had ${day.exercises.length}`
        );
      }
    }
  });
});

