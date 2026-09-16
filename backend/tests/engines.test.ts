import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSafetyGate } from "../src/engines/safetyGate";
import { calculateNutrition } from "../src/engines/nutritionEngine";
import { calculateHydration } from "../src/engines/hydrationEngine";
import { generateWorkoutPlan } from "../src/engines/workoutEngine";

describe("Deterministic Safety Gate Engine", () => {
  it("approves healthy individuals with reasonable goals", () => {
    const result = evaluateSafetyGate({
      age: 28,
      injuries: [],
      physicalLimitations: [],
      goal: "FAT_LOSS",
      startingWeightKg: 80,
      targetWeightKg: 75,
      targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(), // 60 days
    });

    assert.equal(result.isSafe, true);
    assert.equal(result.enforceConservativePlan, false);
  });

  it("flags high-risk injuries such as herniated disc", () => {
    const result = evaluateSafetyGate({
      age: 32,
      injuries: ["L4-L5 herniated disc"],
      physicalLimitations: [],
      goal: "STRENGTH",
    });

    assert.equal(result.isSafe, false);
    assert.equal(result.enforceConservativePlan, true);
    assert.ok(result.reasons[0].includes("Medical flag identified"));
  });

  it("flags physiologically extreme weight loss timelines", () => {
    const result = evaluateSafetyGate({
      age: 25,
      injuries: [],
      physicalLimitations: [],
      goal: "FAT_LOSS",
      startingWeightKg: 90,
      targetWeightKg: 70, // 20 kg loss
      targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString(), // 4 weeks = 5kg/week!
    });

    assert.equal(result.isSafe, false);
    assert.equal(result.enforceConservativePlan, true);
    assert.ok(result.reasons.some((r) => r.includes("exceeds physiological safety threshold")));
  });
});

describe("Deterministic Nutrition Engine", () => {
  it("calculates BMR, TDEE, and macro split for muscle gain", () => {
    const result = calculateNutrition({
      weightKg: 75,
      heightCm: 180,
      age: 26,
      sex: "MALE",
      workoutDaysPerWeek: 4,
      goal: "MUSCLE_GAIN",
      budgetTier: "MEDIUM",
    });

    // Mifflin-St Jeor for Male (75kg, 180cm, 26y):
    // 10*75 + 6.25*180 - 5*26 + 5 = 750 + 1125 - 130 + 5 = 1750 BMR
    assert.equal(result.bmr, 1750);
    // TDEE = 1750 * 1.55 = 2712.5 -> 2713
    assert.equal(result.tdee, 2713);
    // Surplus +300 = 3013 kcal
    assert.equal(result.calorieTarget.value, 3013);
    assert.equal(result.calorieTarget.provenance, "CALCULATED");
    // Protein: 75 * 2.0 = 150g
    assert.equal(result.proteinTargetG.value, 150);
  });

  it("enforces safety floor for extreme deficits", () => {
    const result = calculateNutrition({
      weightKg: 50,
      heightCm: 155,
      age: 40,
      sex: "FEMALE",
      workoutDaysPerWeek: 1,
      goal: "FAT_LOSS",
      budgetTier: "LOW",
    });

    // Floor for females is 1200 kcal
    assert.ok(result.calorieTarget.value >= 1200);
  });
});

describe("Deterministic Hydration Engine", () => {
  it("calculates baseline plus workout hydration", () => {
    const result = calculateHydration({
      weightKg: 80,
      sessionDurationMin: 50,
      isWarmClimate: false,
    });

    // Baseline: 80 * 35 = 2800 ml
    // Exercise: 50 * 12 = 600 ml
    // Total = 3400 ml
    assert.equal(result.targetMl, 3400);
    assert.equal(result.provenance, "CALCULATED");
  });
});

describe("Deterministic Workout Split Engine", () => {
  it("assigns Full Body split for 3-day frequency", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "BEGINNER",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell"],
      workoutDaysPerWeek: 3,
      sessionDurationMin: 45,
      injuries: [],
      goal: "FAT_LOSS",
    });

    assert.equal(plan.splitType, "FULL_BODY");
    assert.equal(plan.days.length, 3);
  });

  it("assigns Push/Pull/Legs split for 5-6 days", () => {
    const plan = generateWorkoutPlan({
      experienceLevel: "INTERMEDIATE",
      trainingEnvironment: "GYM",
      equipmentAvailable: ["barbell", "dumbbell"],
      workoutDaysPerWeek: 5,
      sessionDurationMin: 60,
      injuries: [],
      goal: "MUSCLE_GAIN",
    });

    assert.equal(plan.splitType, "PUSH_PULL_LEGS");
    assert.equal(plan.days.length, 5);
  });
});
