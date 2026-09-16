export interface ExerciseVisualInfo {
  imageUri: string;
  youtubeUrl: string;
  muscleGroup: string;
}

// Curated high-resolution fitness demonstration photography & visuals
const EXERCISE_IMAGES: Record<string, string> = {
  // Chest
  "barbell-bench-press": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
  "dumbbell-incline-press": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop&q=80",
  "push-up": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=600&auto=format&fit=crop&q=80",
  "cable-crossover": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80",
  
  // Shoulders
  "dumbbell-shoulder-press": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&auto=format&fit=crop&q=80",
  "overhead-dumbbell-shoulder-press": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&auto=format&fit=crop&q=80",
  "lateral-raise": "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=600&auto=format&fit=crop&q=80",
  "dumbbell-lateral-raise": "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=600&auto=format&fit=crop&q=80",

  // Back
  "barbell-deadlift": "https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?w=600&auto=format&fit=crop&q=80",
  "pull-up": "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=600&auto=format&fit=crop&q=80",
  "barbell-bent-over-row": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80",
  "lat-pulldown": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&auto=format&fit=crop&q=80",

  // Legs
  "barbell-back-squat": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=600&auto=format&fit=crop&q=80",
  "dumbbell-walking-lunge": "https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=600&auto=format&fit=crop&q=80",
  "romanian-deadlift": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
  "leg-press": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop&q=80",

  // Arms & Core
  "dumbbell-bicep-curl": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&auto=format&fit=crop&q=80",
  "triceps-rope-pushdown": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80",
  "plank": "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=600&auto=format&fit=crop&q=80",
};

const DEFAULT_FITNESS_IMAGE = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80";

export function getExerciseVisual(exerciseName: string, exerciseSlug?: string): ExerciseVisualInfo {
  const cleanSlug = (exerciseSlug || exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();

  let imageUri = EXERCISE_IMAGES[cleanSlug];
  if (!imageUri) {
    // Try matching keywords
    const lower = exerciseName.toLowerCase();
    if (lower.includes("bench") || lower.includes("chest") || lower.includes("push")) {
      imageUri = EXERCISE_IMAGES["barbell-bench-press"];
    } else if (lower.includes("squat") || lower.includes("leg") || lower.includes("lunge")) {
      imageUri = EXERCISE_IMAGES["barbell-back-squat"];
    } else if (lower.includes("deadlift") || lower.includes("pull") || lower.includes("row") || lower.includes("back")) {
      imageUri = EXERCISE_IMAGES["barbell-deadlift"];
    } else if (lower.includes("press") || lower.includes("shoulder") || lower.includes("delt")) {
      imageUri = EXERCISE_IMAGES["overhead-dumbbell-shoulder-press"];
    } else if (lower.includes("curl") || lower.includes("bicep") || lower.includes("tricep") || lower.includes("arm")) {
      imageUri = EXERCISE_IMAGES["dumbbell-bicep-curl"];
    } else {
      imageUri = DEFAULT_FITNESS_IMAGE;
    }
  }

  const query = encodeURIComponent(`${exerciseName} proper form tutorial`);
  const youtubeUrl = `https://www.youtube.com/results?search_query=${query}`;

  return {
    imageUri,
    youtubeUrl,
    muscleGroup: exerciseName.includes("Press") ? "Chest/Shoulders" : "Full Body",
  };
}
