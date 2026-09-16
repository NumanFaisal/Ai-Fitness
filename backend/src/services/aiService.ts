import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

export interface AIPersonalizedPlan {
  coachNarrative: string;
  workoutFocus: string;
  workoutCues: string[];
  meals: {
    mealSlot: string;
    recipeTitle: string;
    ingredients: string[];
    instructions: string[];
    youtubeSearch?: string;
    calories: number;
    proteinG: number;
  }[];
}

/**
 * Calls Groq (llama-3.3-70b-versatile) with fallback to Gemini or local heuristic
 */
let cachedGroqModel: string | null = null;
let cachedGeminiModel: string | null = null;
let groqDisabled = false;
let geminiDisabled = false;

async function getAvailableGroqModel(apiKey: string): Promise<string | null> {
  if (groqDisabled) return null;
  if (cachedGroqModel) return cachedGroqModel;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      const modelIds: string[] = (data.data || []).map((m: any) => m.id);
      console.log("[Groq] Models available for this key:", modelIds);
      const preferred = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama-3.1-70b-versatile",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "deepseek-r1-distill-llama-70b",
        "qwen-2.5-32b",
      ];
      for (const pref of preferred) {
        if (modelIds.includes(pref)) {
          cachedGroqModel = pref;
          return pref;
        }
      }
      const chat = modelIds.find((id) => !id.includes("whisper") && !id.includes("guard"));
      if (chat) {
        cachedGroqModel = chat;
        return chat;
      }
    } else {
      const errText = await res.text();
      console.warn("[Groq] API key lacks active model permissions or is invalid:", res.status, errText);
      groqDisabled = true;
    }
  } catch (err) {
    console.warn("[Groq] Models request failed (network or host unreachable):", err);
    groqDisabled = true;
  }
  return null;
}

async function getAvailableGeminiModel(apiKey: string): Promise<string | null> {
  if (geminiDisabled) return null;
  if (cachedGeminiModel) return cachedGeminiModel;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models: string[] = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => m.name.replace("models/", ""));
      console.log("[Gemini] Models available for this key:", models);
      if (models.length > 0) {
        const pref = models.find((m) => m.includes("flash")) || models[0];
        cachedGeminiModel = pref;
        return pref;
      }
    } else {
      geminiDisabled = true;
    }
  } catch (err) {
    geminiDisabled = true;
  }
  return null;
}

async function callLLM(systemPrompt: string, userPrompt: string, jsonFormat = false): Promise<string | null> {
  // 1. Try Groq (only if valid model discovered)
  if (!groqDisabled && GROQ_API_KEY && !GROQ_API_KEY.includes("your-groq-key")) {
    const cleanGroqKey = GROQ_API_KEY.replace(/['"]/g, "").trim();
    const activeModel = await getAvailableGroqModel(cleanGroqKey);

    if (activeModel) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanGroqKey}`,
          },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            ...(jsonFormat ? { response_format: { type: "json_object" } } : {}),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return content.trim();
        } else {
          const errText = await response.text();
          console.warn(`[Groq] (${activeModel}) status ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn(`[Groq] Request failed for ${activeModel}:`, err);
      }
    }
  }

  // 2. Try Gemini (only if valid AI Studio key and model available)
  if (!geminiDisabled && GEMINI_API_KEY && !GEMINI_API_KEY.includes("your-gemini-key")) {
    const cleanGeminiKey = GEMINI_API_KEY.replace(/['"]/g, "").trim();
    if (cleanGeminiKey.startsWith("AIzaSy")) {
      const activeGeminiModel = await getAvailableGeminiModel(cleanGeminiKey);
      if (activeGeminiModel) {
        const geminiUrls = [
          `https://generativelanguage.googleapis.com/v1beta/models/${activeGeminiModel}:generateContent?key=${cleanGeminiKey}`,
          `https://generativelanguage.googleapis.com/v1/models/${activeGeminiModel}:generateContent?key=${cleanGeminiKey}`,
        ];

        for (const geminiUrl of geminiUrls) {
          try {
            const response = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                  },
                ],
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) return text.trim();
            }
          } catch (err) {
            // Ignore and try fallback
          }
        }
      }
    }
  }

  return null;
}

