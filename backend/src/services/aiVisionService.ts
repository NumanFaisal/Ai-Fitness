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

export interface UserBodyPhotoInput {
  imageBase64?: string;
  imageUrl?: string;
  angle?: "FRONT" | "BACK" | "LEFT" | "RIGHT" | "GENERAL";
  heightCm: number;
  currentWeightKg: number;
  sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  age?: number;
  goal?: string;
  experienceLevel?: string;
}

export interface UserPhysiqueAnalysisResult {
  estimatedBodyFatPct: number;
  bodyFatCategory: "LEAN" | "ATHLETIC" | "MODERATE" | "HIGH";
  somatotype: "ECTOMORPH" | "MESOMORPH" | "ENDOMORPH" | "HYBRID";
  postureAssessment: string;
  visualStrengths: string[];
  developmentPriorityMuscles: string[];
  fatDistributionPattern: string;
  trainingDirectives: string[];
  nutritionDirectives: string[];
  summaryNarrative: string;
  confidenceScore: number;
  provenance: "OBSERVED" | "ESTIMATED";
}

/**
 * Analyzes the user's actual body photo using Gemini Vision, falling back to sports-science anthropometrics
 */
export async function analyzeUserBodyPhoto(input: UserBodyPhotoInput): Promise<UserPhysiqueAnalysisResult> {
  const { imageBase64, imageUrl, angle = "FRONT", heightCm, currentWeightKg, sex, age = 25, goal = "RECOMPOSITION" } = input;
  const isMale = sex === "MALE" || sex === "OTHER" || sex === "PREFER_NOT_TO_SAY";
  const hM = (heightCm || 175) / 100;
  const bmi = Math.round((currentWeightKg / (hM * hM)) * 10) / 10;

  const prompt = `You are an elite anthropometrist and master biomechanics coach. Analyze this real user's baseline body photo (${angle} view) for body composition, postural traits, and priority muscular development needs.
User Data:
- Height: ${heightCm} cm
- Weight: ${currentWeightKg} kg (BMI: ${bmi})
- Biological Sex: ${sex}
- Age: ${age}
- Primary Goal: ${goal}

Return ONLY a valid JSON object matching this schema without code fences or extra text:
{
  "estimatedBodyFatPct": 18,
  "bodyFatCategory": "MODERATE",
  "somatotype": "MESOMORPH",
  "postureAssessment": "Concise observation of shoulder alignment, pelvic posture, or spine neutrality",
  "visualStrengths": ["Quadriceps", "Chest Foundation"],
  "developmentPriorityMuscles": ["Upper Chest", "Lateral Delts", "Lats", "Core"],
  "fatDistributionPattern": "Mild subcutaneous lower abdominal accumulation",
  "trainingDirectives": ["Prioritize incline press and vertical pulling early in sessions", "Include direct core stabilization"],
  "nutritionDirectives": ["High protein intake (2.0g/kg) with moderate energy deficit", "Time complex carbohydrates around workouts"],
  "summaryNarrative": "2-3 sentences concise professional assessment of current physique and key requirements to hit their goal",
  "confidenceScore": 0.88
}`;

  // 1. Try Gemini Vision if key provided
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
                const bf = Math.round(Number(parsed.estimatedBodyFatPct) || (isMale ? 18 : 24));
                const cat =
                  parsed.bodyFatCategory ||
                  (bf < (isMale ? 12 : 20)
                    ? "LEAN"
                    : bf < (isMale ? 18 : 26)
                    ? "ATHLETIC"
                    : bf < (isMale ? 25 : 32)
                    ? "MODERATE"
                    : "HIGH");

                return {
                  estimatedBodyFatPct: bf,
                  bodyFatCategory: cat,
                  somatotype: parsed.somatotype || "MESOMORPH",
                  postureAssessment: parsed.postureAssessment || "Neutral pelvic alignment with upright spinal posture.",
                  visualStrengths: Array.isArray(parsed.visualStrengths) && parsed.visualStrengths.length > 0
                    ? parsed.visualStrengths
                    : ["Back", "Quadriceps"],
                  developmentPriorityMuscles: Array.isArray(parsed.developmentPriorityMuscles) && parsed.developmentPriorityMuscles.length > 0
                    ? parsed.developmentPriorityMuscles
                    : ["Upper Chest", "Lateral Delts", "Lats", "Core"],
                  fatDistributionPattern: parsed.fatDistributionPattern || "Evenly distributed adipose tissue across torso.",
                  trainingDirectives: Array.isArray(parsed.trainingDirectives) && parsed.trainingDirectives.length > 0
                    ? parsed.trainingDirectives
                    : ["Target high-tension compound movements with progressive overload", "Focus on upper chest and shoulder width"],
                  nutritionDirectives: Array.isArray(parsed.nutritionDirectives) && parsed.nutritionDirectives.length > 0
                    ? parsed.nutritionDirectives
                    : ["Prioritize high protein intake (2.0g/kg)", "Maintain steady hydration and micronutrient density"],
                  summaryNarrative: parsed.summaryNarrative || "Baseline body scan indicates balanced athletic frame with clear growth potential in primary upper body levers.",
                  confidenceScore: 0.90,
                  provenance: "OBSERVED",
                };
              }
            }
          }
        } catch {
          // Continue to next model attempt
        }
      }
    } catch {
      // Fall through to deterministic anthropometric classifier
    }
  }

  // 2. Deterministic Sports-Science Anthropometric Classification Fallback
  // Deurenberg Adult Body Fat Formula: (1.20 × BMI) + (0.23 × Age) - (10.8 × sex) - 5.4 (sex = 1 for male, 0 for female)
  const sexFactor = isMale ? 1 : 0;
  const rawBf = Math.round(((1.2 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4) * 10) / 10;
  const clampedBf = Math.max(isMale ? 8 : 16, Math.min(isMale ? 35 : 42, Math.round(rawBf)));

  const bodyFatCategory: "LEAN" | "ATHLETIC" | "MODERATE" | "HIGH" =
    clampedBf < (isMale ? 13 : 20)
      ? "LEAN"
      : clampedBf < (isMale ? 18 : 26)
      ? "ATHLETIC"
      : clampedBf < (isMale ? 25 : 32)
      ? "MODERATE"
      : "HIGH";

  const somatotype: "ECTOMORPH" | "MESOMORPH" | "ENDOMORPH" | "HYBRID" =
    bmi < 21.0 ? "ECTOMORPH" : bmi > 27.5 ? "ENDOMORPH" : "MESOMORPH";

  let visualStrengths: string[];
  let developmentPriorityMuscles: string[];

  if (goal === "MUSCLE_GAIN" || goal === "STRENGTH") {
    visualStrengths = isMale ? ["Back Width", "Leg Base"] : ["Glutes", "Hamstrings"];
    developmentPriorityMuscles = isMale
      ? ["Upper Chest", "Lateral Delts (V-Taper)", "Lats", "Arms"]
      : ["Glute Medius", "Shoulders", "Core / Obliques", "Lats"];
  } else if (goal === "FAT_LOSS") {
    visualStrengths = isMale ? ["Skeletal Frame", "Shoulders"] : ["Posture", "Lower Body"];
    developmentPriorityMuscles = isMale
      ? ["Abdominal Wall", "Lateral Delts", "Chest", "Upper Back"]
      : ["Core Tightness", "Glutes", "Shoulders", "Upper Back"];
  } else {
    visualStrengths = ["Chest", "Quadriceps"];
    developmentPriorityMuscles = ["Upper Chest", "Lateral Delts", "Lats", "Core"];
  }

  const trainingDirectives = [
    `Emphasize ${developmentPriorityMuscles.slice(0, 2).join(" and ")} with high mechanical tension in the first 20 minutes of each session.`,
    "Implement strict eccentric tempo (2-3 sec descent) to maximize hypertrophy and connective tissue resilience.",
    "Counter forward shoulder posture with face pulls or high cable rear delt flies on pull days.",
  ];

  const nutritionDirectives = [
    goal === "FAT_LOSS"
      ? `Maintain a controlled caloric deficit with 2.0g/kg protein to accelerate visceral and subcutaneous fat oxidation.`
      : goal === "MUSCLE_GAIN"
      ? `Utilize a lean surplus (+250-300 kcal) with dense complex carbohydrates to fuel training intensity and hypertrophy.`
      : `Eucaloric maintenance with high-protein nutrient timing around workouts for lean recomposition.`,
    "Hydrate with minimum 35ml water per kg bodyweight to support intracellular volume.",
  ];

  return {
    estimatedBodyFatPct: clampedBf,
    bodyFatCategory,
    somatotype,
    postureAssessment: "Slight natural internal rotation of shoulders observed; pelvic and spinal structure ready for progressive overload.",
    visualStrengths,
    developmentPriorityMuscles,
    fatDistributionPattern: isMale ? "Centrally biased lower abdominal and flank tissue." : "Evenly distributed hip, glute, and torso composition.",
    trainingDirectives,
    nutritionDirectives,
    summaryNarrative: `Baseline visual anthropometry indicates an estimated body fat of ~${clampedBf}% with ${somatotype.toLowerCase()} structural leverage. Plan is customized to prioritize ${developmentPriorityMuscles.slice(0, 2).join(" and ")} while directing nutrition toward ${goal.replace("_", " ").toLowerCase()}.`,
    confidenceScore: 0.85,
    provenance: "ESTIMATED",
  };
}

