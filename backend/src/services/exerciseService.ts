import { prisma } from "../db";
import { EXERCISE_CATALOG, ExerciseCatalogItem } from "../data/exerciseCatalog";

export class ExerciseService {
  /**
   * Retrieves all available exercises from database or in-memory catalog
   */
  async getAllExercises(): Promise<ExerciseCatalogItem[]> {
    try {
      const dbExercises = await prisma.exercise.findMany({
        include: { media: true },
      });
      if (dbExercises && dbExercises.length > 0) {
        return dbExercises.map((e) => ({
          slug: e.slug,
          name: e.name,
          primaryMuscle: e.primaryMuscle,
          secondaryMuscles: e.secondaryMuscles,
          movementPattern: "ISOLATION",
          equipment: e.equipmentNeeded,
          equipmentNeeded: e.equipmentNeeded,
          difficulty: "INTERMEDIATE",
          compound: true,
          unilateral: false,
          stabilityDemand: "MODERATE",
          injuryConsiderations: [],
          contraindications: [],
          alternatives: [],
          instructions: e.instructions,
          media: {
            mediaType: (e.media?.mediaType as any) || "gif",
            storageKey: e.media?.storageKey || `exercises/${e.slug}.gif`,
            sourceLicense: "Open Catalog",
          },
        }));
      }
    } catch {
      // Fallback cleanly to in-memory catalog if DB table is unseeded
    }
    return EXERCISE_CATALOG;
  }

  /**
   * Retrieves compatible exercises matching user's equipment and injury constraints
   */
  getCompatibleExercises(
    exercises: ExerciseCatalogItem[],
    equipmentAvailable: string[],
    injuries: string[],
    isGym: boolean,
    prohibitedExercises: string[] = []
  ): ExerciseCatalogItem[] {
    const userEq = equipmentAvailable.map((e) => e.toLowerCase());
    const prohibitedSet = new Set(prohibitedExercises.map((p) => p.toLowerCase()));

    return exercises.filter((ex) => {
      if (prohibitedSet.has(ex.slug.toLowerCase())) return false;

      // Injury conflict check
      const conflictsWithInjury = injuries.some((inj) => {
        const lower = inj.toLowerCase();
        if (ex.injuryConsiderations?.some((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()))) return true;
        if (ex.contraindications?.some((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()))) return true;
        if (lower.includes("shoulder") && ex.primaryMuscle.toLowerCase().includes("shoulder")) return true;
        if (lower.includes("knee") && ["quadriceps", "hamstrings"].includes(ex.primaryMuscle.toLowerCase())) return true;
        if (lower.includes("back") && (ex.isHighAxialLoad || ex.secondaryMuscles.some((m) => m.toLowerCase().includes("back")))) return true;
        return false;
      });
      if (conflictsWithInjury) return false;

      if (isGym) return true;

      return ex.equipmentNeeded.some(
        (needed) => needed === "bodyweight" || userEq.includes(needed.toLowerCase())
      );
    });
  }

  /**
   * Retrieves a single exercise item by slug or name
   */
  getExerciseBySlug(slug: string): ExerciseCatalogItem | undefined {
    const lower = slug.toLowerCase().trim();
    return EXERCISE_CATALOG.find(
      (e) => e.slug.toLowerCase() === lower || e.name.toLowerCase() === lower
    );
  }

  /**
   * Retrieves safe alternatives for a specific exercise
   */
  getAlternatives(
    slug: string,
    options?: ExerciseCatalogItem[] | { equipmentAvailable: string[]; injuries: string[] }
  ): ExerciseCatalogItem[] {
    let pool: ExerciseCatalogItem[] = EXERCISE_CATALOG;

    if (Array.isArray(options)) {
      pool = options;
    } else if (options && typeof options === "object") {
      pool = this.getCompatibleExercises(
        EXERCISE_CATALOG,
        options.equipmentAvailable || ["barbell", "dumbbell", "bodyweight"],
        options.injuries || [],
        false
      );
    }

    const current = EXERCISE_CATALOG.find((e) => e.slug === slug);
    if (!current) return pool.slice(0, 3);

    // 1. Direct explicit alternatives
    const explicitSlugs = current.alternatives || [];
    const directAlts = pool.filter((e) => explicitSlugs.includes(e.slug));
    if (directAlts.length > 0) return directAlts;

    // 2. Matching primary muscle and movement pattern
    return pool.filter(
      (e) =>
        e.slug !== slug &&
        (e.primaryMuscle === current.primaryMuscle || e.movementPattern === current.movementPattern)
    );
  }
}

export const exerciseService = new ExerciseService();