export interface AIPlanUserContext {
  name: string;
  age: number;
  sex: string;
  goal: string;
  calorieTarget: number;
  proteinTarget: number;
  dietaryPreference: string;
  allergies: string[];
  dislikedFoods: string[];
  budgetTier: string;
  workoutFocus: string;
  exercises: string[];
  experienceLevel?: string;
  trainingEnvironment?: string;
  equipmentAvailable?: string[];
  injuries?: string[];
}

/**
 * Generates an AI-customized meal plan and coaching advice tailored to the user's specific data
 */
export async function generateAIPlanDetails(userContext: AIPlanUserContext): Promise<AIPersonalizedPlan | null> {
  const systemPrompt = `You are an elite certified strength & conditioning coach and sports dietitian, generating one day of a personalized plan.

SAFETY RULES (non-negotiable):
- You are not a doctor. Never diagnose, name a medical condition, or claim to treat one.
- Never prescribe an exercise that loads a reported injury or limitation — substitute or explicitly work around it, and say so in a cue.
- Only prescribe exercises the user's stated equipment can support.
- Never design an extreme calorie deficit/surplus, extreme volume, or anything that reads as a crash diet — targets are given to you below; do not override them.
- If something about the profile suggests professional guidance is warranted (e.g. a reported injury, a very aggressive goal), say so plainly in coachNarrative rather than working around it silently.

NUTRITION ACCURACY:
- Ground each meal's calories/protein in the actual ingredients and realistic portion sizes you list — do not invent numbers disconnected from the ingredients.
- These are still estimates, not lab measurements. Include "nutritionConfidence" (0-1) per meal reflecting how standard/well-documented the dish's nutrition profile is.
- Total calories across the 4 meals must be within 5% of ${userContext.calorieTarget} kcal. Total protein must be within 5% of ${userContext.proteinTarget}g.

VOICE:
- coachNarrative should be motivational but not absolute — reference the plan's rationale, not guaranteed outcomes ("this is designed to..." not "this will...").

OUTPUT FORMAT — return ONLY a single valid JSON object matching this exact schema. No markdown code fences, no prose before or after it, no trailing commas, no comments:

{
  "coachNarrative": "2-3 sentences: why this routine and these nutrition targets fit this profile, hedged not absolute",
  "workoutFocus": "Clear workout day title (e.g. Upper Body Strength, Lower Body Hypertrophy)",
  "workoutCues": ["Cue addressing form/progressive overload", "Cue addressing rest/tempo", "Cue addressing any reported injury/limitation, if applicable"],
  "meals": [
    {
      "mealSlot": "BREAKFAST",
      "recipeTitle": "Realistic recipe name tailored to preferences and budget",
      "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
      "instructions": ["Step 1: Prep description", "Step 2: Cook description"],
      "youtubeSearch": "healthy high protein breakfast recipe",
      "calories": 500,
      "proteinG": 35,
      "nutritionConfidence": 0.8
    },
    {
      "mealSlot": "LUNCH",
      "recipeTitle": "Realistic recipe name tailored to preferences and budget",
      "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
      "instructions": ["Step 1: Prep description", "Step 2: Cook description"],
      "youtubeSearch": "healthy chicken quinoa meal prep",
      "calories": 700,
      "proteinG": 45,
      "nutritionConfidence": 0.8
    },
    {
      "mealSlot": "SNACK",
      "recipeTitle": "High protein snack",
      "ingredients": ["ingredient 1 with amount"],
      "instructions": ["Step 1: Mix or serve"],
      "youtubeSearch": "quick high protein fitness snack",
      "calories": 300,
      "proteinG": 20,
      "nutritionConfidence": 0.85
    },
    {
      "mealSlot": "DINNER",
      "recipeTitle": "Realistic dinner tailored to preferences and budget",
      "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
      "instructions": ["Step 1: Prep description", "Step 2: Cook description"],
      "youtubeSearch": "healthy muscle building dinner recipe",
      "calories": 600,
      "proteinG": 40,
      "nutritionConfidence": 0.8
    }
  ]
}

CONSTRAINTS FOR THIS USER:
- Budget tier: ${userContext.budgetTier} — every ingredient must be realistic for this budget.
- Dietary preference: ${userContext.dietaryPreference}.
- Exclude disliked foods: ${userContext.dislikedFoods.join(", ") || "None"}.
- Never include allergens, even trace/derivative forms: ${userContext.allergies.join(", ") || "None"}.`;


  const userPrompt = `Generate day 1 of a personalized plan.

PROFILE
- Name: ${userContext.name}
- Primary goal: ${userContext.goal}
- Experience level: ${userContext.experienceLevel ?? "not specified"}
- Training environment: ${userContext.trainingEnvironment ?? "not specified"}
- Equipment available: ${userContext.equipmentAvailable?.join(", ") || "bodyweight only"}
- Reported injuries/limitations: ${userContext.injuries?.length ? userContext.injuries.join(", ") : "None reported"}

TARGETS
- Calorie target: ${userContext.calorieTarget} kcal
- Protein target: ${userContext.proteinTarget}g

TODAY'S WORKOUT
- Focus: ${userContext.workoutFocus}
- Exercises: ${userContext.exercises.join(", ")}

Write the coaching narrative and meal plan for this exact profile — do not generalize to a default user.`;

  const raw = await callLLM(systemPrompt, userPrompt, true);
  if (raw) {
    try {
      const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(clean) as AIPersonalizedPlan;
    } catch (parseErr) {
      console.warn("[AI Engine] Failed to parse LLM JSON. Activating sports-science engine.");
    }
  }

  console.log("[AI Engine] Generating personalized plan with sports-science calibrated engine.");

    const goalClean = userContext.goal.replace(/_/g, " ").toLowerCase();
    const breakfastCal = Math.round(userContext.calorieTarget * 0.25);
    const lunchCal = Math.round(userContext.calorieTarget * 0.35);
    const snackCal = Math.round(userContext.calorieTarget * 0.15);
    const dinnerCal = userContext.calorieTarget - (breakfastCal + lunchCal + snackCal);

    const breakfastProt = Math.round(userContext.proteinTarget * 0.25);
    const lunchProt = Math.round(userContext.proteinTarget * 0.35);
    const snackProt = Math.round(userContext.proteinTarget * 0.15);
    const dinnerProt = userContext.proteinTarget - (breakfastProt + lunchProt + snackProt);

    return {
      coachNarrative: `This program is calibrated for your ${goalClean} objective, targeting ${userContext.calorieTarget} kcal and ${userContext.proteinTarget}g protein. Focus on technical execution on today's ${userContext.workoutFocus} session and prioritize progressive overload with adequate recovery.`,
      workoutFocus: userContext.workoutFocus,
      workoutCues: [
        "Control the eccentric (lowering) phase for 2-3 seconds to maximize mechanical tension.",
        "Take full rest intervals between compound sets to maintain force output across all prescribed sets.",
        "Stop 1-2 reps shy of failure on compound lifts to maintain clean form and joint longevity.",
      ],
      meals: [
        {
          mealSlot: "BREAKFAST",
          recipeTitle: "High-Protein Power Oats & Egg Whites",
          ingredients: ["80g Rolled Oats", "1 Scoop Whey Protein", "3 Egg Whites", "1 Sliced Banana", "Handful of Berries"],
          instructions: [
            "Cook rolled oats in water or milk until creamy and thick.",
            "Remove from heat and vigorously stir in protein powder.",
            "Scramble egg whites separately and top oats with fresh banana and berries.",
          ],
          youtubeSearch: "healthy high protein oatmeal egg white breakfast",
          calories: breakfastCal,
          proteinG: breakfastProt,
        },
        {
          mealSlot: "LUNCH",
          recipeTitle: "Mediterranean Grilled Chicken & Quinoa Bowl",
          ingredients: ["180g Chicken Breast", "150g Cooked Quinoa", "Diced Cucumbers", "Cherry Tomatoes", "1 tbsp Extra Virgin Olive Oil"],
          instructions: [
            "Season chicken breast with oregano, garlic powder, salt, and black pepper; grill 6-7 mins per side.",
            "Fluff warm quinoa into a bowl.",
            "Toss with diced cucumbers, tomatoes, sliced chicken, and extra virgin olive oil.",
          ],
          youtubeSearch: "healthy chicken quinoa meal prep bowl",
          calories: lunchCal,
          proteinG: lunchProt,
        },
        {
          mealSlot: "SNACK",
          recipeTitle: "Greek Yogurt Parfait & Raw Almonds",
          ingredients: ["200g Non-Fat Greek Yogurt", "25g Raw Almonds", "1 tbsp Pure Honey or Mixed Berries"],
          instructions: [
            "Spoon rich Greek yogurt into a bowl.",
            "Top with whole raw almonds and a light drizzle of pure honey for clean sustained energy.",
          ],
          youtubeSearch: "high protein greek yogurt fitness snack",
          calories: snackCal,
          proteinG: snackProt,
        },
        {
          mealSlot: "DINNER",
          recipeTitle: "Lean Beef & Roasted Sweet Potato Power Plate",
          ingredients: ["170g Lean Ground Beef (93/7) or Turkey", "200g Roasted Sweet Potato Cubes", "Steamed Broccoli & Green Beans"],
          instructions: [
            "Brown lean meat in a skillet with smoked paprika, garlic, and sea salt.",
            "Roast sweet potato cubes in the oven at 200°C (400°F) for 25 minutes until tender.",
            "Steam fresh broccoli florets and plate with the seasoned lean meat and sweet potato.",
          ],
          youtubeSearch: "lean beef sweet potato muscle building dinner",
          calories: dinnerCal,
          proteinG: dinnerProt,
        },
      ],
    };
}

