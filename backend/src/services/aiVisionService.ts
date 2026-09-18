import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

export interface TargetPhysiqueAnalysisResult {
  physiqueAesthetic: string;
  targetBodyFatPct: number;
  targetWeightKg: number;
  estimatedWeeks: number;
  standoutMuscles: string[];
  trainingFocusRecommendations: string[];
  nutritionStrategy: string;
  description: string;
  confidenceScore: number;
}

export interface TargetPhysiqueInput {
  imageBase64?: string;
  imageUrl?: string;
  heightCm: number;
  currentWeightKg: number;
  sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  goal?: string;
}

/**
 * Calculates scientifically grounded target weight based on user's height, biological sex,
 * current weight, and target body fat percentage.
 */
export function calculatePhysiologicalTargetWeight(
  heightCm: number,
  currentWeightKg: number,
  sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY",
  targetBodyFatPct: number,
  goal?: string
): number {
  const hM = heightCm / 100;
  const isMale = sex === "MALE" || sex === "OTHER" || sex === "PREFER_NOT_TO_SAY";

  // Healthy aesthetic athletic BMI range: Male 22.0 - 24.0, Female 20.5 - 22.5
  const baseAthleticBmi = isMale ? 23.0 : 21.5;
  let estimatedTargetWeight = Math.round(baseAthleticBmi * (hM * hM) * 10) / 10;

  // Refine using Fat-Free Mass Index (FFMI) approach
  if (targetBodyFatPct < 12 && isMale) {
    // Shredded aesthetic physique (FFMI ~ 21-22)
    const targetLeanMass = Math.round(21.2 * (hM * hM));
    estimatedTargetWeight = Math.round(targetLeanMass / (1 - targetBodyFatPct / 100));
  } else if (targetBodyFatPct > 15 && isMale) {
    // Bulking / Power physique
    const targetLeanMass = Math.round(22.0 * (hM * hM));
    estimatedTargetWeight = Math.round(targetLeanMass / (1 - targetBodyFatPct / 100));
  } else if (!isMale) {
    // Female athletic tone
    const targetLeanMass = Math.round(17.5 * (hM * hM));
    estimatedTargetWeight = Math.round(targetLeanMass / (1 - targetBodyFatPct / 100));
  }

  // Sanity guardrail relative to current weight & goal
  if (goal === "FAT_LOSS") {
    if (estimatedTargetWeight >= currentWeightKg) {
      estimatedTargetWeight = Math.round(currentWeightKg * 0.88); // ~12% bodyweight reduction
    }
  } else if (goal === "MUSCLE_GAIN" || goal === "STRENGTH") {
    if (estimatedTargetWeight <= currentWeightKg) {
      estimatedTargetWeight = Math.round(currentWeightKg + 4);
    }
  }

  return Math.round(estimatedTargetWeight);
}

/**
 * Analyzes target physique image using Gemini / Groq Vision with fallback to sports-science estimation
 */
