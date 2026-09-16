// Shared types — mirror docs/DATABASE_SCHEMA.md. Keep these in sync with the
// backend's Zod schemas once /packages/shared-types exists (see README).

export type DataProvenance =
  | "USER_PROVIDED"
  | "CALCULATED"
  | "WEARABLE"
  | "OBSERVED"
  | "ESTIMATED";

export type FitnessGoal =
  | "FAT_LOSS"
  | "MUSCLE_GAIN"
  | "RECOMPOSITION"
  | "STRENGTH"
  | "ENDURANCE"
  | "GENERAL_FITNESS"
  | "ATHLETIC_PERFORMANCE"
  | "MAINTENANCE";

export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type BudgetTier = "LOW" | "MEDIUM" | "FLEXIBLE";
export type TrainingEnvironment = "GYM" | "HOME" | "OUTDOOR";
export type Sex = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export interface Provenanced<T> {
  value: T;
  provenance: DataProvenance;
  confidence?: number; // required when provenance === "ESTIMATED"
}

export interface UserProfile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
}

export interface FitnessProfile {
  experienceLevel: ExperienceLevel;
  trainingEnvironment: TrainingEnvironment;
  equipmentAvailable: string[];
  workoutDaysPerWeek: number;
  sessionDurationMin: number;
  injuries: string[];
  physicalLimitations: string[];
  dietaryPreference: string;
  allergies: string[];
  dislikedFoods: string[];
  cuisinePreferences: string[];
  mealsPerDay?: number;
  cookingAbility?: string;
  budgetTier: BudgetTier;
  targetDate?: string;
}

export interface Goal {
  type: FitnessGoal;
  isPrimary: boolean;
}

export interface WorkoutExerciseItem {
  exerciseName: string;
  exerciseSlug: string;
  mediaUri?: string;
  instructions?: string;
  youtubeUrl?: string;
  sets: number;
  repRangeLow: number;
  repRangeHigh: number;
  restSeconds: number;
  rpeTarget?: number;
}

export interface WorkoutDay {
  dayOfWeek: number;
  focus: string;
  exercises: WorkoutExerciseItem[];
}

export interface Meal {
  mealSlot: string;
  recipeTitle?: string;
  ingredients?: string[];
  instructions?: string[];
  youtubeUrl?: string;
  calories?: Provenanced<number>;
  proteinG?: Provenanced<number>;
}

export interface UserReminders {
  gymTime: string;
  gymDays: number[];
  mealReminders: boolean;
  waterReminders: boolean;
  waterIntervalHours: number;
}

export interface NutritionPlanToday {
  calorieTarget: Provenanced<number>;
  proteinTargetG: Provenanced<number>;
  carbTargetG: Provenanced<number>;
  fatTargetG: Provenanced<number>;
  meals: Meal[];
}

export interface WaterStatus {
  targetMl: number; // CALCULATED
  consumedMl: number; // USER_PROVIDED, summed
}

export interface ProgressSnapshot {
  snapshotDate: string;
  weightKg?: number;
  aiNarrative?: string; // hedged trend language, never precise composition claims
}

export interface AgentAction {
  type: string;
  summary: string;
  badge: string;
  details?: any;
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  actionsExecuted?: AgentAction[];
  appVitals?: {
    weightKg: number;
    calorieTarget: number;
    proteinTarget: number;
    waterConsumedMl: number;
    waterTargetMl: number;
    todayWorkoutFocus: string;
    goal: string;
  };
  createdAt: string;
}

export interface TargetBodyBlueprint {
  currentStats: {
    name: string;
    weightKg: number;
    heightCm: number;
    bmi: number;
    age: number;
    sex: string;
  };
  targetPhysique: {
    goalType: string;
    targetWeightKg: number;
    targetDescription: string;
    estimatedWeeks: number;
    targetDate: string;
  };
  nutritionBlueprint: {
    calorieTarget: number;
    proteinTargetG: number;
    carbTargetG: number;
    fatTargetG: number;
    strategy: string;
    dailyMeals: number;
    waterTargetMl: number;
  };
  trainingBlueprint: {
    environment: string;
    experienceLevel: string;
    daysPerWeek: number;
    sessionDurationMin: number;
    focusSplit: string;
    progressiveOverloadRule: string;
    cardioRecommendation: string;
  };
  transformationRoadmap: {
    phase: string;
    weeks: string;
    objective: string;
    keyMilestone: string;
  }[];
  actionableHabits: string[];
}

export interface FullProfileData {
  profile?: UserProfile & { weightKg?: number };
  fitnessProfile?: FitnessProfile;
  goal?: Goal;
}