/**
 * Real-time Conversational AI Coach
 */
export async function askAICoach(
  userContext: {
    name?: string;
    goal?: string;
    calorieTarget?: number;
    proteinTarget?: number;
    workoutFocus?: string;
    exercises?: string[];
    injuries?: string[];
  },
  userMessage: string,
  history: { role: string; content: string }[] = []
): Promise<string> {
  const lower = userMessage.toLowerCase();

  // Safety Gate: Medical & Severe Pain Escalation Guardrail
  if (
    lower.includes("hurt") ||
    lower.includes("pain") ||
    lower.includes("injured") ||
    lower.includes("sharp") ||
    lower.includes("torn") ||
    lower.includes("doctor")
  ) {
    return "I hear you, and your safety is the absolute top priority. Because I am an AI coach and cannot provide medical diagnosis, please pause this exercise immediately. If the discomfort or pain persists, consult a qualified physical therapist or sports medicine physician.";
  }

  const systemPrompt = `You are a warm, knowledgeable, supportive personal fitness & nutrition AI coach.
You are coaching ${userContext.name || "the user"}, whose primary goal is ${userContext.goal || "fitness progression"}.
Active Plan Context:
- Daily Calorie Target: ${userContext.calorieTarget ? `${userContext.calorieTarget} kcal` : "Being calculated"}
- Daily Protein Target: ${userContext.proteinTarget ? `${userContext.proteinTarget}g` : "Being calculated"}
- Today's Training Focus: ${userContext.workoutFocus || "Full Body"}
- Today's Exercises: ${userContext.exercises?.join(", ") || "Compound and accessory movements"}
- Known Injuries/Limitations: ${userContext.injuries?.join(", ") || "None noted"}

GUIDELINES:
1. Always ground your responses in their actual plan details above.
2. If they ask about exercise substitutions, suggest alternatives that work the same muscles with their available equipment.
3. If they ask about food swaps, recommend ingredients that match their calories and protein.
4. If they have short time (e.g. 30 min), tell them which of their exercises to prioritize and reduce rest.
5. Keep your tone encouraging, concise, actionable, and friendly (2-4 sentences max). Never sound robotic.`;

  const reply = await callLLM(systemPrompt, userMessage);
  if (reply) return reply;

  // Fallback response grounded in data if AI call fails
    const goal = userContext.goal?.replace("_", " ").toLowerCase() ?? "fitness";
    if (lower.includes("time") || lower.includes("short") || lower.includes("busy")) {
      return `When short on time, prioritize the first 2 multi-joint compound movements in today's ${userContext.workoutFocus || "routine"}. Keep rest periods to 60 seconds to maintain maximum training intensity!`;
    }
    if (lower.includes("protein") || lower.includes("food") || lower.includes("eat") || lower.includes("substitute")) {
      return `For your ${goal} target, stick to high-quality protein sources like chicken, eggs, Greek yogurt, lentils, or tofu to hit your ${userContext.proteinTarget || 140}g target today!`;
    }
    return `I'm here to guide your ${goal} journey. Your current plan is calibrated for steady progression. What would you like to tweak or focus on today?`;
}
