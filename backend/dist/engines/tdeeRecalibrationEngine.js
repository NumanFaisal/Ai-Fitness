"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateWeightTrend = calculateWeightTrend;
exports.recalibrateTDEEAndNutrition = recalibrateTDEEAndNutrition;
/**
 * Calculates rolling average weight and weekly change rate using linear trend over logs.
 */
function calculateWeightTrend(logs) {
    if (logs.length === 0)
        return { averageWeightKg: 75, weeklyRateKg: 0, daysSpan: 0 };
    if (logs.length === 1)
        return { averageWeightKg: logs[0].weightKg, weeklyRateKg: 0, daysSpan: 0 };
    const sorted = [...logs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
    const firstDate = new Date(sorted[0].loggedAt).getTime();
    const lastDate = new Date(sorted[sorted.length - 1].loggedAt).getTime();
    const daysSpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const avgWeight = sorted.reduce((sum, l) => sum + l.weightKg, 0) / sorted.length;
    // Linear regression slope
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const n = sorted.length;
    for (const log of sorted) {
        const day = (new Date(log.loggedAt).getTime() - firstDate) / (1000 * 60 * 60 * 24);
        sumX += day;
        sumY += log.weightKg;
        sumXY += day * log.weightKg;
        sumXX += day * day;
    }
    const denominator = n * sumXX - sumX * sumX;
    const dailySlope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const weeklyRateKg = dailySlope * 7;
    return { averageWeightKg: avgWeight, weeklyRateKg, daysSpan };
}
/**
 * Deterministically recalibrates TDEE and nutritional prescription based on weight log trends.
 */
function recalibrateTDEEAndNutrition(input) {
    const { weightLogs, currentPlan, userProfile, fitnessProfile, minDaysRequired = 7 } = input;
    const currentCalories = currentPlan.calorieTarget.value;
    const goal = fitnessProfile.goal;
    const trend = calculateWeightTrend(weightLogs);
    const observedRate = trend.weeklyRateKg;
    // Expected rate of change per week by goal
    let expectedRate = 0;
    if (goal === "FAT_LOSS")
        expectedRate = -0.5;
    else if (goal === "MUSCLE_GAIN")
        expectedRate = 0.25;
    else if (goal === "RECOMPOSITION" || goal === "MAINTENANCE")
        expectedRate = 0.0;
    else
        expectedRate = -0.25;
    const rateDivergence = observedRate - expectedRate;
    // Check if recalibration criteria met (span >= minDays or >= 4 logs)
    const hasSufficientData = trend.daysSpan >= minDaysRequired || weightLogs.length >= 4;
    let newCalories = currentCalories;
    let recalibrated = false;
    let reason = "Weight trend is tracking within expected metabolic tolerance.";
    if (hasSufficientData) {
        // Fat Loss Plateau: user lost less than 0.15kg/week on a deficit
        if (goal === "FAT_LOSS" && observedRate >= -0.15) {
            recalibrated = true;
            // Gradual reduction of 100 - 150 kcal
            const deficitAdjustment = 125;
            const floor = userProfile.sex === "FEMALE" ? 1200 : 1500;
            newCalories = Math.max(floor, currentCalories - deficitAdjustment);
            reason = `Fat loss plateau detected: observed rate was ${observedRate.toFixed(2)} kg/week (expected ${expectedRate.toFixed(2)} kg/week). Caloric intake adjusted down by ${currentCalories - newCalories} kcal to stimulate fat oxidation safely.`;
        }
        // Fat Loss Too Fast (> 1.2kg/week)
        else if (goal === "FAT_LOSS" && observedRate < -1.2) {
            recalibrated = true;
            newCalories = Math.min(4000, currentCalories + 150);
            reason = `Weight loss rate of ${observedRate.toFixed(2)} kg/week is too rapid. Increased target by +150 kcal to protect lean muscle mass and metabolic rate.`;
        }
        // Muscle Gain Stall
        else if (goal === "MUSCLE_GAIN" && observedRate < 0.1) {
            recalibrated = true;
            newCalories = Math.min(5000, currentCalories + 150);
            reason = `Lean mass gain plateau detected: observed rate ${observedRate.toFixed(2)} kg/week was below target (+${expectedRate.toFixed(2)} kg/week). Caloric surplus increased by +150 kcal.`;
        }
    }
    const updatedPlan = {
        ...currentPlan,
        calorieTarget: { value: newCalories, provenance: "CALCULATED" },
    };
    return {
        recalibrationApplied: recalibrated,
        recalibrated,
        previousCalorieTarget: currentCalories,
        newCalorieTarget: newCalories,
        observedRateKgPerWeek: observedRate,
        expectedRateKgPerWeek: expectedRate,
        rateDivergenceKgPerWeek: rateDivergence,
        adaptationReason: reason,
        updatedPlan,
    };
}
