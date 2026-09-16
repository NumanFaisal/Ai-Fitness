export interface ExerciseCatalogItem {
  name: string;
  slug: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipmentNeeded: string[];
  instructions: string;
  media: {
    mediaType: "gif" | "video";
    storageKey: string;
    sourceLicense: string;
  };
}

export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  {
    name: "Barbell Bench Press",
    slug: "barbell-bench-press",
    primaryMuscle: "Chest",
    secondaryMuscles: ["Triceps", "Front Delts"],
    equipmentNeeded: ["barbell", "bench"],
    instructions: "Lie flat on the bench with eyes under the bar. Grip bar slightly wider than shoulder width. Lower under control to mid-chest, then press upwards to lockout.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/barbell-bench-press.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Dumbbell Incline Bench Press",
    slug: "dumbbell-incline-press",
    primaryMuscle: "Upper Chest",
    secondaryMuscles: ["Triceps", "Front Delts"],
    equipmentNeeded: ["dumbbells", "bench"],
    instructions: "Set bench at 30-45 degrees. Press dumbbells up from chest level, converging slightly at the top without touching.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/dumbbell-incline-press.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Push-Up",
    slug: "push-up",
    primaryMuscle: "Chest",
    secondaryMuscles: ["Triceps", "Core"],
    equipmentNeeded: ["bodyweight"],
    instructions: "Start in plank position with hands slightly wider than shoulders. Lower chest to floor while maintaining a rigid core, then press back up.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/push-up.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Barbell Back Squat",
    slug: "barbell-back-squat",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Glutes", "Hamstrings", "Core"],
    equipmentNeeded: ["barbell", "squat rack"],
    instructions: "Rest barbell across upper traps. Descend by breaking at hips and knees until thighs are parallel to the ground. Drive through mid-foot to stand.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/barbell-back-squat.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Goblet Squat",
    slug: "goblet-squat",
    primaryMuscle: "Quadriceps",
    secondaryMuscles: ["Glutes", "Core"],
    equipmentNeeded: ["dumbbell"],
    instructions: "Hold a dumbbell or kettlebell vertically against your chest. Squat between your knees keeping torso upright, then press back to standing.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/goblet-squat.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Romanian Deadlift",
    slug: "romanian-deadlift",
    primaryMuscle: "Hamstrings",
    secondaryMuscles: ["Glutes", "Lower Back"],
    equipmentNeeded: ["barbell", "dumbbells"],
    instructions: "Hold weight in front of thighs. Hinge back at hips with soft knees, lowering weight along shins until feeling a stretch in hamstrings. Drive hips forward to stand.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/romanian-deadlift.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Barbell Bent-Over Row",
    slug: "barbell-bent-over-row",
    primaryMuscle: "Back",
    secondaryMuscles: ["Biceps", "Rear Delts"],
    equipmentNeeded: ["barbell"],
    instructions: "Hinge forward at hips with flat back. Pull bar towards lower ribcage, squeezing shoulder blades together at the top.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/barbell-bent-over-row.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Lat Pulldown / Pull-Up",
    slug: "lat-pulldown",
    primaryMuscle: "Lats",
    secondaryMuscles: ["Biceps", "Upper Back"],
    equipmentNeeded: ["cable machine", "pull-up bar"],
    instructions: "Grip bar outside shoulder width. Pull bar down towards upper chest by depressing and retracting shoulder blades.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/lat-pulldown.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Overhead Dumbbell Shoulder Press",
    slug: "dumbbell-shoulder-press",
    primaryMuscle: "Shoulders",
    secondaryMuscles: ["Triceps", "Upper Chest"],
    equipmentNeeded: ["dumbbells"],
    instructions: "Hold dumbbells at shoulder height with elbows under wrists. Press overhead until arms are extended, lower under control.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/dumbbell-shoulder-press.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Dumbbell Lateral Raise",
    slug: "dumbbell-lateral-raise",
    primaryMuscle: "Side Delts",
    secondaryMuscles: ["Traps"],
    equipmentNeeded: ["dumbbells"],
    instructions: "Stand with dumbbells at sides. Raise arms out to the side with slight elbow bend until parallel with floor. Lower slowly.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/dumbbell-lateral-raise.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Dumbbell Bicep Curl",
    slug: "dumbbell-bicep-curl",
    primaryMuscle: "Biceps",
    secondaryMuscles: ["Forearms"],
    equipmentNeeded: ["dumbbells"],
    instructions: "Hold dumbbells with underhand grip. Curl weights towards shoulders keeping elbows stationary at sides.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/dumbbell-bicep-curl.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Tricep Rope Pushdown",
    slug: "tricep-rope-pushdown",
    primaryMuscle: "Triceps",
    secondaryMuscles: [],
    equipmentNeeded: ["cable machine", "resistance bands"],
    instructions: "Attach rope to high pulley. Extend arms downward, flaring ends of rope apart at bottom lockout.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/tricep-rope-pushdown.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
  {
    name: "Plank Hold",
    slug: "plank-hold",
    primaryMuscle: "Core",
    secondaryMuscles: ["Glutes", "Shoulders"],
    equipmentNeeded: ["bodyweight"],
    instructions: "Hold forearms and toes on floor with straight body line from head to heels. Brace abdominals firmly.",
    media: {
      mediaType: "gif",
      storageKey: "exercises/plank-hold.gif",
      sourceLicense: "Licensed CC-BY-SA 4.0 Open Exercise Catalog",
    },
  },
];
