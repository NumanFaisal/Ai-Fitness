import { EXERCISE_CATALOG, ExerciseCatalogItem } from "../data/exerciseCatalog";

export interface WorkoutEngineInput {
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  trainingEnvironment: "GYM" | "HOME" | "OUTDOOR";
  equipmentAvailable: string[];
  workoutDaysPerWeek: number;
  sessionDurationMin: number;
  injuries: string[];
  goal: string;
  targetPhysiqueFocus?: string[];
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

  // Fallback to pool if equipment filter leaves empty pool
  const pool = availableExercises.length > 0 ? availableExercises : EXERCISE_CATALOG;

  // Sets & Rep schemes based on experience and goal
  const defaultSets = experienceLevel === "BEGINNER" ? 3 : 4;
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
    // Full Body Split (e.g. Mon, Wed, Fri) - Guarantee 6 exercises per session
    splitType = "FULL_BODY";
    const assignedDays = [1, 3, 5].slice(0, workoutDaysPerWeek);
    assignedDays.forEach((dayNum, idx) => {
      const selected = [
        getExercisesByMuscles(["Quadriceps", "Glutes"])[idx % 2] ?? pool[3], // Squat/Leg Press
        getExercisesByMuscles(["Chest", "Upper Chest"])[idx % 2] ?? pool[0], // Bench / Incline
        getExercisesByMuscles(["Back", "Lats"])[idx % 2] ?? pool[6], // Row / Pulldown
        getExercisesByMuscles(["Hamstrings"])[0] ?? pool[5], // Romanian Deadlift / Leg Curl
        getExercisesByMuscles(["Shoulders", "Side Delts"])[0] ?? pool[8], // Shoulder Press / Lateral Raise
        getExercisesByMuscles(["Core"])[idx % 2] ?? pool[10], // Plank / Leg Raise
      ];
      days.push({
        dayOfWeek: dayNum,
        focus: `Full Body Aesthetic Routine ${String.fromCharCode(65 + idx)}`,
        exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
      });
    });
  } else if (workoutDaysPerWeek === 4) {
    // Upper / Lower Split (Mon, Tue, Thu, Fri) - Guarantee 6 exercises per session
    splitType = "UPPER_LOWER";
    const dayConfigs = [
      {
        day: 1,
        focus: "Upper Body Power & V-Taper",
        muscles: [
          ["Chest"],
          ["Back"],
          ["Upper Chest"],
          ["Shoulders", "Side Delts"],
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
          ["Glutes", "Quadriceps"],
          ["Hamstrings"],
          ["Calves"],
          ["Core"],
        ],
      },
      {
        day: 4,
        focus: "Upper Body Hypertrophy & Arms",
        muscles: [
          ["Upper Chest", "Chest"],
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
          ["Quadriceps", "Glutes"],
          ["Calves"],
          ["Core"],
          ["Core"],
        ],
      },
    ];

    dayConfigs.forEach((cfg) => {
      const selected = cfg.muscles
        .map((mList, i) => {
          const match = getExercisesByMuscles(mList);
          return match[i % match.length] || match[0] || pool[i % pool.length];
        })
        .slice(0, 6);

      days.push({
        dayOfWeek: cfg.day,
        focus: cfg.focus,
        exercises: selected.map((ex, i) => toPlannedItem(ex, i + 1)),
      });
    });
  } else {
    // Push / Pull / Legs Split (5 - 6 days) - Guarantee 6 exercises per session
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
          ["Chest", "Triceps"],
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
          ["Quadriceps"],
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
          ["Quadriceps"],
          ["Hamstrings"],
          ["Calves"],
          ["Core"],
        ],
      },
    ].slice(0, workoutDaysPerWeek);

    pplConfigs.forEach((cfg) => {
      const selected = cfg.muscles
        .map((mList, i) => {
          const match = getExercisesByMuscles(mList);
          return match[i % match.length] || match[0] || pool[i % pool.length];
        })
        .slice(0, 6);

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
    generatedBy: "Sports Science Hypertrophy Engine v2.0",
  };
}
