// Typed endpoint functions. Mirrors docs/WORKFLOW.md §3 and the API surface
// sketched in the PRD. The backend in /apps/api is not implemented yet in
// this handoff — these calls are wired and typed so screens can be built
// against them now and simply start working once the backend exists.

import { apiClient } from "./client";
import type {
  NutritionPlanToday,
  WaterStatus,
  WorkoutDay,
  ProgressSnapshot,
  AIChatMessage,
  UserProfile,
  FitnessProfile,
  Goal,
  UserReminders,
} from "@/types/models";

export const endpoints = {
  getWeeklyWorkout: () => apiClient.get<WorkoutDay[]>("/workout/week"),

  getReminders: () => apiClient.get<UserReminders>("/user/reminders"),

  saveReminders: (reminders: UserReminders) =>
    apiClient.post<{ success: boolean; reminders: UserReminders }>("/user/reminders", reminders),
  submitProfile: (profile: UserProfile) => apiClient.post<void>("/profile", profile),

  submitFitnessProfile: (profile: FitnessProfile) =>
    apiClient.post<void>("/profile/fitness", profile),

  submitGoal: (goal: Goal) => apiClient.post<void>("/goals", goal),

  startAnalysis: () => apiClient.post<{ jobId: string }>("/analysis/start"),

  getAnalysisStatus: (jobId: string) =>
    apiClient.get<{ status: "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED" }>(
      `/analysis/${jobId}`
    ),

  generatePlan: () => apiClient.post<{ jobId: string }>("/plan/generate"),

  getTodayWorkout: () => apiClient.get<WorkoutDay | null>("/workout/today"),

  getTodayNutrition: () => apiClient.get<NutritionPlanToday | null>("/nutrition/today"),

  getWaterStatus: () => apiClient.get<WaterStatus | null>("/water/today"),
  logWater: (amountMl: number) => apiClient.post<WaterStatus>("/water", { amountMl }),

  getProgressTimeline: () => apiClient.get<ProgressSnapshot[]>("/progress/dashboard"),

  sendCoachMessage: (message: string) =>
    apiClient.post<AIChatMessage>("/ai/chat", { message }),

  uploadPhoto: (imageBase64: string, folder?: string) =>
    apiClient.post<{ url: string; secureUrl: string; publicId: string; message: string }>("/media/upload", {
      imageBase64,
      folder,
    }),

  analyzeTargetPhysique: (data: {
    imageBase64?: string;
    imageUrl?: string;
    heightCm?: number;
    currentWeightKg?: number;
    sex?: string;
    goal?: string;
  }) =>
    apiClient.post<{
      physiqueAesthetic: string;
      targetBodyFatPct: number;
      targetWeightKg: number;
      estimatedWeeks: number;
      standoutMuscles: string[];
      trainingFocusRecommendations: string[];
      nutritionStrategy: string;
      description: string;
      confidenceScore: number;
    }>("/analysis/target-physique", data),

  getProfile: () => apiClient.get<import("@/types/models").FullProfileData>("/profile"),

  editProfile: (data: {
    name?: string;
    age?: number;
    weightKg?: number;
    targetWeightKg?: number;
    heightCm?: number;
    goal?: string;
    dietaryPreference?: string;
    budgetTier?: string;
    workoutDaysPerWeek?: number;
  }) => apiClient.put<import("@/types/models").FullProfileData>("/profile/edit", data),

  getTargetBodyBlueprint: () =>
    apiClient.get<import("@/types/models").TargetBodyBlueprint>("/profile/target-body"),

  getUserStatus: () =>
    apiClient.get<{ hasPlan: boolean; hasCompletedOnboarding: boolean }>("/user/status"),

  register: (email: string, password: string) =>
    apiClient.post<{ user: { id: string; email: string }; token: string }>("/auth/register", {
      email,
      password,
    }),

  login: (email: string, password: string) =>
    apiClient.post<{ user: { id: string; email: string }; token: string }>("/auth/login", {
      email,
      password,
    }),
};
