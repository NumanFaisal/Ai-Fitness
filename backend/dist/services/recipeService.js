"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeService = exports.RecipeService = void 0;
const db_1 = require("../db");
const foodCatalog_1 = require("../data/foodCatalog");
const foodService_1 = require("./foodService");
class RecipeService {
    /**
     * Retrieves all candidate recipes from Prisma or catalog
     */
    async getAllRecipes() {
        try {
            const dbRecipes = await db_1.prisma.recipe.findMany();
            if (dbRecipes && dbRecipes.length > 0) {
                return dbRecipes.map((r) => ({
                    id: r.id,
                    title: r.title,
                    mealSlot: "LUNCH",
                    dietaryCompatibility: ["omnivore"],
                    budgetTiers: [r.budgetTier],
                    allergens: [],
                    mainIngredients: [],
                    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map((ing) => ({
                        name: typeof ing === "string" ? ing : ing.name || "Healthy ingredient",
                        baseAmount: ing.amount || "1 serving",
                        allergens: [],
                    })),
                    instructions: r.steps || [],
                    youtubeSearch: `healthy ${r.title} recipe`,
                    baseCalories: 600,
                    baseProteinG: 40,
                }));
            }
        }
        catch {
            // Clean fallback if database table is unseeded
        }
        return foodCatalog_1.FOOD_RECIPES_CATALOG;
    }
    /**
     * Filters recipes strictly against dietary preferences, allergies, and disliked foods
     */
    filterSafeRecipes(recipes, criteria) {
        const { slot, dietaryPreference, allergies, dislikedFoods, budgetTier } = criteria;
        const dietLower = dietaryPreference.toLowerCase();
        const isVegan = dietLower.includes("vegan");
        const isVegetarian = isVegan || (dietLower.includes("veg") && !dietLower.includes("non"));
        const isPescatarian = dietLower.includes("pescatarian");
        const dislikes = dislikedFoods.map((d) => d.toLowerCase().trim()).filter(Boolean);
        return recipes.filter((recipe) => {
            if (recipe.mealSlot !== slot)
                return false;
            // 1. Dietary compatibility
            if (isVegan && !recipe.dietaryCompatibility.includes("vegan"))
                return false;
            if (isVegetarian && !recipe.dietaryCompatibility.includes("vegetarian") && !recipe.dietaryCompatibility.includes("vegan"))
                return false;
            if (isPescatarian && !recipe.dietaryCompatibility.includes("pescatarian") && !recipe.dietaryCompatibility.includes("vegetarian") && !recipe.dietaryCompatibility.includes("vegan"))
                return false;
            // 2. Allergen conflict check
            const recipeText = `${recipe.title} ${recipe.mainIngredients.join(" ")} ${recipe.ingredients.map((i) => i.name).join(" ")}`;
            const allergenCheck = foodService_1.foodService.hasAllergenConflict(recipeText, recipe.allergens, allergies);
            if (allergenCheck.hasConflict)
                return false;
            // 3. Disliked food check
            if (dislikes.some((d) => recipeText.toLowerCase().includes(d)))
                return false;
            return true;
        });
    }
}
exports.RecipeService = RecipeService;
exports.recipeService = new RecipeService();
