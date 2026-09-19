"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateHydration = calculateHydration;
function calculateHydration(input) {
    // Baseline fluid requirement: 35ml per kg of bodyweight
    const baselineMl = Math.round(input.weightKg * 35);
    // Exercise hydration replenishment: ~12ml per active training minute
    const duration = input.sessionDurationMin ?? 45;
    const climateFactor = input.isWarmClimate ? 1.25 : 1.0;
    const exerciseAdditionalMl = Math.round(duration * 12 * climateFactor);
    const targetMl = baselineMl + exerciseAdditionalMl;
    return {
        targetMl,
        provenance: "CALCULATED",
        breakdown: {
            baselineMl,
            exerciseAdditionalMl,
        },
    };
}
