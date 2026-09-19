export interface PersonalizationContext {
  userId: string;
  profile: {
    name: string;
    age: number;
    sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    heightCm: number;
    weightKg: number;
    targetWeightKg?: number;
  };
  goal: {
    type: "FAT_LOSS" | "MUSCLE_GAIN" | "RECOMPOSITION" | "STRENGTH" | "ENDURANCE" | "GENERAL_FITNESS" | "ATHLETIC_PERFORMANCE" | "MAINTENANCE";
    isPrimary: boolean;
    targetDate?: string | null;
  };
  targetPhysique?: {
    physiqueAesthetic?: string;
    targetBodyFatPct?: number;
    targetWeightKg?: number;
    standoutMuscles?: string[];
    trainingFocusRecommendations?: string[];
    nutritionStrategy?: string;
    description?: string;
  };
  userPhysiqueAnalysis?: {
    estimatedBodyFatPct?: number;
    bodyFatCategory?: string;
    somatotype?: string;
    postureAssessment?: string;
    visualStrengths?: string[];
    developmentPriorityMuscles?: string[];
    fatDistributionPattern?: string;
    trainingDirectives?: string[];
    nutritionDirectives?: string[];
    summaryNarrative?: string;
    confidenceScore?: number;
    provenance?: "OBSERVED" | "ESTIMATED";
  };
  bodyPhotos?: Record<string, string>;
  training: {
    experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    trainingEnvironment: "GYM" | "HOME" | "OUTDOOR";
    equipmentAvailable: string[];
    workoutDaysPerWeek: number;
    sessionDurationMin: number;
    preferredSplit?: string;
    targetDate?: string | null;
  };
  nutrition: {
    dietaryPreference: string;
    allergies: string[];
    dislikedFoods: string[];
    cuisinePreferences: string[];
    budgetTier: "LOW" | "MEDIUM" | "FLEXIBLE";
    authoritativeCalorieTarget: number;
    authoritativeProteinTarget: number;
    authoritativeProteinTargetG?: number;
    authoritativeCarbTarget: number;
    authoritativeFatTarget: number;
    tdee: number;
    bmr: number;
    hydrationTargetMl: number;
  };
  safety: {
    isSafe: boolean;
    conservativeMode: boolean;
    injuries: string[];
    physicalLimitations: string[];
    allergies?: string[];
    reasons: string[];
    maxRPE: number;
    maxSetsPerExercise: number;
    prohibitedExercises: string[];
    prohibitedMovementPatterns: string[];
  };
  historicalPerformance: {
    recentSetsByExercise: Record<string, { reps: number; weightKg?: number; rpe?: number; completedAt: string | Date }[]>;
    workoutsCompletedLast30Days: number;
  };
  weightTrend: {
    recentLogs: { weightKg: number; loggedAt: string }[];
    observedRateKgPerWeek: number;
    predictedRateKgPerWeek: number;
    divergenceFlag: boolean;
  };
  planVersion: number;
}
