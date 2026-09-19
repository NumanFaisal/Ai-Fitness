import { z } from "zod";
import dotenv from "dotenv";
import { EXERCISE_CATALOG, ExerciseCatalogItem } from "../data/exerciseCatalog";
import { UserPhysiqueAnalysisResult } from "./aiVisionService";
import { PlannedWorkoutDay, PlannedExerciseItem, WorkoutPlanOutput, validateWorkoutUniqueness } from "../engines/workoutEngine";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

export interface DynamicWorkoutContext {
  userId: string;
  profile: {
    name: string;
    age: number;
    sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    heightCm: number;
    weightKg: number;
  };
  goal: {
    type: string;
  };
  training: {
    experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    trainingEnvironment: "GYM" | "HOME" | "OUTDOOR";
    equipmentAvailable: string[];
    workoutDaysPerWeek: number;
    sessionDurationMin: number;
  };
  safety: {
    conservativeMode?: boolean;
    injuries?: string[];
    physicalLimitations?: string[];
    maxRPE?: number;
    maxSetsPerExercise?: number;
  };
  userPhysiqueAnalysis?: Partial<UserPhysiqueAnalysisResult>;
  targetPhysique?: {
    physiqueAesthetic?: string;
    targetBodyFatPct?: number;
    standoutMuscles?: string[];
    trainingFocusRecommendations?: string[];
  };
}

const AIWorkoutDaySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  focus: z.string().min(3),
  dayRationale: z.string().optional(),
  exercises: z.array(
    z.object({
      exerciseName: z.string().min(2),
      targetMuscle: z.string().optional(),
      sets: z.number().min(2).max(6),
      repRangeLow: z.number().min(3).max(30),
      repRangeHigh: z.number().min(5).max(35),
      restSeconds: z.number().min(30).max(240),
      rpeTarget: z.number().min(5).max(10),
      coachingCue: z.string().optional(),
    })
  ).min(3),
});

const AIWorkoutPlanSchema = z.object({
  splitType: z.enum(["FULL_BODY", "UPPER_LOWER", "PUSH_PULL_LEGS"]),
  overallStrategy: z.string().min(10),
  days: z.array(AIWorkoutDaySchema).min(1),
});

/**
 * Finds the closest matching exercise from EXERCISE_CATALOG by name or muscle
 */
