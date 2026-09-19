"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalizationContextBuilder = exports.PersonalizationContextBuilder = void 0;
const db_1 = require("../db");
const safetyGate_1 = require("../engines/safetyGate");
const nutritionEngine_1 = require("../engines/nutritionEngine");
const hydrationEngine_1 = require("../engines/hydrationEngine");
const progressionService_1 = require("./progressionService");
const tdeeRecalibrationService_1 = require("./tdeeRecalibrationService");
class PersonalizationContextBuilder {
    /**
     * Assembles the complete normalized PersonalizationContext for a user
     */
    async buildContext(userId) {
        const state = (0, db_1.getUserState)(userId);
        const profile = state.profile || {
            name: "Athlete",
            age: 25,
            sex: "MALE",
            heightCm: 178,
            weightKg: 75,
        };
        const fitness = state.fitnessProfile || {
            experienceLevel: "BEGINNER",
            trainingEnvironment: "GYM",
            equipmentAvailable: ["barbell", "dumbbell", "cables", "bench"],
            workoutDaysPerWeek: 4,
            sessionDurationMin: 45,
            injuries: [],
            physicalLimitations: [],
            dietaryPreference: "Omnivore",
            allergies: [],
            dislikedFoods: [],
            cuisinePreferences: ["mediterranean"],
            budgetTier: "MEDIUM",
        };
        const goal = state.goal || {
            type: "MUSCLE_GAIN",
            isPrimary: true,
        };
        // 1. Single Source of Truth: Deterministic Safety Gate
        const safety = (0, safetyGate_1.evaluateSafetyGate)({
            age: profile.age,
            injuries: fitness.injuries,
            physicalLimitations: fitness.physicalLimitations,
            goal: goal.type,
            targetDate: fitness.targetDate,
            startingWeightKg: profile.weightKg,
            targetWeightKg: profile.targetWeightKg,
        });
        // 2. Single Source of Truth: Deterministic Nutrition Engine
        const nutritionCalc = (0, nutritionEngine_1.calculateNutrition)({
            weightKg: profile.weightKg || 75,
            heightCm: profile.heightCm || 178,
            age: profile.age || 25,
            sex: profile.sex || "MALE",
            workoutDaysPerWeek: fitness.workoutDaysPerWeek || 4,
            goal: goal.type,
            budgetTier: fitness.budgetTier,
            isConservativeSafeMode: safety.enforceConservativePlan,
        });
        // 3. Hydration Target
        const hydration = (0, hydrationEngine_1.calculateHydration)({
            weightKg: profile.weightKg || 75,
            sessionDurationMin: fitness.sessionDurationMin || 45,
        });
        // 4. Historical Performance Telemetry
        const recentSets = await progressionService_1.progressionService.getRecentExerciseLogs(userId);
        // 5. Weight Trend Telemetry
        const weightLogs = await tdeeRecalibrationService_1.tdeeRecalibrationService.getWeightLogs(userId);
        let observedRate = 0;
        if (weightLogs.length >= 2) {
            const sorted = [...weightLogs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const days = Math.max(1, (new Date(last.loggedAt).getTime() - new Date(first.loggedAt).getTime()) / 86400000);
            observedRate = (last.weightKg - first.weightKg) / (days / 7);
        }
        const planVersion = state.planVersion || 1;
        return {
            userId,
            profile: {
                name: profile.name,
                age: profile.age,
                sex: profile.sex,
                heightCm: profile.heightCm,
                weightKg: profile.weightKg || 75,
                targetWeightKg: profile.targetWeightKg,
            },
            goal: {
                type: goal.type,
                isPrimary: goal.isPrimary,
                targetDate: fitness.targetDate,
            },
            targetPhysique: state.targetPhysique,
            userPhysiqueAnalysis: state.userPhysiqueAnalysis,
            bodyPhotos: state.bodyPhotos,
            training: {
                experienceLevel: fitness.experienceLevel,
                trainingEnvironment: fitness.trainingEnvironment,
                equipmentAvailable: fitness.equipmentAvailable,
                workoutDaysPerWeek: fitness.workoutDaysPerWeek,
                sessionDurationMin: fitness.sessionDurationMin,
            },
            nutrition: {
                dietaryPreference: fitness.dietaryPreference || "Omnivore",
                allergies: fitness.allergies || [],
                dislikedFoods: fitness.dislikedFoods || [],
                cuisinePreferences: fitness.cuisinePreferences || [],
                budgetTier: fitness.budgetTier,
                authoritativeCalorieTarget: nutritionCalc.calorieTarget.value,
                authoritativeProteinTarget: nutritionCalc.proteinTargetG.value,
                authoritativeCarbTarget: nutritionCalc.carbTargetG.value,
                authoritativeFatTarget: nutritionCalc.fatTargetG.value,
                tdee: nutritionCalc.tdee,
                bmr: nutritionCalc.bmr,
                hydrationTargetMl: hydration.targetMl,
            },
            safety: {
                isSafe: safety.isSafe,
                conservativeMode: safety.enforceConservativePlan,
                injuries: fitness.injuries,
                physicalLimitations: fitness.physicalLimitations,
                reasons: safety.reasons,
                maxRPE: safety.workoutConstraints.maxRPE,
                maxSetsPerExercise: safety.workoutConstraints.maxSetsPerExercise,
                prohibitedExercises: safety.workoutConstraints.prohibitedExercises,
                prohibitedMovementPatterns: safety.workoutConstraints.prohibitedMovementPatterns,
            },
            historicalPerformance: {
                recentSetsByExercise: recentSets,
                workoutsCompletedLast30Days: 4,
            },
            weightTrend: {
                recentLogs: weightLogs.map((l) => ({ weightKg: l.weightKg, loggedAt: new Date(l.loggedAt).toISOString() })),
                observedRateKgPerWeek: observedRate,
                predictedRateKgPerWeek: goal.type === "FAT_LOSS" ? -0.5 : goal.type === "MUSCLE_GAIN" ? 0.25 : 0,
                divergenceFlag: Math.abs(observedRate) > 1.25,
            },
            planVersion,
        };
    }
}
exports.PersonalizationContextBuilder = PersonalizationContextBuilder;
exports.personalizationContextBuilder = new PersonalizationContextBuilder();
