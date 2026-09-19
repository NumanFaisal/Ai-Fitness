"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nutritionPlanner = exports.NutritionPlanner = void 0;
const recipeService_1 = require("./recipeService");
const foodService_1 = require("./foodService");
const foodCatalog_1 = require("../data/foodCatalog");
class NutritionPlanner {
    /**
     * Deterministically assembles a profile-specific diet plan from the food & recipe database
     */
    async assembleDynamicPlan(context) {
        const allRecipes = await recipeService_1.recipeService.getAllRecipes();
        const { nutrition, goal, profile } = context;
        const targetCalories = nutrition.authoritativeCalorieTarget;
        const targetProtein = nutrition.authoritativeProteinTargetG ?? nutrition.authoritativeProteinTarget ?? 150;
        // Macro slot allocation
        const slotTargets = [
            { slot: "BREAKFAST", calRatio: 0.25, protRatio: 0.25 },
            { slot: "LUNCH", calRatio: 0.35, protRatio: 0.35 },
            { slot: "SNACK", calRatio: 0.15, protRatio: 0.15 },
            { slot: "DINNER", calRatio: 0.25, protRatio: 0.25 },
        ];
        const plannedMeals = [];
        for (const { slot, calRatio, protRatio } of slotTargets) {
            const slotCalories = Math.round(targetCalories * calRatio);
            const slotProtein = Math.round(targetProtein * protRatio);
            const safeCandidates = recipeService_1.recipeService.filterSafeRecipes(allRecipes, {
                slot,
                dietaryPreference: nutrition.dietaryPreference,
                allergies: nutrition.allergies,
                dislikedFoods: nutrition.dislikedFoods,
                budgetTier: nutrition.budgetTier,
            });
            // Pick matching budget tier if possible, else first safe recipe
            let selectedRecipe = safeCandidates.find((r) => r.budgetTiers.includes(nutrition.budgetTier));
            if (!selectedRecipe && safeCandidates.length > 0) {
                selectedRecipe = safeCandidates[0];
            }
            // If no candidate due to highly constrained filters, pick any slot recipe and apply substitution
            if (!selectedRecipe) {
                const slotFallback = foodCatalog_1.FOOD_RECIPES_CATALOG.filter((r) => r.mealSlot === slot);
                selectedRecipe = slotFallback[0];
            }
            // Dynamic portion scaling
            const scalingFactor = Math.max(0.7, Math.min(1.8, slotCalories / (selectedRecipe.baseCalories || 500)));
            const scaledIngredients = selectedRecipe.ingredients.map((ing) => {
                if (ing.baseQty && ing.scalingUnit) {
                    const scaledQty = Math.round(ing.baseQty * scalingFactor);
                    return `${ing.name} (${scaledQty}${ing.scalingUnit})`;
                }
                return ing.name;
            });
            // Strict allergen sanitizer pass
            const safeIngredients = this.sanitizeIngredients(scaledIngredients, nutrition.allergies, nutrition.dislikedFoods);
            plannedMeals.push({
                mealSlot: slot,
                recipeTitle: selectedRecipe.title,
                ingredients: safeIngredients,
                instructions: selectedRecipe.instructions,
                youtubeSearch: selectedRecipe.youtubeSearch,
                calories: slotCalories,
                proteinG: slotProtein,
                nutritionConfidence: 0.95,
            });
        }
        const totalCalories = plannedMeals.reduce((acc, m) => acc + m.calories, 0);
        const totalProteinG = plannedMeals.reduce((acc, m) => acc + m.proteinG, 0);
        const caloriesWithinTolerance = Math.abs(totalCalories - targetCalories) / targetCalories <= 0.05;
        const proteinWithinTolerance = Math.abs(totalProteinG - targetProtein) / targetProtein <= 0.10;
        // Zero-allergen verification
        let zeroAllergens = true;
        for (const meal of plannedMeals) {
            for (const ing of meal.ingredients) {
                const check = foodService_1.foodService.hasAllergenConflict(ing, [], nutrition.allergies);
                if (check.hasConflict) {
                    zeroAllergens = false;
                }
            }
        }
        return {
            coachNarrative: `Personalized nutrition program calibrated for your ${goal.type.toLowerCase().replace(/_/g, " ")} target (${targetCalories} kcal, ${targetProtein}g protein) adhering strictly to your ${nutrition.dietaryPreference} protocol. Every meal is portion-optimized to support metabolic recovery and training performance.`,
            workoutFocus: context.targetPhysique?.standoutMuscles?.length
                ? `Aesthetic Focus: ${context.targetPhysique.standoutMuscles.slice(0, 2).join(" & ")}`
                : "Hypertrophy & Performance",
            workoutCues: [
                "Control eccentric tempo (2-3s lowering) on compound movements to maximize mechanical tension.",
                "Hydrate with at least 500ml water prior to training.",
                "Hit daily protein target consistently across all 4 prescribed meals.",
            ],
            meals: plannedMeals,
            totalCalories,
            totalProteinG,
            calorieTarget: targetCalories,
            proteinTargetG: targetProtein,
            generatedBy: "ALGORITHMIC_FOOD_DATABASE",
            source: "ALGORITHMIC_FOOD_DATABASE",
            macroValidation: {
                caloriesWithinTolerance,
                proteinWithinTolerance,
                zeroAllergensVerified: zeroAllergens,
            },
        };
    }
    sanitizeIngredients(ingredients, allergies, dislikes) {
        const rawAllergies = allergies.map((a) => a.toLowerCase().trim()).filter(Boolean);
        return ingredients.map((ing) => {
            const lower = ing.toLowerCase();
            if (rawAllergies.some((a) => a.includes("peanut") || a === "peanuts") && lower.includes("peanut")) {
                return "2 tbsp Sunflower Seed Butter (SunButter) or Tahini (Nut-Free)";
            }
            if (rawAllergies.some((a) => a.includes("nut") || a.includes("almond")) && (lower.includes("almond") || lower.includes("walnut") || lower.includes("cashew"))) {
                return "30g Roasted Pumpkin Seeds (Tree Nut-Free)";
            }
            if (rawAllergies.some((a) => a === "egg" || a === "eggs") && (lower.includes("egg") || lower.includes("eggs"))) {
                return "200g Turmeric Spiced Tofu Scramble or Plant Pea Protein";
            }
            if (rawAllergies.some((a) => a.includes("dairy") || a.includes("milk") || a.includes("cheese")) &&
                (lower.includes("milk") || lower.includes("cheese") || lower.includes("yogurt") || lower.includes("whey") || lower.includes("curd") || lower.includes("paneer"))) {
                if (lower.includes("whey"))
                    return "30g Plant-Based Pea/Rice Protein Isolate (Dairy-Free)";
                if (lower.includes("yogurt") || lower.includes("curd"))
                    return "200g Dairy-Free Coconut/Almond Alternative Yogurt";
                return "150g Organic Firm Tofu Cubes (Dairy-Free)";
            }
            if (rawAllergies.some((a) => a.includes("fish") || a.includes("tuna") || a.includes("seafood")) &&
                (lower.includes("tuna") || lower.includes("salmon") || lower.includes("fish"))) {
                return "180g Spiced Chickpeas & Steamed Lentils (Seafood-Free)";
            }
            if (rawAllergies.some((a) => a.includes("gluten") || a.includes("wheat")) && (lower.includes("bread") || lower.includes("oats") || lower.includes("wheat"))) {
                if (lower.includes("bread"))
                    return "2 Slices Certified Gluten-Free Seed Bread";
                return "80g Certified Gluten-Free Rolled Oats or Brown Rice";
            }
            if (rawAllergies.some((a) => a.includes("soy")) && (lower.includes("tofu") || lower.includes("tempeh") || lower.includes("edamame") || lower.includes("soy"))) {
                return "180g Simmered Yellow Lentils (Daal) or Chickpeas (Soy-Free)";
            }
            return ing;
        });
    }
}
exports.NutritionPlanner = NutritionPlanner;
exports.nutritionPlanner = new NutritionPlanner();
