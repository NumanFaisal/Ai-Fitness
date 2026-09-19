import { prisma } from "../db";
import { FOOD_RECIPES_CATALOG, CatalogRecipe } from "../data/foodCatalog";
import { foodService } from "./foodService";

export class RecipeService {
  /**
   * Retrieves all candidate recipes from Prisma or catalog
   */
  async getAllRecipes(): Promise<CatalogRecipe[]> {
    try {
      const dbRecipes = await prisma.recipe.findMany();
      if (dbRecipes && dbRecipes.length > 0) {
        return dbRecipes.map((r) => ({
          id: r.id,
          title: r.title,
          mealSlot: "LUNCH",
          dietaryCompatibility: ["omnivore"],
          budgetTiers: [r.budgetTier as any],
          allergens: [],
          mainIngredients: [],
          ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map((ing: any) => ({
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
    } catch {
      // Clean fallback if database table is unseeded
    }
    return FOOD_RECIPES_CATALOG;
  }

  /**
   * Filters recipes strictly against dietary preferences, allergies, and disliked foods
   */
  filterSafeRecipes(
    recipes: CatalogRecipe[],
    criteria: {
      slot: "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER";
      dietaryPreference: string;
      allergies: string[];
      dislikedFoods: string[];
      budgetTier: string;
    }
  ): CatalogRecipe[] {
    const { slot, dietaryPreference, allergies, dislikedFoods, budgetTier } = criteria;
    const dietLower = dietaryPreference.toLowerCase();
    const isVegan = dietLower.includes("vegan");
    const isVegetarian = isVegan || (dietLower.includes("veg") && !dietLower.includes("non"));
    const isPescatarian = dietLower.includes("pescatarian");
    const dislikes = dislikedFoods.map((d) => d.toLowerCase().trim()).filter(Boolean);

    return recipes.filter((recipe) => {
      if (recipe.mealSlot !== slot) return false;

      // 1. Dietary compatibility
      if (isVegan && !recipe.dietaryCompatibility.includes("vegan")) return false;
      if (isVegetarian && !recipe.dietaryCompatibility.includes("vegetarian") && !recipe.dietaryCompatibility.includes("vegan")) return false;
      if (isPescatarian && !recipe.dietaryCompatibility.includes("pescatarian") && !recipe.dietaryCompatibility.includes("vegetarian") && !recipe.dietaryCompatibility.includes("vegan")) return false;

      // 2. Allergen conflict check
      const recipeText = `${recipe.title} ${recipe.mainIngredients.join(" ")} ${recipe.ingredients.map((i) => i.name).join(" ")}`;
      const allergenCheck = foodService.hasAllergenConflict(recipeText, recipe.allergens, allergies);
      if (allergenCheck.hasConflict) return false;

      // 3. Disliked food check
      if (dislikes.some((d) => recipeText.toLowerCase().includes(d))) return false;

      return true;
    });
  }
}

export const recipeService = new RecipeService();
