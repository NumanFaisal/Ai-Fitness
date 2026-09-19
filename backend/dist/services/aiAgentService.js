"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateConversation = getOrCreateConversation;
exports.getConversationHistory = getConversationHistory;
exports.executeFitnessAgent = executeFitnessAgent;
const db_1 = require("../db");
const hydrationEngine_1 = require("../engines/hydrationEngine");
const aiService_1 = require("./aiService");
const progressionService_1 = require("./progressionService");
const tdeeRecalibrationService_1 = require("./tdeeRecalibrationService");
const coachActionService_1 = require("./coachActionService");
const personalizationContextBuilder_1 = require("./personalizationContextBuilder");
/**
 * Retrieves or initializes the active coach conversation for a user.
 */
function getOrCreateConversation(userId, conversationId) {
    const userState = (0, db_1.getUserState)(userId);
    if (!userState.coachConversations) {
        userState.coachConversations = [];
    }
    const convos = userState.coachConversations;
    if (conversationId) {
        const existing = convos.find((c) => c.id === conversationId);
        if (existing)
            return existing;
    }
    // Pick the most recent conversation or create a new one
    if (convos.length > 0 && !conversationId) {
        return convos[convos.length - 1];
    }
    const newConvo = {
        id: conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        title: "AI Fitness Coach Session",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    convos.push(newConvo);
    (0, db_1.saveUserState)(userId);
    return newConvo;
}
function getConversationHistory(userId, conversationId) {
    const userState = (0, db_1.getUserState)(userId);
    const convos = userState.coachConversations || [];
    return convos.find((c) => c.id === conversationId) || null;
}
/**
 * Executes autonomous fitness coach capabilities with deep personalization context,
 * intent analysis, deterministic safety/action pipeline, and conversational memory.
 */
async function executeFitnessAgent(userId, userMessage, conversationId) {
    const userState = (0, db_1.getUserState)(userId);
    const context = await personalizationContextBuilder_1.personalizationContextBuilder.buildContext(userId);
    const conversation = getOrCreateConversation(userId, conversationId);
    const lower = userMessage.toLowerCase().trim();
    const actions = [];
    // Vitals from authoritative context
    const currentWeight = context.profile.weightKg;
    const currentCalories = context.nutrition.authoritativeCalorieTarget;
    let activeCalories = currentCalories;
    const currentProtein = context.nutrition.authoritativeProteinTarget || context.nutrition.authoritativeProteinTargetG || 150;
    const hydration = (0, hydrationEngine_1.calculateHydration)({
        weightKg: currentWeight,
        sessionDurationMin: context.training.sessionDurationMin,
    });
    let waterConsumed = userState.waterLogs.reduce((acc, l) => acc + l.amountMl, 0);
    const todayDayOfWeek = new Date().getDay();
    const todayWorkout = userState.workoutPlan?.days?.find((d) => d.dayOfWeek === todayDayOfWeek) ||
        userState.workoutPlan?.days?.[0];
    const workoutFocus = todayWorkout?.focus || "Active Training";
    const userGoal = context.goal.type.replace(/_/g, " ");
    let replyText = "";
    // Record user message into memory
    conversation.messages.push({
        id: `msg_${Date.now()}_user`,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
    });
    // Keep memory to last 20 messages
    if (conversation.messages.length > 20) {
        conversation.messages = conversation.messages.slice(-20);
    }
    // --- 0. INTENT: Calorie Target Adjustment (e.g. "Reduce my daily calorie target by 179 kcal", "cut 200 calories", "set calorie target to 2400", "decrease calories by 150") ---
    const absCalMatch = lower.match(/(?:set|change|update|make)\s*(?:my\s*)?(?:daily\s*)?(?:calorie[s]?|cal|kcal|intake)?\s*(?:target\s*)?(?:to|at|is|=)\s*(\d{3,4})\s*(?:kcal|calories|cal)?/i);
    const reduceCalMatch = lower.match(/(?:reduce|decrease|cut|lower|drop|subtract|minus)\s*(?:my\s*)?(?:daily\s*)?(?:calorie[s]?|cal|kcal|intake)?\s*(?:target\s*)?(?:by\s*)?(\d+)/i) ||
        lower.match(/-(?:reduce\s*)?(\d+)\s*(?:kcal|calories|cal)?/i);
    const increaseCalMatch = lower.match(/(?:increase|add|raise|boost|bump|plus)\s*(?:my\s*)?(?:daily\s*)?(?:calorie[s]?|cal|kcal|intake)?\s*(?:target\s*)?(?:by\s*)?(\d+)/i) ||
        lower.match(/\+(?:increase\s*)?(\d+)\s*(?:kcal|calories|cal)?/i);
    if (!replyText && (absCalMatch || reduceCalMatch || increaseCalMatch)) {
        let deltaCalories = undefined;
        let newCalorieTarget = undefined;
        if (absCalMatch) {
            newCalorieTarget = parseInt(absCalMatch[1], 10);
        }
        else if (reduceCalMatch) {
            deltaCalories = -parseInt(reduceCalMatch[1], 10);
        }
        else if (increaseCalMatch) {
            deltaCalories = parseInt(increaseCalMatch[1], 10);
        }
        const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
            action: "ADJUST_CALORIE_TARGET",
            parameters: {
                deltaCalories,
                newCalorieTarget,
                reason: "User instruction via Coach Agent chat",
            },
        });
        if (actionResult.success) {
            actions.push({
                type: "ADJUST_CALORIE_TARGET",
                summary: actionResult.summary,
                badge: actionResult.badge,
                details: actionResult.details,
            });
            activeCalories = actionResult.details.newCalorieTarget;
            const prevCals = actionResult.details.previousCalories;
            const deltaVal = actionResult.details.delta;
            const signStr = deltaVal < 0 ? `reduced by ${Math.abs(deltaVal)} kcal` : `increased by ${deltaVal} kcal`;
            replyText = `Done! As your AI Coach, I have ${signStr} your daily calorie target from ${prevCals.toLocaleString()} kcal to ${activeCalories.toLocaleString()} kcal. I have automatically recalculated your meal portions, macro splits, and targets across your Today Dashboard, Nutrition Schedule, and Physique Blueprint.`;
        }
        else {
            replyText = actionResult.summary || "I was unable to adjust your calorie target. Please specify a value between 1,200 and 5,000 kcal.";
        }
    }
    // --- 1. INTENT: Progression Query (e.g. "I completed 80kg x 12", "what should I do next?", "did 100kg for 8") ---
    const perfMatch = lower.match(/(?:completed|did|lifted|benched|squatted|hit)\s*(\d+(?:\.\d+)?)\s*kg\s*(?:x|for|\*)\s*(\d+)/i);
    if (perfMatch) {
        const wt = parseFloat(perfMatch[1]);
        const reps = parseInt(perfMatch[2], 10);
        const rpeMatch = lower.match(/rpe\s*(\d+(?:\.\d+)?)/i);
        const rpe = rpeMatch ? parseFloat(rpeMatch[1]) : 8.0;
        // Log the exercise set
        const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
            action: "LOG_EXERCISE_SET",
            parameters: {
                exerciseSlug: todayWorkout?.exercises?.[0]?.exerciseSlug || "compound_exercise",
                setNumber: 1,
                reps,
                weightKg: wt,
                rpe,
            },
        });
        if (actionResult.success) {
            actions.push({
                type: "LOG_EXERCISE_SET",
                summary: actionResult.summary,
                badge: actionResult.badge,
                details: actionResult.details,
            });
        }
        // Evaluate progression using ProgressionService
        const progressionAdvice = progressionService_1.progressionService.evaluateSetProgression(todayWorkout?.exercises?.[0]?.exerciseSlug || "bench_press", wt, reps, { min: 8, max: 12 }, rpe);
        replyText = `Great work on hitting ${wt}kg × ${reps} reps${rpe ? ` at RPE ${rpe}` : ""}! Based on your progressive overload targets: ${progressionAdvice.recommendation}. Target for next session: ${progressionAdvice.nextPrescription}. Keep logging every set to maintain clean double progression.`;
    }
    // --- 2. INTENT: Replace/Swap Exercise (e.g. "Can I replace today's squat?", "swap deadlift", "replace bench") ---
    if (!replyText && (lower.includes("replace") || lower.includes("swap") || lower.includes("alternative")) && (lower.includes("squat") || lower.includes("bench") || lower.includes("deadlift") || lower.includes("press") || lower.includes("row") || lower.includes("curl") || lower.includes("exercise"))) {
        let targetExSlug = "";
        if (lower.includes("squat"))
            targetExSlug = "barbell_back_squat";
        else if (lower.includes("bench"))
            targetExSlug = "barbell_bench_press";
        else if (lower.includes("deadlift"))
            targetExSlug = "barbell_deadlift";
        else if (lower.includes("row"))
            targetExSlug = "barbell_bent_over_row";
        else if (lower.includes("overhead") || lower.includes("ohp"))
            targetExSlug = "overhead_press";
        else {
            targetExSlug = todayWorkout?.exercises?.[0]?.exerciseSlug || "barbell_back_squat";
        }
        const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
            action: "REPLACE_EXERCISE",
            parameters: {
                currentExerciseSlug: targetExSlug,
                reason: "User requested alternative",
            },
        });
        if (actionResult.success) {
            actions.push({
                type: "REPLACE_EXERCISE",
                summary: actionResult.summary,
                badge: actionResult.badge,
                details: actionResult.details,
            });
            replyText = `I've updated your workout! ${actionResult.summary}. The alternative matches your equipment (${context.training.equipmentAvailable.join(", ")}) and avoids your reported injury points.`;
        }
        else {
            replyText = actionResult.summary;
        }
    }
    // --- 3. INTENT: Workout Adjustment for Fatigue (e.g. "I'm very tired today. Adjust my workout", "low energy", "fatigued") ---
    if (!replyText && (lower.includes("tired") || lower.includes("fatigue") || lower.includes("exhausted") || lower.includes("sore") || lower.includes("low energy"))) {
        const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
            action: "ADJUST_TODAYS_WORKOUT",
            parameters: {
                fatigueLevel: "HIGH",
                targetRPECap: 7.0,
            },
        });
        if (actionResult.success) {
            actions.push({
                type: "ADJUST_TODAYS_WORKOUT",
                summary: actionResult.summary,
                badge: actionResult.badge,
                details: actionResult.details,
            });
            replyText = `Understood! I've dynamically adapted today's session to match your recovery state. Volume has been reduced (sets capped to 2, target RPE capped at 7.0) to stimulate muscle protein synthesis without overwhelming systemic CNS recovery. Focus on pristine form and rest up!`;
        }
    }
    // --- 4. INTENT: Log Water (e.g. "I drank 500ml water", "log 250ml", "had 1 liter") ---
    const waterMatch = lower.match(/(?:drank|log|had|consumed|add)\s*(\d+(?:\.\d+)?)\s*(ml|l|liter|liters|glass|glasses)?/i);
    if (!replyText && (waterMatch || (lower.includes("water") && (lower.includes("drank") || lower.includes("log") || lower.includes("glass"))))) {
        let ml = 250;
        if (waterMatch) {
            const val = parseFloat(waterMatch[1]);
            const unit = (waterMatch[2] || "ml").toLowerCase();
            if (unit.startsWith("l"))
                ml = Math.round(val * 1000);
            else if (unit.startsWith("glass"))
                ml = Math.round(val * 250);
            else
                ml = Math.round(val);
        }
        else if (lower.includes("bottle")) {
            ml = 500;
        }
        const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
            action: "LOG_WATER",
            parameters: { amountMl: ml },
        });
        if (actionResult.success) {
            waterConsumed += ml;
            actions.push({
                type: "LOG_WATER",
                summary: actionResult.summary,
                badge: actionResult.badge,
                details: actionResult.details,
            });
            const pct = Math.round((waterConsumed / hydration.targetMl) * 100);
            replyText = `Logged ${ml}ml of water into your tracker! You are now at ${waterConsumed.toLocaleString()}ml of your ${hydration.targetMl.toLocaleString()}ml daily target (${pct}% achieved). Staying hydrated maintains intracellular osmotic pressure and exercise capacity.`;
        }
    }
    // --- 5. INTENT: Log Body Weight (e.g. "I weigh 78kg now", "update weight to 76.5 kg") ---
    const weightMatch = lower.match(/(?:weigh|weight)\s*(?:is|now|to|at)?\s*(\d+(?:\.\d+)?)\s*kg/i);
    if (!replyText && weightMatch) {
        const newWt = parseFloat(weightMatch[1]);
        const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
            action: "LOG_WEIGHT",
            parameters: { weightKg: newWt },
        });
        if (actionResult.success) {
            actions.push({
                type: "LOG_WEIGHT",
                summary: actionResult.summary,
                badge: actionResult.badge,
                details: actionResult.details,
            });
            replyText = `Registered your weight of ${newWt.toFixed(1)} kg! ${actionResult.summary}`;
        }
    }
    // --- 6. INTENT: Weight Plateau / Calorie Question (e.g. "My weight hasn't changed for two weeks", "Why did my calories change?") ---
    if (!replyText && (lower.includes("weight hasn't changed") || lower.includes("plateau") || lower.includes("not losing weight") || lower.includes("stuck") || lower.includes("why did my calories change"))) {
        const recalResult = tdeeRecalibrationService_1.tdeeRecalibrationService.evaluateRecalibration(userId);
        if (recalResult.recalibrated) {
            replyText = `Based on your recent weight logs, your rolling 7-day weight trend (${recalResult.observedRateKgPerWeek.toFixed(2)} kg/week) diverged from the expected rate (${recalResult.expectedRateKgPerWeek.toFixed(2)} kg/week). Your daily target was adjusted from ${recalResult.previousCalorieTarget} kcal to ${recalResult.newCalorieTarget} kcal to break through the plateau safely while protecting muscle mass.`;
        }
        else {
            replyText = `I analyzed your rolling weight trend: your rate of change is currently ${recalResult.observedRateKgPerWeek.toFixed(2)} kg/week versus an expected ${recalResult.expectedRateKgPerWeek.toFixed(2)} kg/week. Day-to-day weight fluctuates by 1-2kg due to water retention, glycogen storage, and sodium. We evaluate trends over a minimum 7-day rolling window before adjusting calorie targets. Stick to your ${currentCalories} kcal plan!`;
        }
    }
    // --- 7. INTENT: Meal Advice / Swap / Dietary Preference (e.g. "What should I eat for dinner?", "I don't have chicken", "Give me a vegetarian alternative") ---
    if (!replyText && (lower.includes("dinner") || lower.includes("lunch") || lower.includes("breakfast") || lower.includes("eat") || lower.includes("chicken") || lower.includes("vegetarian"))) {
        let slot = "DINNER";
        if (lower.includes("breakfast"))
            slot = "BREAKFAST";
        else if (lower.includes("lunch"))
            slot = "LUNCH";
        else if (lower.includes("snack"))
            slot = "SNACK";
        let overrideDiet = undefined;
        if (lower.includes("vegetarian"))
            overrideDiet = "Vegetarian";
        else if (lower.includes("vegan"))
            overrideDiet = "Vegan";
        if (lower.includes("swap") || lower.includes("replace") || lower.includes("don't have") || lower.includes("alternative")) {
            const actionResult = await coachActionService_1.coachActionService.executeAction(userId, {
                action: "REPLACE_MEAL",
                parameters: {
                    mealSlot: slot,
                    dietaryPreferenceOverride: overrideDiet,
                    reason: lower.includes("chicken") ? "No chicken available" : "User requested alternative",
                },
            });
            if (actionResult.success) {
                actions.push({
                    type: "REPLACE_MEAL",
                    summary: actionResult.summary,
                    badge: actionResult.badge,
                    details: actionResult.details,
                });
                replyText = `I've updated your ${slot.toLowerCase()}! ${actionResult.summary}. All ingredients are calibrated to your macro targets and respect your allergy and dietary constraints.`;
            }
        }
        else {
            // Query current planned meal
            const plannedMeals = userState.aiMeals || [];
            const currentMeal = plannedMeals.find((m) => m.mealSlot === slot);
            if (currentMeal) {
                replyText = `For ${slot.toLowerCase()}, your personalized plan prescribes: **${currentMeal.recipeTitle}** (${currentMeal.calories} kcal, ${currentMeal.proteinG}g protein).\n\nIngredients:\n${(currentMeal.ingredients || []).map((i) => `• ${i}`).join("\n")}`;
            }
            else {
                replyText = `For ${slot.toLowerCase()}, aim for approximately ${Math.round(currentCalories / 4)} kcal and ${Math.round(currentProtein / 4)}g protein with lean proteins, fibrous veggies, and complex carbohydrates.`;
            }
        }
    }
    // --- 8. INTENT: "What should I do today?" / Today's Training Split ---
    if (!replyText && (lower.includes("what should i do today") || lower.includes("today's workout") || lower.includes("todays workout") || lower.includes("what workout"))) {
        if (todayWorkout) {
            const exList = todayWorkout.exercises.map((e) => `• ${e.exerciseName || e.name} (${e.sets} sets × ${e.repRangeLow}-${e.repRangeHigh} reps)`).join("\n");
            replyText = `Today's scheduled focus is **${todayWorkout.focus}**!\n\nHere is your routine:\n${exList}\n\nWarm up for 5-10 minutes, hit your target RPEs, and log your weights to track progressive overload!`;
        }
        else {
            replyText = `Today is scheduled as an active recovery day. Focus on hydration (target: ${hydration.targetMl}ml), light mobility, and hitting your daily protein target of ${currentProtein}g.`;
        }
    }
    // --- 9. Conversational Fallback via LLM with Full Context Snapshot ---
    if (!replyText) {
        const recentMessages = conversation.messages.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
        const coachAiReply = await (0, aiService_1.chatWithCoach)(userMessage, {
            name: context.profile.name,
            goal: userGoal,
            calorieTarget: currentCalories,
            proteinTarget: currentProtein,
            workoutFocus: workoutFocus,
            exercises: todayWorkout?.exercises?.map((e) => e.exerciseName || e.name || e) || [],
            injuries: context.safety.injuries,
        });
        replyText = (0, aiService_1.cleanCoachText)(coachAiReply);
    }
    const cleanedReply = (0, aiService_1.cleanCoachText)(replyText);
    // Record assistant response into memory
    conversation.messages.push({
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        content: cleanedReply,
        actionsExecuted: actions,
        timestamp: new Date().toISOString(),
    });
    conversation.updatedAt = new Date().toISOString();
    (0, db_1.saveUserState)(userId);
    return {
        role: "assistant",
        content: cleanedReply,
        actionsExecuted: actions,
        appVitals: {
            weightKg: currentWeight,
            calorieTarget: activeCalories,
            proteinTarget: currentProtein,
            waterConsumedMl: waterConsumed,
            waterTargetMl: hydration.targetMl,
            todayWorkoutFocus: workoutFocus,
            goal: userGoal,
        },
        conversationId: conversation.id,
        createdAt: new Date().toISOString(),
    };
}
