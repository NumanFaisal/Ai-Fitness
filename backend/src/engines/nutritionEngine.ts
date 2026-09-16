export interface NutritionCalculationInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  workoutDaysPerWeek: number;
  goal: "FAT_LOSS" | "MUSCLE_GAIN" | "RECOMPOSITION" | "STRENGTH" | "ENDURANCE" | "GENERAL_FITNESS" | "ATHLETIC_PERFORMANCE" | "MAINTENANCE";
  budgetTier: "LOW" | "MEDIUM" | "FLEXIBLE";
  isConservativeSafeMode?: boolean;
}

export interface ProvenanceValue<T> {
  value: T;
  provenance: "CALCULATED" | "USER_PROVIDED" | "WEARABLE" | "OBSERVED" | "ESTIMATED";
}

export interface NutritionPlanOutput {
  bmr: number;
  tdee: number;
  calorieTarget: ProvenanceValue<number>;
  proteinTargetG: ProvenanceValue<number>;
  carbTargetG: ProvenanceValue<number>;
  fatTargetG: ProvenanceValue<number>;
  budgetTier: "LOW" | "MEDIUM" | "FLEXIBLE";
  recommendedMealSlots: string[];
}

export function calculateNutrition(input: NutritionCalculationInput): NutritionPlanOutput {
  const { weightKg, heightCm, age, sex, workoutDaysPerWeek, goal, budgetTier, isConservativeSafeMode } = input;

  // 1. Calculate Basal Metabolic Rate (Mifflin-St Jeor)
  let bmr: number;
  if (sex === "MALE") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else if (sex === "FEMALE") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    // Average baseline
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78;
  }

  // 2. Determine Activity Multiplier based on workout days
  let activityMultiplier = 1.2; // Sedentary
  if (workoutDaysPerWeek >= 6) {
    activityMultiplier = 1.725; // Very active
  } else if (workoutDaysPerWeek >= 4) {
    activityMultiplier = 1.55; // Moderately active
  } else if (workoutDaysPerWeek >= 2) {
    activityMultiplier = 1.375; // Lightly active
  }

  const tdee = Math.round(bmr * activityMultiplier);

  // 3. Goal Calorie Adjustment
  let targetCalories = tdee;

  if (isConservativeSafeMode) {
    // Safe maintenance target
    targetCalories = tdee;
  } else {
    switch (goal) {
      case "FAT_LOSS":
        targetCalories = tdee - 500;
        break;
      case "MUSCLE_GAIN":
        targetCalories = tdee + 300;
        break;
      case "RECOMPOSITION":
        targetCalories = tdee - 200;
        break;
      case "STRENGTH":
      case "ATHLETIC_PERFORMANCE":
        targetCalories = tdee + 250;
        break;
      case "ENDURANCE":
        targetCalories = tdee + 150;
        break;
      case "GENERAL_FITNESS":
      case "MAINTENANCE":
      default:
        targetCalories = tdee;
        break;
    }
  }

  // Safety floor: Never prescribe below physiologically dangerous thresholds
  const floorCalories = sex === "FEMALE" ? 1200 : 1500;
  if (targetCalories < floorCalories) {
    targetCalories = floorCalories;
  }

  // 4. Evidence-based Macronutrient Split
  // Protein: 2.0g per kg for body composition, 1.6g for general maintenance
  const proteinMultiplier = ["MUSCLE_GAIN", "FAT_LOSS", "RECOMPOSITION"].includes(goal) ? 2.0 : 1.6;
  const proteinG = Math.round(weightKg * proteinMultiplier);
  const proteinCalories = proteinG * 4;

  // Fat: 0.9g per kg bodyweight (essential hormonal function), minimum 20% of total calories
  let fatG = Math.round(weightKg * 0.9);
  let fatCalories = fatG * 9;
  if (fatCalories < targetCalories * 0.2) {
    fatCalories = targetCalories * 0.2;
    fatG = Math.round(fatCalories / 9);
  }

  // Carbohydrates: Remainder of daily calories
  const remainingCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
  const carbG = Math.round(remainingCalories / 4);

  return {
    bmr: Math.round(bmr),
    tdee,
    calorieTarget: { value: Math.round(targetCalories), provenance: "CALCULATED" },
    proteinTargetG: { value: proteinG, provenance: "CALCULATED" },
    carbTargetG: { value: carbG, provenance: "CALCULATED" },
    fatTargetG: { value: fatG, provenance: "CALCULATED" },
    budgetTier,
    recommendedMealSlots: ["Breakfast", "Lunch", "Pre-Workout Snack", "Dinner"],
  };
}
