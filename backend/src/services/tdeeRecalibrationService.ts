import { prisma, getUserState, saveUserState } from "../db";
import {
  recalibrateTDEEAndNutrition,
  RecalibrationResult,
  WeightLogEntry,
} from "../engines/tdeeRecalibrationEngine";
import { NutritionPlanOutput, calculateNutrition } from "../engines/nutritionEngine";

export class TdeeRecalibrationService {
  private inMemoryWeightLogs: Map<string, WeightLogEntry[]> = new Map();

  /**
   * Retrieves weight logs for user from memory store or Prisma
   */
  async getWeightLogs(userId: string): Promise<WeightLogEntry[]> {
    const mem = this.inMemoryWeightLogs.get(userId);
    if (mem && mem.length > 0) return mem;

    try {
      const dbLogs = await prisma.weightLog.findMany({
        where: { userId },
        orderBy: { loggedAt: "asc" },
      });
      if (dbLogs && dbLogs.length > 0) {
        return dbLogs.map((l) => ({ weightKg: l.weightKg, loggedAt: l.loggedAt }));
      }
    } catch {
      // Memory fallback
    }

    const state = getUserState(userId);
    const inMemLogs: WeightLogEntry[] = (state as any).weightLogs || [];
    if (inMemLogs.length > 0) return inMemLogs;

    if (state.profile?.weightKg) {
      return [{ weightKg: state.profile.weightKg, loggedAt: new Date(Date.now() - 14 * 86400000) }];
    }
    return [];
  }

  /**
   * Synchronously logs a weight and evaluates recalibration (used by tests & coach actions)
   */
  logWeightAndEvaluate(userId: string, weightKg: number, loggedAt?: Date): RecalibrationResult {
    const date = loggedAt || new Date();
    if (!this.inMemoryWeightLogs.has(userId)) {
      this.inMemoryWeightLogs.set(userId, []);
    }
    const logs = this.inMemoryWeightLogs.get(userId)!;
    logs.push({ weightKg, loggedAt: date });

    const state = getUserState(userId);
    if (!state.profile) {
      state.profile = { name: "Athlete", age: 25, sex: "MALE", heightCm: 175, weightKg };
    } else {
      state.profile.weightKg = weightKg;
    }

    if (!(state as any).weightLogs) (state as any).weightLogs = [];
    (state as any).weightLogs.push({ weightKg, loggedAt: date });
    saveUserState(userId);

    return this.evaluateRecalibration(userId);
  }

  /**
   * Evaluates if recalibration should trigger based on current logged weights
   */
  evaluateRecalibration(userId: string): RecalibrationResult {
    const logs = this.inMemoryWeightLogs.get(userId) || (getUserState(userId) as any).weightLogs || [];
    const state = getUserState(userId);

    const initialCalc = calculateNutrition({
      weightKg: state.profile?.weightKg || 75,
      heightCm: state.profile?.heightCm || 175,
      age: state.profile?.age || 25,
      sex: state.profile?.sex || "MALE",
      workoutDaysPerWeek: state.fitnessProfile?.workoutDaysPerWeek || 4,
      goal: state.goal?.type || "FAT_LOSS",
      budgetTier: state.fitnessProfile?.budgetTier || "MEDIUM",
    });

    if (!(state as any).baselineCalorieTarget) {
      (state as any).baselineCalorieTarget = state.nutritionPlan?.calorieTarget?.value || initialCalc.calorieTarget.value;
    }

    const baselineCalories = (state as any).baselineCalorieTarget;
    const currentPlan: NutritionPlanOutput = {
      ...(state.nutritionPlan || initialCalc),
      calorieTarget: { value: baselineCalories, provenance: "CALCULATED" },
    };

    const result = recalibrateTDEEAndNutrition({
      weightLogs: logs,
      currentPlan,
      userProfile: {
        heightCm: state.profile?.heightCm || 175,
        age: state.profile?.age || 25,
        sex: state.profile?.sex || "MALE",
        weightKg: state.profile?.weightKg || 75,
      },
      fitnessProfile: {
        workoutDaysPerWeek: state.fitnessProfile?.workoutDaysPerWeek || 4,
        goal: state.goal?.type || "FAT_LOSS",
        budgetTier: state.fitnessProfile?.budgetTier || "MEDIUM",
      },
      minDaysRequired: 7,
    });

    if (result.recalibrated) {
      state.nutritionPlan = result.updatedPlan;
      saveUserState(userId);
    }

    return result;
  }

  /**
   * Records a new weight measurement asynchronously
   */
  async logWeightAndRecalibrate(userId: string, newWeightKg: number): Promise<RecalibrationResult | null> {
    return this.logWeightAndEvaluate(userId, newWeightKg);
  }
}

export const tdeeRecalibrationService = new TdeeRecalibrationService();
