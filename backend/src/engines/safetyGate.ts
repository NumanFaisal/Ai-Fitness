export interface SafetyEvaluationInput {
  age: number;
  injuries: string[];
  physicalLimitations: string[];
  goal: string;
  targetDate?: string | null;
  startingWeightKg?: number;
  targetWeightKg?: number;
}

export interface SafetyEvaluationResult {
  isSafe: boolean;
  reasons: string[];
  recommendation: string;
  enforceConservativePlan: boolean;
}

const HIGH_RISK_KEYWORDS = [
  "heart",
  "cardiac",
  "spine",
  "spinal",
  "herniated disc",
  "surgery",
  "fracture",
  "torn acl",
  "torn rotator cuff",
  "concussion",
  "pregnant",
  "pregnancy",
  "eating disorder",
  "anorexia",
  "bulimia",
];

export function evaluateSafetyGate(input: SafetyEvaluationInput): SafetyEvaluationResult {
  const reasons: string[] = [];

  // 1. Age safety
  if (input.age < 16) {
    reasons.push("User is under 16 years of age. Adolescent training requires pediatric medical clearance.");
  }

  // 2. Check for high-risk injuries or medical conditions
  const combinedLimitations = [...input.injuries, ...input.physicalLimitations].map((item) =>
    item.toLowerCase().trim()
  );

  for (const item of combinedLimitations) {
    for (const keyword of HIGH_RISK_KEYWORDS) {
      if (item.includes(keyword)) {
        reasons.push(`Medical flag identified: "${item}". Professional clearance required.`);
        break;
      }
    }
  }

  // 3. Goal & Timeline feasibility check
  if (input.targetDate && input.startingWeightKg && input.targetWeightKg) {
    const targetTime = new Date(input.targetDate).getTime();
    const now = Date.now();
    const diffDays = Math.max(1, (targetTime - now) / (1000 * 60 * 60 * 24));
    const diffWeeks = diffDays / 7;

    const weightDiffKg = Math.abs(input.startingWeightKg - input.targetWeightKg);
    const ratePerWeekKg = weightDiffKg / diffWeeks;

    if (input.goal === "FAT_LOSS" && ratePerWeekKg > 1.25) {
      reasons.push(
        `Target fat loss rate of ${ratePerWeekKg.toFixed(2)} kg/week exceeds physiological safety threshold (max 1.0 - 1.2 kg/week).`
      );
    } else if (input.goal === "MUSCLE_GAIN" && ratePerWeekKg > 0.6) {
      reasons.push(
        `Target lean mass gain of ${ratePerWeekKg.toFixed(2)} kg/week exceeds natural muscle building rates.`
      );
    }
  }

  const isSafe = reasons.length === 0;

  return {
    isSafe,
    reasons,
    recommendation: isSafe
      ? "Standard evidence-based plan approved for generation."
      : "Safety gate triggered: Auto-generation redirected to a conservative low-impact baseline with a recommendation to consult a medical or physical therapy professional.",
    enforceConservativePlan: !isSafe,
  };
}
