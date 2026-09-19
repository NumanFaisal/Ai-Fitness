"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWorkoutUniqueness = validateWorkoutUniqueness;
exports.generateWorkoutPlan = generateWorkoutPlan;
const exerciseCatalog_1 = require("../data/exerciseCatalog");
const SYNERGISTIC_FALLBACKS = {
    "Upper Chest": ["Chest", "Shoulders"],
    "Chest": ["Upper Chest", "Triceps", "Shoulders"],
    "Side Delts": ["Shoulders", "Upper Chest"],
    "Rear Delts": ["Back", "Lats", "Shoulders"],
    "Shoulders": ["Side Delts", "Chest", "Triceps"],
    "Back": ["Lats", "Rear Delts", "Biceps"],
    "Lats": ["Back", "Biceps"],
    "Quadriceps": ["Glutes", "Hamstrings", "Calves"],
    "Hamstrings": ["Glutes", "Quadriceps", "Calves"],
    "Glutes": ["Hamstrings", "Quadriceps"],
    "Calves": ["Core", "Glutes", "Quadriceps"],
    "Biceps": ["Back", "Lats"],
    "Triceps": ["Chest", "Shoulders"],
    "Core": ["Glutes", "Calves", "Back"],
};
/**
 * Validates that every workout day contains strictly unique exercise slugs.
 * Throws or returns validation report if duplicates are found.
 */