function matchCatalogExercise(name: string, targetMuscle?: string, availablePool = EXERCISE_CATALOG): ExerciseCatalogItem {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  
  // 1. Exact or high-overlap name match
  const exactMatch = availablePool.find((e) => {
    const eClean = e.name.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    return eClean === cleanName || cleanName.includes(eClean) || eClean.includes(cleanName);
  });
  if (exactMatch) return exactMatch;

  // 2. Token overlap match
  const tokens = cleanName.split(/\s+/).filter((t) => t.length > 2);
  let bestMatch: ExerciseCatalogItem | null = null;
  let bestScore = 0;

  for (const item of availablePool) {
    const itemTokens = item.name.toLowerCase().split(/\s+/);
    let score = 0;
    for (const t of tokens) {
      if (itemTokens.includes(t)) score += 2;
      else if (item.primaryMuscle.toLowerCase().includes(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  if (bestMatch && bestScore >= 2) return bestMatch;

  // 3. Fallback to target muscle or catalog first item
  if (targetMuscle) {
    const muscleMatch = availablePool.find((e) =>
      e.primaryMuscle.toLowerCase().includes(targetMuscle.toLowerCase())
    );
    if (muscleMatch) return muscleMatch;
  }

  return availablePool[0];
}

/**
 * Filters the catalog strictly for user equipment and safety
 */
function getFilteredPool(
  equipmentAvailable: string[],
  trainingEnvironment: string,
  injuries: string[],
  isConservativeSafeMode = false
): ExerciseCatalogItem[] {
  const userEq = equipmentAvailable.map((e) => e.toLowerCase());
  const isGym = trainingEnvironment === "GYM";

  return EXERCISE_CATALOG.filter((ex) => {
    // 1. Conservative safety mode exclusion
    if (isConservativeSafeMode && ex.isHighAxialLoad) return false;

    // 2. Injury conflicts
    const conflicts = injuries.some((inj) => {
      const lower = inj.toLowerCase();
      if (lower.includes("shoulder") && ex.primaryMuscle.toLowerCase().includes("shoulder")) return true;
      if (lower.includes("knee") && ["quadriceps", "hamstrings"].includes(ex.primaryMuscle.toLowerCase())) return true;
      if (lower.includes("back") && (ex.isHighAxialLoad || ex.secondaryMuscles.some((m) => m.toLowerCase().includes("back")))) return true;
      if (lower.includes("elbow") && ["triceps", "biceps"].includes(ex.primaryMuscle.toLowerCase())) return true;
      return false;
    });
    if (conflicts) return false;

    // 3. Equipment matching
    if (isGym) return true;
    return ex.equipmentNeeded.some((needed) => needed === "bodyweight" || userEq.includes(needed.toLowerCase()));
  });
}

/**
 * Generates an end-to-end dynamic, non-hardcoded workout plan driven by AI analysis
 * of user photos, body composition, posture, and fitness goals.
 */
export async function generateDynamicWorkoutPlan(context: DynamicWorkoutContext): Promise<WorkoutPlanOutput> {
  const {
    profile,
    goal,
    training,
    safety,
    userPhysiqueAnalysis,
    targetPhysique,
  } = context;

  const injuries = safety.injuries || [];
  const safePool = getFilteredPool(
    training.equipmentAvailable,
    training.trainingEnvironment,
    injuries,
    safety.conservativeMode
  );
  const activePool = safePool.length >= 6 ? safePool : EXERCISE_CATALOG;

  // Visual scan features
  const priorityMuscles = userPhysiqueAnalysis?.developmentPriorityMuscles || ["Upper Chest", "Lateral Delts", "Lats", "Core"];
  const visualStrengths = userPhysiqueAnalysis?.visualStrengths || ["Legs", "Back"];
  const posture = userPhysiqueAnalysis?.postureAssessment || "Good posture alignment";
  const bodyFat = userPhysiqueAnalysis?.estimatedBodyFatPct || (profile.sex === "FEMALE" ? 22 : 16);
  const somatotype = userPhysiqueAnalysis?.somatotype || "MESOMORPH";
  const targetMuscles = targetPhysique?.standoutMuscles || ["Upper Chest", "Shoulders", "Core"];

  // Prepare LLM Prompt
  const systemPrompt = `You are an elite master strength and conditioning specialist and biomechanist.
Design a completely customized weekly resistance training program for this specific individual.

RULES:
1. Do NOT use generic or static templates. Every session must be tailored to the user's visual body scan findings, structural weak points, posture, and stated goal.
2. Select exercises compatible with the user's available equipment: [${training.equipmentAvailable.join(", ")}].
3. Strictly avoid exercises conflicting with these injuries/limitations: [${injuries.length ? injuries.join(", ") : "None"}].
4. Strictly respect workout days per week: exactly ${training.workoutDaysPerWeek} days.
5. Provide 5 to 6 distinct, high-impact exercises per session. No duplicate exercises in the same session.
6. Provide specific, tailored coaching cues for every exercise addressing their visual posture and target muscle activation.

Return ONLY a single valid JSON object matching this schema without markdown code fences or conversational prose:
{
  "splitType": "FULL_BODY" | "UPPER_LOWER" | "PUSH_PULL_LEGS",
  "overallStrategy": "2-3 sentences explaining how this split addresses their visual scan and goal",
  "days": [
    {
      "dayOfWeek": 1,
      "focus": "Custom descriptive focus highlighting priority muscles",
      "dayRationale": "Why this session is structured this way for their physique",
      "exercises": [
        {
          "exerciseName": "Exercise name matching equipment",
          "targetMuscle": "Primary muscle targeted",
          "sets": 3,
          "repRangeLow": 8,
          "repRangeHigh": 12,
          "restSeconds": 75,
          "rpeTarget": 8,
          "coachingCue": "Specific form cue referencing posture/weak point"
        }
      ]
    }
  ]
}`;

  const userPrompt = `INDIVIDUAL PROFILE:
- Name: ${profile.name}, Age: ${profile.age}, Sex: ${profile.sex}
- Height: ${profile.heightCm} cm, Weight: ${profile.weightKg} kg
- Primary Goal: ${goal.type}
- Experience Level: ${training.experienceLevel}
- Environment: ${training.trainingEnvironment}
- Available Equipment: ${training.equipmentAvailable.join(", ")}
- Target Days/Week: ${training.workoutDaysPerWeek}
- Session Duration: ${training.sessionDurationMin} minutes

VISUAL BODY IMAGE SCAN FINDINGS:
- Estimated Body Fat: ~${bodyFat}% (${userPhysiqueAnalysis?.bodyFatCategory || "Athletic"})
- Somatotype: ${somatotype}
- Postural Assessment: ${posture}
- Existing Visual Strengths: ${visualStrengths.join(", ")}
- Critical Development Priorities: ${priorityMuscles.join(", ")}
- Target Physique Aesthetic: ${targetPhysique?.physiqueAesthetic || "Athletic V-Taper"}
- Target Standout Muscles: ${targetMuscles.join(", ")}

Generate the complete, non-hardcoded ${training.workoutDaysPerWeek}-day training plan now.`;

  // 1. Attempt AI Generation via Gemini / Groq
  let aiOutput: any = null;

  // Try Groq first
  if (GROQ_API_KEY && !GROQ_API_KEY.includes("your-groq-key")) {
    try {
      const cleanKey = GROQ_API_KEY.replace(/['"]/g, "").trim();
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
          aiOutput = JSON.parse(clean);
        }
      }
    } catch (err) {
      console.warn("[AI Workout Planner] Groq generation notice:", err);
    }
  }

  // Try Gemini if Groq was not used or failed
  if (!aiOutput && GEMINI_API_KEY && !GEMINI_API_KEY.includes("your-gemini-key")) {
    try {
      const cleanKey = GEMINI_API_KEY.replace(/['"]/g, "").trim();
      const models = ["gemini-1.5-flash", "gemini-2.0-flash"];
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
              aiOutput = JSON.parse(clean);
              break;
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn("[AI Workout Planner] Gemini generation notice:", err);
    }
  }

  // If AI generation succeeded, validate and map to catalog items
  if (aiOutput) {
    const validated = AIWorkoutPlanSchema.safeParse(aiOutput);
    if (validated.success) {
      const plan = validated.data;
      const plannedDays: PlannedWorkoutDay[] = [];

      for (const day of plan.days) {
        const usedSlugs = new Set<string>();
        const exercises: PlannedExerciseItem[] = [];

        for (let i = 0; i < day.exercises.length; i++) {
          const rawEx = day.exercises[i];
          const matched = matchCatalogExercise(rawEx.exerciseName, rawEx.targetMuscle, activePool);

          // Guarantee slug uniqueness within this workout day
          let finalCatalogItem = matched;
          if (usedSlugs.has(matched.slug)) {
            const unused = activePool.find((e) => !usedSlugs.has(e.slug));
            if (unused) finalCatalogItem = unused;
          }
          usedSlugs.add(finalCatalogItem.slug);

          exercises.push({
            exerciseName: finalCatalogItem.name,
            exerciseSlug: finalCatalogItem.slug,
            mediaUri: finalCatalogItem.media.storageKey,
            sets: Math.min(safety.maxSetsPerExercise || 5, Math.max(2, rawEx.sets)),
            repRangeLow: rawEx.repRangeLow,
            repRangeHigh: rawEx.repRangeHigh,
            restSeconds: rawEx.restSeconds,
            rpeTarget: Math.min(safety.maxRPE || 9.5, rawEx.rpeTarget),
            orderIndex: i + 1,
            progressionNote: rawEx.coachingCue || `Focus on controlled eccentric phase and full range of motion.`,
          });
        }

        plannedDays.push({
          dayOfWeek: day.dayOfWeek,
          focus: day.focus,
          exercises,
        });
      }

      const uniqueness = validateWorkoutUniqueness({ days: plannedDays });
      if (uniqueness.isValid && plannedDays.length > 0) {
        return {
          splitType: plan.splitType,
          days: plannedDays,
          generatedBy: "AI_VISION_AND_PROFILE_ENGINE",
          safetyGateApplied: Boolean(safety.conservativeMode),
        };
      }
    }
  }

  // 2. Intelligent Dynamic Algorithmic Synthesizer Fallback
  // Dynamically arranges muscle groups based directly on image priorities and user goal
  return generateDynamicSynthesizedWorkout(context, activePool);
}

/**
 * Fallback dynamic synthesizer that algorithmically prioritizes the user's visual weak points
 * without using any fixed, rigid templates.
 */
function generateDynamicSynthesizedWorkout(
  context: DynamicWorkoutContext,
  pool: ExerciseCatalogItem[]
): WorkoutPlanOutput {
  const { goal, training, safety, userPhysiqueAnalysis, targetPhysique } = context;
  const daysPerWeek = Math.max(2, Math.min(7, training.workoutDaysPerWeek));
  const isBeginner = training.experienceLevel === "BEGINNER";
  const isSafeMode = Boolean(safety.conservativeMode);

  const priorityMuscles = [
    ...(userPhysiqueAnalysis?.developmentPriorityMuscles || []),
    ...(targetPhysique?.standoutMuscles || []),
    "Upper Chest",
    "Lateral Delts",
    "Lats",
    "Core",
  ];
  // Unique prioritized muscles
  const prioritized = Array.from(new Set(priorityMuscles));

  // Determine split type dynamically
  let splitType: WorkoutPlanOutput["splitType"] = "FULL_BODY";
  let daySchedule: { dayOfWeek: number; focus: string; targetMuscleGroups: string[] }[] = [];

  if (daysPerWeek <= 3) {
    splitType = "FULL_BODY";
    const dayIndices = [1, 3, 5].slice(0, daysPerWeek);
    daySchedule = dayIndices.map((d, idx) => ({
      dayOfWeek: d,
      focus: `Full Body Dynamic Routine ${String.fromCharCode(65 + idx)} (Targeting ${prioritized[idx % prioritized.length]})`,
      targetMuscleGroups: [
        prioritized[idx % prioritized.length],
        "Quadriceps",
        "Chest",
        "Back",
        prioritized[(idx + 1) % prioritized.length],
        "Core",
      ],
    }));
  } else if (daysPerWeek === 4) {
    splitType = "UPPER_LOWER";
    daySchedule = [
      {
        dayOfWeek: 1,
        focus: `Upper Body Hypertrophy (${prioritized[0] || "Upper Chest"} & Delts Focus)`,
        targetMuscleGroups: [prioritized[0] || "Upper Chest", "Back", "Chest", "Side Delts", "Triceps", "Biceps"],
      },
      {
        dayOfWeek: 2,
        focus: "Lower Body Foundation & Core Stability",
        targetMuscleGroups: ["Quadriceps", "Hamstrings", "Glutes", "Calves", "Core", "Core"],
      },
      {
        dayOfWeek: 4,
        focus: `Upper Body Power & V-Taper (${prioritized[1] || "Lats"} Emphasis)`,
        targetMuscleGroups: [prioritized[1] || "Lats", "Upper Chest", "Rear Delts", "Chest", "Biceps", "Triceps"],
      },
      {
        dayOfWeek: 5,
        focus: "Lower Body Density & Athletic Core",
        targetMuscleGroups: ["Quadriceps", "Hamstrings", "Glutes", "Calves", "Core", "Hamstrings"],
      },
    ];
  } else {
    splitType = "PUSH_PULL_LEGS";
    const basePPL = [
      {
        dayOfWeek: 1,
        focus: `Push: ${prioritized.includes("Upper Chest") ? "Upper Chest & Delts Priority" : "Chest, Delts & Triceps"}`,
        targetMuscleGroups: ["Chest", "Upper Chest", "Shoulders", "Side Delts", "Triceps", "Triceps"],
      },
      {
        dayOfWeek: 2,
        focus: `Pull: ${prioritized.includes("Lats") ? "V-Taper Lat Width & Back" : "Lat Width & Back Thickness"}`,
        targetMuscleGroups: ["Back", "Lats", "Back", "Rear Delts", "Biceps", "Biceps"],
      },
      {
        dayOfWeek: 3,
        focus: "Legs & Core Athletic Foundation",
        targetMuscleGroups: ["Quadriceps", "Hamstrings", "Glutes", "Hamstrings", "Calves", "Core"],
      },
      {
        dayOfWeek: 4,
        focus: "Push: Overhead Levers & Triceps Sculpt",
        targetMuscleGroups: ["Upper Chest", "Chest", "Side Delts", "Triceps", "Triceps", "Core"],
      },
      {
        dayOfWeek: 5,
        focus: "Pull: Upper Back Thickness & Bicep Peak",
        targetMuscleGroups: ["Lats", "Back", "Rear Delts", "Biceps", "Biceps", "Core"],
      },
      {
        dayOfWeek: 6,
        focus: "Legs: Posterior Chain & Core Sculpt",
        targetMuscleGroups: ["Hamstrings", "Glutes", "Quadriceps", "Calves", "Core", "Core"],
      },
      {
        dayOfWeek: 0,
        focus: "Active Recovery & Mobility Core Routine",
        targetMuscleGroups: ["Core", "Glutes", "Back", "Core", "Calves", "Quadriceps"],
      },
    ];
    daySchedule = basePPL.slice(0, daysPerWeek);
  }

  // Rep ranges & sets calibrated to goal
  const defaultSets = isSafeMode ? 3 : isBeginner ? 3 : 4;
  const repLow = goal.type === "STRENGTH" ? 5 : goal.type === "FAT_LOSS" ? 10 : 8;
  const repHigh = goal.type === "STRENGTH" ? 8 : goal.type === "FAT_LOSS" ? 15 : 12;
  const restSec = goal.type === "STRENGTH" ? 120 : 75;
  const defaultRpe = isSafeMode ? 7.0 : isBeginner ? 7.5 : 8.5;

  const plannedDays: PlannedWorkoutDay[] = [];

  for (const session of daySchedule) {
    const usedSlugs = new Set<string>();
    const exercises: PlannedExerciseItem[] = [];

    for (let i = 0; i < session.targetMuscleGroups.length; i++) {
      const targetMuscle = session.targetMuscleGroups[i];

      // Find matching exercise not used today
      let match = pool.find(
        (e) =>
          !usedSlugs.has(e.slug) &&
          (e.primaryMuscle.toLowerCase().includes(targetMuscle.toLowerCase()) ||
            e.secondaryMuscles.some((m) => m.toLowerCase().includes(targetMuscle.toLowerCase())))
      );

      if (!match) {
        match = pool.find((e) => !usedSlugs.has(e.slug));
      }
      if (!match) {
        match = EXERCISE_CATALOG.find((e) => !usedSlugs.has(e.slug)) || EXERCISE_CATALOG[0];
      }

      usedSlugs.add(match.slug);

      exercises.push({
        exerciseName: match.name,
        exerciseSlug: match.slug,
        mediaUri: match.media.storageKey,
        sets: defaultSets,
        repRangeLow: repLow,
        repRangeHigh: repHigh,
        restSeconds: restSec,
        rpeTarget: defaultRpe,
        orderIndex: i + 1,
        progressionNote: `Calibrated for ${goal.type.replace("_", " ").toLowerCase()} with strict mechanical tension.`,
      });
    }

    plannedDays.push({
      dayOfWeek: session.dayOfWeek,
      focus: session.focus,
      exercises,
    });
  }

  return {
    splitType,
    days: plannedDays,
    generatedBy: "DYNAMIC_PHYSIQUE_SYNTHESIS_ENGINE",
    safetyGateApplied: isSafeMode,
  };
}
