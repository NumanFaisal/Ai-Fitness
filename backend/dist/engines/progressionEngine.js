"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateExerciseProgression = evaluateExerciseProgression;
/**
 * Double progression logic:
 * When all sets reach the ceiling of the rep range cleanly (e.g. 12/12/12) with RPE <= 8.5:
 * - Increase load by +2.5% to +5% (minimum +1kg for dumbbells/barbells)
 * - Reset rep target to bottom of rep range
 * If reps are missed or RPE indicates near-failure (>= 9.5):
 * - Maintain weight, do not increase load
 * - Recommend focus on form, recovery, or repetition at current weight
 */
function evaluateExerciseProgression(prescription, recentLogs) {
    if (!recentLogs || recentLogs.length === 0) {
        return {
            shouldProgress: false,
            prescribedWeightKg: prescription.currentWeightKg,
            nextWeightKg: prescription.currentWeightKg,
            prescribedSets: prescription.sets,
            progressionNote: "Baseline prescription established. Complete all target sets to trigger overload.",
            recommendation: "Establish baseline load with controlled eccentric tempo.",
            nextPrescription: `${prescription.sets} sets × ${prescription.repRangeLow}-${prescription.repRangeHigh} reps`,
        };
    }
    const cleanSetsAtCeiling = recentLogs.filter((s) => s.reps >= prescription.repRangeHigh && (s.rpe === undefined || s.rpe <= 8.5)).length;
    const averageRPE = recentLogs.reduce((acc, s) => acc + (s.rpe || 8.0), 0) / Math.max(1, recentLogs.length);
    const missedReps = recentLogs.some((s) => s.reps < prescription.repRangeLow);
    const currentWt = prescription.currentWeightKg || recentLogs[0]?.weightKg || 0;
    const thresholdSets = Math.min(recentLogs.length, Math.min(2, prescription.sets));
    // Case 1: Clean top of rep range achieved across sets with safe RPE
    if (cleanSetsAtCeiling >= thresholdSets && !missedReps && averageRPE <= 8.5) {
        if (currentWt > 0) {
            // Barbell / dumbbell: +2.5% to +5%
            const increment = Math.max(1.0, Math.round(currentWt * 0.035 * 2) / 2); // rounded to 0.5kg
            const nextWt = currentWt + increment;
            return {
                shouldProgress: true,
                prescribedWeightKg: nextWt,
                nextWeightKg: nextWt,
                prescribedReps: prescription.repRangeLow,
                prescribedSets: prescription.sets,
                progressionNote: `Overload Triggered: Hit top of rep range cleanly. Increased load from ${currentWt}kg to ${nextWt}kg (+${increment}kg).`,
                recommendation: `Increase load to ${nextWt}kg (+${increment}kg). Target bottom of rep range (${prescription.repRangeLow} reps).`,
                nextPrescription: `${prescription.sets} sets × ${prescription.repRangeLow} reps @ ${nextWt}kg`,
            };
        }
        else {
            // Bodyweight: add reps or sets
            return {
                shouldProgress: true,
                prescribedWeightKg: 0,
                nextWeightKg: 0,
                prescribedReps: prescription.repRangeHigh + 2,
                prescribedSets: prescription.sets,
                progressionNote: "Bodyweight Overload Triggered: Target +2 reps per set.",
                recommendation: `Increase target reps to ${prescription.repRangeHigh + 2}.`,
                nextPrescription: `${prescription.sets} sets × ${prescription.repRangeHigh + 2} reps`,
            };
        }
    }
    // Case 2: Fatigue or missed reps
    if (missedReps || averageRPE >= 9.5) {
        return {
            shouldProgress: false,
            prescribedWeightKg: currentWt,
            nextWeightKg: currentWt,
            prescribedSets: prescription.sets,
            progressionNote: `Fatigue Check: Average RPE ${averageRPE.toFixed(1)} or missed reps. Repeat current load to consolidate neuromuscular adaptation.`,
            recommendation: `Repeat current load (${currentWt}kg). Prioritize form quality and resting 2-3 minutes between sets.`,
            nextPrescription: `${prescription.sets} sets × ${prescription.repRangeLow}-${prescription.repRangeHigh} reps @ ${currentWt}kg`,
        };
    }
    // Case 3: Steady progression inside the rep bracket
    return {
        shouldProgress: false,
        prescribedWeightKg: currentWt,
        nextWeightKg: currentWt,
        prescribedSets: prescription.sets,
        progressionNote: `Progressing inside rep bracket (${prescription.repRangeLow}-${prescription.repRangeHigh} reps). Add 1 rep per set before increasing weight.`,
        recommendation: "Hold weight constant and aim for +1 extra rep on your first set.",
        nextPrescription: `${prescription.sets} sets × ${prescription.repRangeLow}-${prescription.repRangeHigh} reps @ ${currentWt}kg`,
    };
}
