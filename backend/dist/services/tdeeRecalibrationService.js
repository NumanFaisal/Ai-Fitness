"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tdeeRecalibrationService = exports.TdeeRecalibrationService = void 0;
const db_1 = require("../db");
const tdeeRecalibrationEngine_1 = require("../engines/tdeeRecalibrationEngine");
const nutritionEngine_1 = require("../engines/nutritionEngine");
class TdeeRecalibrationService {
    inMemoryWeightLogs = new Map();
    /**
     * Retrieves weight logs for user from memory store or Prisma
     */
    async getWeightLogs(userId) {
        const mem = this.inMemoryWeightLogs.get(userId);
        if (mem && mem.length > 0)
            return mem;
        try {
            const dbLogs = await db_1.prisma.weightLog.findMany({
                where: { userId },
                orderBy: { loggedAt: "asc" },
            });
            if (dbLogs && dbLogs.length > 0) {
                return dbLogs.map((l) => ({ weightKg: l.weightKg, loggedAt: l.loggedAt }));
            }
        }
        catch {
            // Memory fallback
        }
        const state = (0, db_1.getUserState)(userId);
        const inMemLogs = state.weightLogs || [];
        if (inMemLogs.length > 0)
            return inMemLogs;
        if (state.profile?.weightKg) {
            return [{ weightKg: state.profile.weightKg, loggedAt: new Date(Date.now() - 14 * 86400000) }];
        }
        return [];
    }
    /**
     * Synchronously logs a weight and evaluates recalibration (used by tests & coach actions)
     */
    logWeightAndEvaluate(userId, weightKg, loggedAt) {
        const date = loggedAt || new Date();
        if (!this.inMemoryWeightLogs.has(userId)) {
            this.inMemoryWeightLogs.set(userId, []);
        }
        const logs = this.inMemoryWeightLogs.get(userId);
        logs.push({ weightKg, loggedAt: date });
        const state = (0, db_1.getUserState)(userId);
        if (!state.profile) {
            state.profile = { name: "Athlete", age: 25, sex: "MALE", heightCm: 175, weightKg };
        }
        else {
            state.profile.weightKg = weightKg;
        }
        if (!state.weightLogs)
            state.weightLogs = [];
        state.weightLogs.push({ weightKg, loggedAt: date });
        (0, db_1.saveUserState)(userId);
        return this.evaluateRecalibration(userId);
    }
    /**
     * Evaluates if recalibration should trigger based on current logged weights
     */
    evaluateRecalibration(userId) {
        const logs = this.inMemoryWeightLogs.get(userId) || (0, db_1.getUserState)(userId).weightLogs || [];
        const state = (0, db_1.getUserState)(userId);
        const initialCalc = (0, nutritionEngine_1.calculateNutrition)({
            weightKg: state.profile?.weightKg || 75,
            heightCm: state.profile?.heightCm || 175,
            age: state.profile?.age || 25,
            sex: state.profile?.sex || "MALE",
            workoutDaysPerWeek: state.fitnessProfile?.workoutDaysPerWeek || 4,
            goal: state.goal?.type || "FAT_LOSS",
            budgetTier: state.fitnessProfile?.budgetTier || "MEDIUM",
        });
        if (!state.baselineCalorieTarget) {
            state.baselineCalorieTarget = state.nutritionPlan?.calorieTarget?.value || initialCalc.calorieTarget.value;
        }
        const baselineCalories = state.baselineCalorieTarget;
        const currentPlan = {
            ...(state.nutritionPlan || initialCalc),
            calorieTarget: { value: baselineCalories, provenance: "CALCULATED" },
        };
        const result = (0, tdeeRecalibrationEngine_1.recalibrateTDEEAndNutrition)({
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
            (0, db_1.saveUserState)(userId);
        }
        return result;
    }
    /**
     * Records a new weight measurement asynchronously
     */
    async logWeightAndRecalibrate(userId, newWeightKg) {
        return this.logWeightAndEvaluate(userId, newWeightKg);
    }
}
exports.TdeeRecalibrationService = TdeeRecalibrationService;
exports.tdeeRecalibrationService = new TdeeRecalibrationService();
