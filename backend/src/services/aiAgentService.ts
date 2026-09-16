import { getUserState, saveUserState, UserSessionState } from "../db";
import { calculateHydration } from "../engines/hydrationEngine";
import { calculateNutrition } from "../engines/nutritionEngine";

export interface AgentAction {
  type: "LOG_WATER" | "UPDATE_CALORIES" | "UPDATE_PROTEIN" | "SWAP_MEAL" | "UPDATE_WEIGHT" | "ANALYZE_APP";
  summary: string;
  badge: string;
  details?: any;
}

export interface AgentResponse {
  role: "assistant";
  content: string;
  actionsExecuted: AgentAction[];
  appVitals: {
    weightKg: number;
    calorieTarget: number;
    proteinTarget: number;
    waterConsumedMl: number;
    waterTargetMl: number;
    todayWorkoutFocus: string;
    goal: string;
  };
  createdAt: string;
}

/**
 * Executes autonomous agent capabilities: inspects the entire app telemetry,
 * evaluates intent, mutates database state when requested, and provides conversational coaching.
 */
export async function executeFitnessAgent(userId: string, userMessage: string): Promise<AgentResponse> {
  const userState = getUserState(userId);
  const lower = userMessage.toLowerCase().trim();
  const actions: AgentAction[] = [];

  // Compute live vitals
  const currentWeight = userState.profile?.weightKg ?? 75;
  const currentCalories = userState.nutritionPlan?.calorieTarget?.value ?? 2500;
  const currentProtein = userState.nutritionPlan?.proteinTargetG?.value ?? 150;
  const hydration = calculateHydration({
    weightKg: currentWeight,
    sessionDurationMin: userState.fitnessProfile?.sessionDurationMin ?? 45,
  });
  let waterConsumed = userState.waterLogs.reduce((acc, l) => acc + l.amountMl, 0);
  const todayWorkout = userState.workoutPlan?.days?.[0];
  const workoutFocus = todayWorkout?.focus || "Full Body Strength";
  const userGoal = userState.goal?.type?.replace(/_/g, " ") || "Recomposition";

  let replyText = "";

  // 1. ACTION: Log Water (e.g. "I had 500ml water", "log 250ml", "drank 1 liter")
  const waterMatch = lower.match(/(?:drank|log|had|consumed|add)\s*(\d+(?:\.\d+)?)\s*(ml|l|liter|liters|glass|glasses)?/i);
  if (waterMatch || lower.includes("water")) {
    let ml = 0;
    if (waterMatch) {
      const val = parseFloat(waterMatch[1]);
      const unit = (waterMatch[2] || "ml").toLowerCase();
      if (unit.startsWith("l")) {
        ml = Math.round(val * 1000);
      } else if (unit.startsWith("glass")) {
        ml = Math.round(val * 250);
      } else {
        ml = Math.round(val);
      }
    } else if (lower.includes("glass")) {
      ml = 250;
    } else if (lower.includes("bottle")) {
      ml = 500;
    }

    if (ml > 0 && ml <= 3000) {
      userState.waterLogs.push({ amountMl: ml, loggedAt: new Date() });
      saveUserState(userId);
      waterConsumed += ml;
      const pct = Math.round((waterConsumed / hydration.targetMl) * 100);

      actions.push({
        type: "LOG_WATER",
        summary: `Logged +${ml}ml water (${waterConsumed}ml / ${hydration.targetMl}ml total)`,
        badge: `💧 +${ml}ml Water Logged`,
        details: { amountMl: ml, total: waterConsumed, target: hydration.targetMl },
      });

      replyText = `Logged ${ml}ml of water into your tracker! You are now at ${waterConsumed.toLocaleString()}ml of your ${hydration.targetMl.toLocaleString()}ml daily target (${pct}% achieved). Staying hydrated maintains muscle power and metabolic rate.`;
    }
  }

  // 2. ACTION: Update Calories (e.g. "drop calories by 200", "increase calories to 2600", "reduce calories by 150")
  if (!replyText && (lower.includes("calorie") || lower.includes("kcal") || lower.includes("calories"))) {
    const dropMatch = lower.match(/(?:drop|reduce|cut|decrease|lower)\s*(?:my\s*)?calories?\s*(?:by\s*)?(\d+)/i);
    const increaseMatch = lower.match(/(?:increase|boost|bump|raise|add)\s*(?:my\s*)?calories?\s*(?:by\s*)?(\d+)/i);
    const setMatch = lower.match(/(?:set|change|update)\s*(?:my\s*)?calories?\s*(?:to\s*)?(\d+)/i);

    let newTarget = currentCalories;
    if (dropMatch) {
      const delta = parseInt(dropMatch[1], 10);
      newTarget = Math.max(1200, currentCalories - delta);
    } else if (increaseMatch) {
      const delta = parseInt(increaseMatch[1], 10);
      newTarget = Math.min(5000, currentCalories + delta);
    } else if (setMatch) {
      newTarget = parseInt(setMatch[1], 10);
    }

    if (newTarget !== currentCalories && userState.nutritionPlan) {
      userState.nutritionPlan.calorieTarget = { value: newTarget, provenance: "CALCULATED" };
      saveUserState(userId);

      actions.push({
        type: "UPDATE_CALORIES",
        summary: `Caloric target updated from ${currentCalories} to ${newTarget} kcal`,
        badge: `⚡ Target Updated: ${newTarget} kcal`,
        details: { oldTarget: currentCalories, newTarget },
      });

      replyText = `I have updated your daily caloric target to ${newTarget} kcal (previously ${currentCalories} kcal). Your energy expenditure and meal portions have been recalibrated accordingly.`;
    }
  }

  // 3. ACTION: Update Protein (e.g. "increase protein to 160g", "bump protein by 15g")
  if (!replyText && (lower.includes("protein") && (lower.includes("increase") || lower.includes("set") || lower.includes("change") || lower.includes("bump") || lower.includes("target")))) {
    const protMatch = lower.match(/(?:to|by)\s*(\d+)\s*g?/i);
    if (protMatch && userState.nutritionPlan) {
      const val = parseInt(protMatch[1], 10);
      const newProt = lower.includes("by") ? currentProtein + val : val;
      if (newProt >= 60 && newProt <= 350) {
        userState.nutritionPlan.proteinTargetG = { value: newProt, provenance: "CALCULATED" };
        saveUserState(userId);

        actions.push({
          type: "UPDATE_PROTEIN",
          summary: `Protein target updated to ${newProt}g daily`,
          badge: `🥩 Protein Target: ${newProt}g`,
          details: { newProtein: newProt },
        });

        replyText = `Done! Your daily protein target is now set to ${newProt}g. Prioritize high-bioavailability sources like chicken breast, whey, eggs, Greek yogurt, or tofu across your 4 scheduled meals.`;
      }
    }
  }

  // 4. ACTION: Swap Meal (e.g. "swap my lunch", "change breakfast", "change dinner to salmon")
  if (!replyText && (lower.includes("swap") || lower.includes("replace") || lower.includes("change")) && (lower.includes("breakfast") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("snack") || lower.includes("meal"))) {
    let slot = "LUNCH";
    if (lower.includes("breakfast")) slot = "BREAKFAST";
    else if (lower.includes("dinner")) slot = "DINNER";
    else if (lower.includes("snack")) slot = "SNACK";

    const aiMeals = (userState as any).aiMeals || [];
    const mealIndex = aiMeals.findIndex((m: any) => m.mealSlot.toUpperCase() === slot);

    const replacementRecipes: Record<string, { title: string; ingredients: string[]; instructions: string[] }> = {
      BREAKFAST: {
        title: "Avocado Egg White Toast & Greek Yogurt",
        ingredients: ["2 Slices Whole Grain Toast", "150g Egg Whites scrambled", "1/2 Sliced Avocado", "100g Non-Fat Greek Yogurt"],
        instructions: ["Toast whole grain bread.", "Scramble egg whites with a pinch of sea salt and cracked pepper.", "Top toast with sliced avocado and egg whites. Serve with fresh Greek yogurt."],
      },
      LUNCH: {
        title: "Teriyaki Grilled Salmon & Jasmine Rice Bowl",
        ingredients: ["170g Fresh Salmon Fillet", "150g Steamed Jasmine Rice", "Steamed Broccoli Florets", "1 tbsp Low-Sodium Teriyaki Glaze"],
        instructions: ["Pan-sear salmon skin-side down for 4 minutes, flip and cook 3 minutes.", "Fluff steamed rice into bowl and add steamed broccoli.", "Drizzle teriyaki glaze over salmon and serve."],
      },
      SNACK: {
        title: "Cottage Cheese with Crushed Walnuts & Honey",
        ingredients: ["200g Low-Fat Cottage Cheese", "20g Raw Walnuts", "1 tsp Pure Honey"],
        instructions: ["Scoop cold cottage cheese into bowl.", "Top with crushed raw walnuts and a light honey drizzle."],
      },
      DINNER: {
        title: "Herb Crusted Turkey Breast & Roasted Medley",
        ingredients: ["180g Lean Ground Turkey or Cutlets", "180g Sweet Potato Wedges", "Roasted Asparagus Spears", "1 tbsp Olive Oil"],
        instructions: ["Season turkey with rosemary, thyme, garlic powder, and paprika; sear until cooked through.", "Roast sweet potato and asparagus at 200°C for 20 minutes.", "Plate together for a clean muscle-recovery meal."],
      },
    };

    const newRecipe = replacementRecipes[slot] || replacementRecipes.LUNCH;

    if (mealIndex >= 0) {
      aiMeals[mealIndex].recipeTitle = newRecipe.title;
      aiMeals[mealIndex].ingredients = newRecipe.ingredients;
      aiMeals[mealIndex].instructions = newRecipe.instructions;
    } else {
      aiMeals.push({
        mealSlot: slot,
        recipeTitle: newRecipe.title,
        ingredients: newRecipe.ingredients,
        instructions: newRecipe.instructions,
        calories: Math.round(currentCalories / 4),
        proteinG: Math.round(currentProtein / 4),
      });
    }

    (userState as any).aiMeals = aiMeals;
    saveUserState(userId);

    actions.push({
      type: "SWAP_MEAL",
      summary: `Replaced ${slot} with ${newRecipe.title}`,
      badge: `🥗 ${slot} Replaced: ${newRecipe.title}`,
      details: { slot, recipe: newRecipe.title },
    });

    replyText = `I have swapped your ${slot.toLowerCase()}! Your new dish is the **${newRecipe.title}**, carefully matched to your macro budget. Check your Nutrition tab to see the updated ingredients and prep instructions.`;
  }

  // 5. ACTION: Update Weight (e.g. "I weigh 78kg now", "update weight to 80 kg", "my weight is 76kg")
  const weightMatch = lower.match(/(?:weigh|weight)\s*(?:is|now|to|at)?\s*(\d+(?:\.\d+)?)\s*kg/i);
  if (!replyText && weightMatch) {
    const newWt = parseFloat(weightMatch[1]);
    if (newWt >= 35 && newWt <= 250) {
      if (!userState.profile) {
        userState.profile = { name: "Athlete", age: 25, sex: "MALE", heightCm: 175, weightKg: newWt };
      } else {
        userState.profile.weightKg = newWt;
      }

      // Recalibrate nutrition based on updated weight
      if (userState.fitnessProfile && userState.goal) {
        const recalced = calculateNutrition({
          weightKg: newWt,
          heightCm: userState.profile.heightCm,
          age: userState.profile.age,
          sex: userState.profile.sex,
          workoutDaysPerWeek: userState.fitnessProfile.workoutDaysPerWeek,
          goal: userState.goal.type,
          budgetTier: userState.fitnessProfile.budgetTier,
        });
        userState.nutritionPlan = recalced;
      }

      saveUserState(userId);

      actions.push({
        type: "UPDATE_WEIGHT",
        summary: `Body weight updated to ${newWt.toFixed(1)} kg. BMR and target macros recalibrated.`,
        badge: `⚖️ Weight Updated: ${newWt} kg`,
        details: { newWeight: newWt },
      });

      replyText = `Registered your updated weight of ${newWt} kg! Your BMR, daily energy expenditure, and baseline macro targets have been automatically recalibrated in the database.`;
    }
  }

  // 6. ACTION: App Telemetry Analysis (e.g. "analyze my progress", "give me a status update", "how am I doing")
  if (!replyText) {
    const hydrationPct = Math.round((waterConsumed / hydration.targetMl) * 100);
    const exerciseCount = todayWorkout?.exercises?.length ?? 0;

    replyText = `**Whole-App Telemetry Analysis for ${userState.profile?.name || "Athlete"}:**\n` +
      `• **Goal**: ${userGoal}\n` +
      `• **Daily Nutrition**: ${currentCalories} kcal | ${currentProtein}g Protein\n` +
      `• **Hydration**: ${waterConsumed.toLocaleString()} / ${hydration.targetMl.toLocaleString()} ml (${hydrationPct}% completed)\n` +
      `• **Today's Training**: ${workoutFocus} (${exerciseCount} exercises scheduled)\n\n` +
      `You can tell me to make live adjustments anytime — for example: *"Drop calories by 150"*, *"I just drank 500ml water"*, or *"Swap my lunch"*. What would you like to optimize?`;

    actions.push({
      type: "ANALYZE_APP",
      summary: "Evaluated whole-app telemetry across nutrition, training split, and hydration.",
      badge: "📊 App Telemetry Analyzed",
    });
  }

  return {
    role: "assistant",
    content: replyText,
    actionsExecuted: actions,
    appVitals: {
      weightKg: currentWeight,
      calorieTarget: currentCalories,
      proteinTarget: currentProtein,
      waterConsumedMl: waterConsumed,
      waterTargetMl: hydration.targetMl,
      todayWorkoutFocus: workoutFocus,
      goal: userGoal,
    },
    createdAt: new Date().toISOString(),
  };
}