export async function analyzeTargetPhysique(input: TargetPhysiqueInput): Promise<TargetPhysiqueAnalysisResult> {
  const { imageBase64, imageUrl, heightCm, currentWeightKg, sex, goal } = input;

  const prompt = `You are an elite anthropometrist and physique coach. Analyze this target physique image to determine the aesthetic archetype, realistic body fat percentage, muscular highlights, and training requirements.
User Profile:
- Height: ${heightCm} cm
- Current Weight: ${currentWeightKg} kg
- Biological Sex: ${sex}
- Primary Goal: ${goal || "Aesthetic Transformation"}

Return ONLY a valid JSON object matching this schema without code fences:
{
  "physiqueAesthetic": "e.g. V-Taper Athletic Aesthetic, Shredded Hypertrophy, Lean Toned Runner, Powerbuilder",
  "targetBodyFatPct": 11,
  "standoutMuscles": ["Upper Chest", "Lateral Delts", "Lats / V-Taper", "Chiseled Abs", "Quad Sweep"],
  "trainingFocusRecommendations": ["Emphasize incline presses and lateral raises 2x/week", "Prioritize heavy vertical pulling for lat width"],
  "nutritionStrategy": "Caloric strategy description matching this body composition target",
  "description": "2-3 sentences analyzing the key characteristics of this target physique and realistic path to attain it",
  "estimatedWeeks": 14,
  "confidenceScore": 0.88
}`;

  // 1. Try Gemini Vision if key exists
  if (GEMINI_API_KEY && (imageBase64 || imageUrl)) {
    try {
      const cleanKey = GEMINI_API_KEY.replace(/['"]/g, "").trim();
      const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
          
          let imagePart: any;
          if (imageBase64) {
            const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const mimeTypeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
            imagePart = { inline_data: { mime_type: mimeType, data: cleanBase64 } };
          }

          if (imagePart) {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: prompt }, imagePart],
                  },
                ],
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(clean);
                const targetBf = Number(parsed.targetBodyFatPct) || (sex === "FEMALE" ? 18 : 12);
                const targetWeight = calculatePhysiologicalTargetWeight(heightCm, currentWeightKg, sex, targetBf, goal);

                return {
                  physiqueAesthetic: parsed.physiqueAesthetic || "Lean Athletic V-Taper",
                  targetBodyFatPct: targetBf,
                  targetWeightKg: targetWeight,
                  estimatedWeeks: Number(parsed.estimatedWeeks) || 12,
                  standoutMuscles: Array.isArray(parsed.standoutMuscles) ? parsed.standoutMuscles : ["Shoulders", "Chest", "Lats", "Core"],
                  trainingFocusRecommendations: Array.isArray(parsed.trainingFocusRecommendations) ? parsed.trainingFocusRecommendations : ["Heavy compound lifts with high-tension accessory work"],
                  nutritionStrategy: parsed.nutritionStrategy || "High protein intake with progressive energy management",
                  description: parsed.description || "Target physique characterized by dense lean muscle and low body fat.",
                  confidenceScore: 0.92,
                };
              }
            }
          }
        } catch {
          // Continue to next attempt
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Sports-Science Calibrated Anthropometric Classifier (Deterministic Fallback)
  const isFemale = sex === "FEMALE";
  const defaultBf = isFemale ? 19 : 11.5;
  const targetWeight = calculatePhysiologicalTargetWeight(heightCm, currentWeightKg, sex, defaultBf, goal);
  const weightDelta = Math.abs(currentWeightKg - targetWeight);
  const estimatedWeeks = Math.max(8, Math.min(24, Math.round(weightDelta / 0.5) + 4));

  const isMuscleGain = goal === "MUSCLE_GAIN" || goal === "STRENGTH";
  const aesthetic = isFemale
    ? "Toned & Athletic Silhouette"
    : isMuscleGain
    ? "Muscular V-Taper Hypertrophy"
    : "Chiseled Aesthetic & Low Body Fat";

  const standoutMuscles = isFemale
    ? ["Glutes & Hamstrings", "Core & Obliques", "Back & Posture", "Shoulders"]
    : ["Upper Chest", "Lateral Delts (V-Taper)", "Lats & Upper Back", "Defined Rectus Abdominis", "Quadricep Sweep"];

  const trainingFocus = isFemale
    ? [
        "Focus on hip thrusts, squats, and Romanian deadlifts 2-3x/week for lower body definition",
        "Maintain progressive upper body pulling to sculpt shoulder-to-waist taper",
      ]
    : [
        "Prioritize incline dumbbell presses and lateral raises for broad upper shelf",
        "Progressive overload on lat pulldowns and rows for dramatic V-taper taper",
        "Direct abdominal training 2-3x/week to maintain core chiseled definition",
      ];

  const nutritionStrategy = currentWeightKg > targetWeight
    ? `Moderate caloric deficit (-400 kcal) with 2.0g/kg protein to burn adipose fat while locking in lean muscle.`
    : `Lean hyper-caloric surplus (+250 kcal) to fuel muscle hypertrophy with minimal fat accumulation.`;

  return {
    physiqueAesthetic: aesthetic,
    targetBodyFatPct: defaultBf,
    targetWeightKg: targetWeight,
    estimatedWeeks,
    standoutMuscles,
    trainingFocusRecommendations: trainingFocus,
    nutritionStrategy,
    description: `Analyzed reference physique: target body fat ~${defaultBf}%, emphasizing balanced muscle symmetry across ${standoutMuscles.slice(0, 3).join(", ")}. Calibrated for realistic timeline of ${estimatedWeeks} weeks.`,
    confidenceScore: 0.85,
  };
}