function validateWorkoutUniqueness(plan) {
    const duplicateReport = [];
    const duplicates = [];
    for (const day of plan.days || []) {
        const seen = new Set();
        for (const ex of day.exercises || []) {
            const slug = ex.exerciseSlug || ex.slug || ex.exerciseName?.toLowerCase().replace(/\s+/g, "_");
            if (slug && seen.has(slug)) {
                duplicates.push(slug);
                duplicateReport.push(`Day ${day.dayOfWeek} (${day.focus}) contains duplicate exercise: ${ex.exerciseName || slug} (${slug})`);
            }
            if (slug)
                seen.add(slug);
        }
    }
    return {
        isValid: duplicateReport.length === 0,
        valid: duplicateReport.length === 0,
        duplicates,
        duplicateReport,
    };
}
function generateWorkoutPlan(input) {
    const { experienceLevel, workoutDaysPerWeek, injuries, equipmentAvailable, isConservativeSafeMode, progressionHistory, targetPhysiqueFocus, } = input;
    // Filter exercises compatible with user's available equipment
    const userEquipment = equipmentAvailable.map((e) => e.toLowerCase());
    const isGym = input.trainingEnvironment === "GYM";
    const availableExercises = exerciseCatalog_1.EXERCISE_CATALOG.filter((ex) => {
        // 1. Safety Gate: If in conservative safe mode, exclude high axial load / spinal compression lifts
        if (isConservativeSafeMode && ex.isHighAxialLoad) {
            return false;
        }
        // 2. Check injury conflicts
        const conflictsWithInjury = injuries.some((inj) => {
            const lower = inj.toLowerCase();
            if (lower.includes("shoulder") && ex.primaryMuscle.toLowerCase().includes("shoulder"))
                return true;
            if (lower.includes("knee") && ["quadriceps", "hamstrings"].includes(ex.primaryMuscle.toLowerCase()))
                return true;
            if (lower.includes("back") && (ex.isHighAxialLoad || ex.secondaryMuscles.some((m) => m.toLowerCase().includes("back"))))
                return true;
            if (lower.includes("elbow") && ["triceps", "biceps"].includes(ex.primaryMuscle.toLowerCase()))
                return true;
            return false;
        });
        if (conflictsWithInjury)
            return false;
        // 3. Equipment matching
        if (isGym)
            return true;
        return ex.equipmentNeeded.some((needed) => needed === "bodyweight" || userEquipment.includes(needed.toLowerCase()));
    });
    // Fallback to pool if filter leaves empty pool
    const pool = availableExercises.length > 0 ? availableExercises : exerciseCatalog_1.EXERCISE_CATALOG;
    // Sets & Rep schemes based on experience, goal, and safety gate
    let defaultSets = experienceLevel === "BEGINNER" ? 3 : 4;
    let repLow = input.goal === "STRENGTH" ? 5 : 8;
    let repHigh = input.goal === "STRENGTH" ? 8 : 12;
    let restSec = input.goal === "STRENGTH" ? 120 : 75;
    let rpe = experienceLevel === "BEGINNER" ? 7 : 8.5;
    // Safety Gate Constraints on Workout Prescription
    if (isConservativeSafeMode) {
        defaultSets = experienceLevel === "BEGINNER" ? 2 : 3;
        rpe = experienceLevel === "BEGINNER" ? 6.5 : 7.0; // Strictly cap RPE to avoid high neuromuscular fatigue
        restSec = Math.max(restSec, 90); // Enforce full recovery
        repLow = Math.max(repLow, 10);
        repHigh = Math.max(repHigh, 15);
    }
    const toPlannedItem = (ex, order) => {
        const progression = progressionHistory?.[ex.slug];
        const sets = progression?.prescribedSets ?? defaultSets;
        const repRangeLow = progression?.prescribedReps ? Math.max(5, progression.prescribedReps - 2) : repLow;
        const repRangeHigh = progression?.prescribedReps ? progression.prescribedReps : repHigh;
        return {
            exerciseName: ex.name,
            exerciseSlug: ex.slug,
            mediaUri: ex.media.storageKey,
            sets,
            repRangeLow,
            repRangeHigh,
            restSeconds: restSec,
            rpeTarget: rpe,
            orderIndex: order,
            targetWeightKg: progression?.prescribedWeightKg,
            progressionNote: progression?.progressionNote,
        };
    };
    /**
     * Helper to pick next distinct exercise for a day, avoiding any duplicate exercise slugs in the same session.
     * If direct matches are exhausted, falls back to synergistic muscle groups, then to any unused exercise in the pool.
     */
    const pickNextExercise = (preferredMuscles, usedSlugs, orderIndex) => {
        // 1. Prioritize Target Physique Focus muscles if applicable and matching
        if (targetPhysiqueFocus && targetPhysiqueFocus.length > 0 && orderIndex <= 1) {
            const physiqueMatches = pool.filter((e) => !usedSlugs.has(e.slug) &&
                targetPhysiqueFocus.some((tf) => e.primaryMuscle.toLowerCase().includes(tf.toLowerCase()) ||
                    preferredMuscles.some((pm) => e.primaryMuscle.toLowerCase().includes(pm.toLowerCase()))));
            if (physiqueMatches.length > 0) {
                const chosen = physiqueMatches[0];
                usedSlugs.add(chosen.slug);
                return chosen;
            }
        }
        // 2. Direct match among available pool excluding already used today
        const directMatches = pool.filter((e) => !usedSlugs.has(e.slug) &&
            preferredMuscles.some((m) => e.primaryMuscle.toLowerCase().includes(m.toLowerCase()) ||
                e.secondaryMuscles.some((s) => s.toLowerCase().includes(m.toLowerCase()))));
        if (directMatches.length > 0) {
            const chosen = directMatches[0];
            usedSlugs.add(chosen.slug);
            return chosen;
        }
        // 3. Synergistic broader muscle fallback
        const fallbacks = preferredMuscles.flatMap((m) => SYNERGISTIC_FALLBACKS[m] || []);
        const fallbackMatches = pool.filter((e) => !usedSlugs.has(e.slug) &&
            fallbacks.some((fb) => e.primaryMuscle.toLowerCase().includes(fb.toLowerCase()) ||
                e.secondaryMuscles.some((s) => s.toLowerCase().includes(fb.toLowerCase()))));
        if (fallbackMatches.length > 0) {
            const chosen = fallbackMatches[0];
            usedSlugs.add(chosen.slug);
            return chosen;
        }
        // 4. Any unused exercise from the filtered pool
        const unusedAny = pool.filter((e) => !usedSlugs.has(e.slug));
        if (unusedAny.length > 0) {
            const chosen = unusedAny[0];
            usedSlugs.add(chosen.slug);
            return chosen;
        }
        // 5. Expand to global catalog for any unused exercise matching user equipment & safety
        const globalUnused = exerciseCatalog_1.EXERCISE_CATALOG.filter((e) => !usedSlugs.has(e.slug) &&
            (isGym || e.equipmentNeeded.some((n) => n === "bodyweight" || userEquipment.includes(n.toLowerCase()))) &&
            !injuries.some((inj) => {
                const lower = inj.toLowerCase();
                return e.contraindications?.some((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
            }));
        if (globalUnused.length > 0) {
            const chosen = globalUnused[0];
            usedSlugs.add(chosen.slug);
            return chosen;
        }
        // 6. If all exercises are exhausted, return null to reduce count — NEVER repeat an exercise
        return null;
    };
    const days = [];
    let splitType = "FULL_BODY";
    if (workoutDaysPerWeek <= 3) {
        // Full Body Split (e.g. Mon, Wed, Fri) - Guarantee 6 distinct exercises per session
        splitType = "FULL_BODY";
        const assignedDays = [1, 3, 5].slice(0, workoutDaysPerWeek);
        const dayTemplates = [
            [
                ["Quadriceps"],
                ["Chest"],
                ["Back"],
                ["Hamstrings"],
                ["Shoulders", "Side Delts"],
                ["Core"],
            ],
            [
                ["Quadriceps", "Glutes"],
                ["Upper Chest"],
                ["Lats"],
                ["Hamstrings"],
                ["Side Delts"],
                ["Core"],
            ],
            [
                ["Quadriceps"],
                ["Chest"],
                ["Back", "Lats"],
                ["Glutes", "Hamstrings"],
                ["Rear Delts"],
                ["Core"],
            ],
        ];
        assignedDays.forEach((dayNum, idx) => {
            const usedSlugs = new Set();
            const template = dayTemplates[idx % dayTemplates.length];
            const selected = [];
            template.forEach((muscleList, slotIdx) => {
                const picked = pickNextExercise(muscleList, usedSlugs, slotIdx);
                if (picked)
                    selected.push(picked);
            });
            days.push({
                dayOfWeek: dayNum,
                focus: `Full Body Aesthetic Routine ${String.fromCharCode(65 + idx)}`,
                exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
            });
        });
    }
    else if (workoutDaysPerWeek === 4) {
        // Upper / Lower Split (Mon, Tue, Thu, Fri) - Guarantee 6 distinct exercises per session
        splitType = "UPPER_LOWER";
        const dayConfigs = [
            {
                day: 1,
                focus: "Upper Body Power & V-Taper",
                muscles: [
                    ["Chest"],
                    ["Back"],
                    ["Upper Chest"],
                    ["Side Delts"],
                    ["Triceps"],
                    ["Biceps"],
                ],
            },
            {
                day: 2,
                focus: "Lower Body Density & Core",
                muscles: [
                    ["Quadriceps"],
                    ["Hamstrings"],
                    ["Glutes"],
                    ["Hamstrings"],
                    ["Calves"],
                    ["Core"],
                ],
            },
            {
                day: 4,
                focus: "Upper Body Hypertrophy & Arms",
                muscles: [
                    ["Upper Chest"],
                    ["Lats"],
                    ["Side Delts"],
                    ["Rear Delts"],
                    ["Biceps"],
                    ["Triceps"],
                ],
            },
            {
                day: 5,
                focus: "Lower Body Hypertrophy & Abs",
                muscles: [
                    ["Quadriceps"],
                    ["Hamstrings"],
                    ["Glutes"],
                    ["Calves"],
                    ["Core"],
                    ["Core"],
                ],
            },
        ];
        dayConfigs.forEach((cfg) => {
            const usedSlugs = new Set();
            const selected = [];
            cfg.muscles.slice(0, 6).forEach((mList, i) => {
                const picked = pickNextExercise(mList, usedSlugs, i);
                if (picked)
                    selected.push(picked);
            });
            days.push({
                dayOfWeek: cfg.day,
                focus: cfg.focus,
                exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
            });
        });
    }
    else {
        // Push / Pull / Legs Split (5 - 7 days) - Full support for 5, 6, and 7 days
        splitType = "PUSH_PULL_LEGS";
        const pplConfigs = [
            {
                day: 1,
                focus: "Push: Chest, Front/Side Delts, Triceps",
                muscles: [
                    ["Chest"],
                    ["Upper Chest"],
                    ["Shoulders"],
                    ["Side Delts"],
                    ["Triceps"],
                    ["Triceps"],
                ],
            },
            {
                day: 2,
                focus: "Pull: Lat Width, Upper Back, Biceps",
                muscles: [
                    ["Back"],
                    ["Lats"],
                    ["Back"],
                    ["Rear Delts"],
                    ["Biceps"],
                    ["Biceps"],
                ],
            },
            {
                day: 3,
                focus: "Legs & Core Athleticism",
                muscles: [
                    ["Quadriceps"],
                    ["Hamstrings"],
                    ["Glutes"],
                    ["Hamstrings"],
                    ["Calves"],
                    ["Core"],
                ],
            },
            {
                day: 4,
                focus: "Push: Upper Chest & Shoulder Sculpt",
                muscles: [
                    ["Upper Chest"],
                    ["Chest"],
                    ["Side Delts"],
                    ["Triceps"],
                    ["Triceps"],
                    ["Core"],
                ],
            },
            {
                day: 5,
                focus: "Pull: V-Taper Thickness & Arm Peak",
                muscles: [
                    ["Lats"],
                    ["Back"],
                    ["Rear Delts"],
                    ["Biceps"],
                    ["Biceps"],
                    ["Core"],
                ],
            },
            {
                day: 6,
                focus: "Legs: Hamstring & Glute Power + Core",
                muscles: [
                    ["Hamstrings"],
                    ["Quadriceps"],
                    ["Glutes"],
                    ["Hamstrings"],
                    ["Calves"],
                    ["Core"],
                ],
            },
            {
                day: 7,
                focus: "Active Recovery, Mobility, Core & Conditioning",
                muscles: [
                    ["Core"],
                    ["Glutes"],
                    ["Calves"],
                    ["Rear Delts"],
                    ["Core"],
                    ["Lats"],
                ],
            },
        ].slice(0, Math.min(7, Math.max(1, workoutDaysPerWeek)));
        pplConfigs.forEach((cfg) => {
            const usedSlugs = new Set();
            const selected = [];
            cfg.muscles.slice(0, 6).forEach((mList, i) => {
                const picked = pickNextExercise(mList, usedSlugs, i);
                if (picked)
                    selected.push(picked);
            });
            days.push({
                dayOfWeek: cfg.day,
                focus: cfg.focus,
                exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
            });
        });
    }
    const output = {
        splitType,
        days,
        generatedBy: "Sports Science Hypertrophy Engine v2.5",
        safetyGateApplied: Boolean(isConservativeSafeMode),
    };
    // Run validation
    const validation = validateWorkoutUniqueness(output);
    if (!validation.isValid) {
        console.error("[WorkoutEngine] Uniqueness validation failed:", validation.duplicateReport);
    }
    return output;
}
