import { EXERCISE_CATALOG, ExerciseCatalogItem } from "../data/exerciseCatalog";

export interface WorkoutEngineInput {
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  trainingEnvironment: "GYM" | "HOME" | "OUTDOOR";
  equipmentAvailable: string[];
  workoutDaysPerWeek: number;
  sessionDurationMin: number;
  injuries: string[];
  goal: string;
}

export interface PlannedExerciseItem {
  exerciseName: string;
  exerciseSlug: string;
  mediaUri: string;
  sets: number;
  repRangeLow: number;
  repRangeHigh: number;
  restSeconds: number;
  rpeTarget: number;
  orderIndex: number;
}

export interface PlannedWorkoutDay {
  dayOfWeek: number;
  focus: string;
  exercises: PlannedExerciseItem[];
}

export interface WorkoutPlanOutput {
  splitType: "FULL_BODY" | "UPPER_LOWER" | "PUSH_PULL_LEGS";
  days: PlannedWorkoutDay[];
  generatedBy: string;
}

export function generateWorkoutPlan(input: WorkoutEngineInput): WorkoutPlanOutput {
  const { experienceLevel, workoutDaysPerWeek, injuries, equipmentAvailable } = input;

  // Filter exercises compatible with user's available equipment
  const userEquipment = equipmentAvailable.map((e) => e.toLowerCase());
  const isGym = input.trainingEnvironment === "GYM";

  const availableExercises = EXERCISE_CATALOG.filter((ex) => {
    // Check injury conflicts
    const conflictsWithInjury = injuries.some((inj) => {
      const lower = inj.toLowerCase();
      if (lower.includes("shoulder") && ex.primaryMuscle.toLowerCase().includes("shoulder")) return true;
      if (lower.includes("knee") && ["quadriceps", "hamstrings"].includes(ex.primaryMuscle.toLowerCase())) return true;
      if (lower.includes("back") && ex.secondaryMuscles.some((m) => m.toLowerCase().includes("back"))) return true;
      return false;
    });
    if (conflictsWithInjury) return false;

    // In gym environment, all catalog equipment is assumed available
    if (isGym) return true;

    // Otherwise must match user equipment or bodyweight
    return ex.equipmentNeeded.some(
      (needed) => needed === "bodyweight" || userEquipment.includes(needed.toLowerCase())
    );
  });

  // Fallback to push-up / bodyweight if equipment filter leaves empty pool
  const pool = availableExercises.length > 0 ? availableExercises : EXERCISE_CATALOG;

  // Sets & Rep schemes based on experience and goal
  const defaultSets = experienceLevel === "BEGINNER" ? 3 : experienceLevel === "INTERMEDIATE" ? 4 : 4;
  const repLow = input.goal === "STRENGTH" ? 5 : 8;
  const repHigh = input.goal === "STRENGTH" ? 8 : 12;
  const restSec = input.goal === "STRENGTH" ? 120 : 75;
  const rpe = experienceLevel === "BEGINNER" ? 7 : 8.5;

  const toPlannedItem = (ex: ExerciseCatalogItem, order: number): PlannedExerciseItem => ({
    exerciseName: ex.name,
    exerciseSlug: ex.slug,
    mediaUri: ex.media.storageKey,
    sets: defaultSets,
    repRangeLow: repLow,
    repRangeHigh: repHigh,
    restSeconds: restSec,
    rpeTarget: rpe,
    orderIndex: order,
  });

  const getExercisesByMuscles = (muscles: string[]): ExerciseCatalogItem[] => {
    return pool.filter((e) =>
      muscles.some(
        (m) =>
          e.primaryMuscle.toLowerCase().includes(m.toLowerCase()) ||
          e.secondaryMuscles.some((s) => s.toLowerCase().includes(m.toLowerCase()))
      )
    );
  };

  const days: PlannedWorkoutDay[] = [];
  let splitType: WorkoutPlanOutput["splitType"] = "FULL_BODY";

  if (workoutDaysPerWeek <= 3) {
    // Full Body Split (e.g. Mon, Wed, Fri)
    splitType = "FULL_BODY";
    const assignedDays = [1, 3, 5].slice(0, workoutDaysPerWeek);
    assignedDays.forEach((dayNum, idx) => {
      const selected = [
        getExercisesByMuscles(["Quadriceps", "Hamstrings"])[idx % 2] ?? pool[0],
        getExercisesByMuscles(["Chest"])[0] ?? pool[1],
        getExercisesByMuscles(["Back", "Lats"])[0] ?? pool[2],
        getExercisesByMuscles(["Shoulders"])[0] ?? pool[3],
        getExercisesByMuscles(["Core"])[0] ?? pool[4],
      ];
      days.push({
        dayOfWeek: dayNum,
        focus: `Full Body Routine ${String.fromCharCode(65 + idx)}`,
        exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
      });
    });
  } else if (workoutDaysPerWeek === 4) {
    // Upper / Lower Split (Mon, Tue, Thu, Fri)
    splitType = "UPPER_LOWER";
    const dayConfigs = [
      { day: 1, focus: "Upper Body Power", muscles: ["Chest", "Back", "Shoulders", "Triceps"] },
      { day: 2, focus: "Lower Body & Core", muscles: ["Quadriceps", "Hamstrings", "Glutes", "Core"] },
      { day: 4, focus: "Upper Body Hypertrophy", muscles: ["Chest", "Lats", "Side Delts", "Biceps"] },
      { day: 5, focus: "Lower Body Hypertrophy", muscles: ["Quadriceps", "Hamstrings", "Core"] },
    ];
    dayConfigs.forEach((cfg) => {
      const selected = cfg.muscles
        .map((m) => getExercisesByMuscles([m])[0])
        .filter((ex): ex is ExerciseCatalogItem => Boolean(ex));
      days.push({
        dayOfWeek: cfg.day,
        focus: cfg.focus,
        exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
      });
    });
  } else {
    // Push / Pull / Legs Split (5 - 6 days)
    splitType = "PUSH_PULL_LEGS";
    const pplConfigs = [
      { day: 1, focus: "Push (Chest, Shoulders, Triceps)", muscles: ["Chest", "Shoulders", "Triceps"] },
      { day: 2, focus: "Pull (Back, Biceps)", muscles: ["Back", "Lats", "Biceps"] },
      { day: 3, focus: "Legs & Core", muscles: ["Quadriceps", "Hamstrings", "Core"] },
      { day: 4, focus: "Push (Hypertrophy)", muscles: ["Upper Chest", "Side Delts", "Triceps"] },
      { day: 5, focus: "Pull (Hypertrophy)", muscles: ["Lats", "Rear Delts", "Biceps"] },
      { day: 6, focus: "Legs (Glute & Ham Focus)", muscles: ["Hamstrings", "Glutes", "Core"] },
    ].slice(0, workoutDaysPerWeek);

    pplConfigs.forEach((cfg) => {
      const selected = cfg.muscles
        .map((m) => getExercisesByMuscles([m])[0])
        .filter((ex): ex is ExerciseCatalogItem => Boolean(ex));
      days.push({
        dayOfWeek: cfg.day,
        focus: cfg.focus,
        exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
      });
    });
  }

  return {
    splitType,
    days,
    generatedBy: "Deterministic Training Engine v1.0",
  };
}
