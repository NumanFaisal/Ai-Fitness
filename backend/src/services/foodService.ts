export class FoodService {
  private static ALLERGEN_MAP: Record<string, string[]> = {
    peanuts: ["peanut", "peanuts", "groundnut", "peanut butter", "peanut oil", "peanut flour", "peanut sauce"],
    dairy: ["milk", "dairy", "cheese", "curd", "yogurt", "whey", "lactose", "paneer", "butter", "cream", "casein"],
    eggs: ["egg", "eggs", "albumin", "egg white", "egg yolk", "mayonnaise"],
    fish: ["fish", "tuna", "salmon", "cod", "tilapia", "seafood", "anchovy", "sardine", "mackerel"],
    shellfish: ["shellfish", "shrimp", "prawn", "crab", "lobster", "clam", "mussel", "oyster"],
    gluten: ["gluten", "wheat", "barley", "rye", "bread", "pasta", "flour"],
    tree_nuts: ["nut", "nuts", "almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia"],
    soy: ["soy", "soya", "tofu", "edamame", "tempeh", "soy milk", "soy sauce", "soy protein"],
  };

  /**
   * Normalizes a user allergen or food item to canonical allergen group tags
   */
  normalizeAllergen(raw: string): string[] {
    const lower = raw.toLowerCase().trim();
    const matched: string[] = [];

    for (const [canonical, aliases] of Object.entries(FoodService.ALLERGEN_MAP)) {
      if (aliases.some((alias) => lower.includes(alias) || alias.includes(lower))) {
        matched.push(canonical);
      }
    }

    if (matched.length === 0) {
      matched.push(lower);
    }
    return matched;
  }

  /**
   * Deterministically validates whether an ingredient or recipe contains any user allergens
   */
  hasAllergenConflict(
    itemText: string,
    tagsOrAllergies: string[],
    maybeAllergies?: string[]
  ): { hasConflict: boolean; conflictingAllergens: string[] } {
    const itemTags = maybeAllergies ? tagsOrAllergies : [];
    const userAllergies = maybeAllergies ? maybeAllergies : tagsOrAllergies;

    if (!userAllergies || userAllergies.length === 0) {
      return { hasConflict: false, conflictingAllergens: [] };
    }

    const textLower = itemText.toLowerCase();
    const itemTagSet = new Set(itemTags.map((t) => t.toLowerCase().trim()));
    const conflicting: string[] = [];

    for (const userAllergy of userAllergies) {
      const canonicalTags = this.normalizeAllergen(userAllergy);
      const userAllergyLower = userAllergy.toLowerCase().trim();

      // Check if ingredient explicitly states it is free of this allergen (e.g. "gluten-free", "dairy-free")
      const isExplicitlyFree =
        textLower.includes(`${userAllergyLower}-free`) ||
        textLower.includes(`${userAllergyLower} free`) ||
        canonicalTags.some(
          (c) => textLower.includes(`${c}-free`) || textLower.includes(`${c} free`)
        );

      if (isExplicitlyFree) {
        continue;
      }

      // 1. Direct substring match on ingredient text
      if (textLower.includes(userAllergyLower)) {
        conflicting.push(userAllergy);
        continue;
      }

      // 2. Alias match on text
      for (const canonical of canonicalTags) {
        const aliases = FoodService.ALLERGEN_MAP[canonical] || [canonical];
        if (aliases.some((alias) => textLower.includes(alias))) {
          conflicting.push(userAllergy);
          break;
        }

        // 3. Tag match
        if (itemTagSet.has(canonical) || itemTagSet.has(userAllergyLower)) {
          conflicting.push(userAllergy);
          break;
        }
      }
    }

    return {
      hasConflict: conflicting.length > 0,
      conflictingAllergens: Array.from(new Set(conflicting)),
    };
  }
}

export const foodService = new FoodService();
