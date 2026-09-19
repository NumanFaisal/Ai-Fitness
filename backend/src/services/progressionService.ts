import { prisma, getUserState, saveUserState } from "../db";
import {
  evaluateExerciseProgression,
  ProgressionAdjustment,
  CompletedSetLog,
  ExercisePrescriptionInput,
} from "../engines/progressionEngine";
import { PlannedWorkoutDay, PlannedExerciseItem, WorkoutPlanOutput } from "../engines/workoutEngine";

export interface PeriodizationCycle {
  cycleId: string;
  currentWeek: number;
  totalWeeks: number;
  phase: "ADAPTATION" | "PROGRESSIVE_OVERLOAD" | "INTENSIFICATION" | "ACTIVE_DELOAD";
  volumeModifier: number;
  intensityRpeTarget: number;
  description: string;
}

export class ProgressionService {
  private userWeeks: Map<string, number> = new Map();

  /**
   * Advances a user's mesocycle week (1 to 4)
   */
  advanceMesocycleWeek(userId: string): number {
    const current = this.getCurrentMesocycleWeek(userId);
    const next = (current % 4) + 1;
    this.userWeeks.set(userId, next);
    return next;
  }

  getCurrentMesocycleWeek(userId: string): number {
    return this.userWeeks.get(userId) || 1;
  }

  /**
   * Evaluates a single set's performance against target rep range and RPE
   */
  evaluateSetProgression(
    exerciseSlug: string,
    weightKg: number,
    reps: number,
    repRange: { min: number; max: number },
    rpe: number = 8.0
  ): ProgressionAdjustment {
    const prescription: ExercisePrescriptionInput = {
      exerciseSlug,
      sets: 3,
      repRangeLow: repRange.min,
      repRangeHigh: repRange.max,
      rpeTarget: 8.0,
      currentWeightKg: weightKg,
    };

    const recentLogs: CompletedSetLog[] = [
      {
        setNumber: 1,
        reps,
        weightKg,
        rpe,
        completedAt: new Date(),
      },
    ];

    return evaluateExerciseProgression(prescription, recentLogs);
  }

  /**
   * Evaluates current periodization phase based on week number and adherence
   */
  getPeriodizationCycle(weekNumber: number, goal: string, conservativeMode: boolean): PeriodizationCycle {
    if (conservativeMode) {
      return {
        cycleId: `cycle_safe_${weekNumber}`,
        currentWeek: weekNumber,
        totalWeeks: 8,
        phase: "ADAPTATION",
        volumeModifier: 0.75,
        intensityRpeTarget: 7.0,
        description: "Joint-friendly baseline adaptation focusing on movement control and stability.",
      };
    }

    const modWeek = ((weekNumber - 1) % 4) + 1;

    switch (modWeek) {
      case 1:
        return {
          cycleId: `cycle_week_${weekNumber}`,
          currentWeek: weekNumber,
          totalWeeks: 12,
          phase: "ADAPTATION",
          volumeModifier: 0.9,
          intensityRpeTarget: 7.5,
          description: "Mesocycle Introduction: Establish baseline loads, motor patterns, and clean tempo.",
        };
      case 2:
        return {
          cycleId: `cycle_week_${weekNumber}`,
          currentWeek: weekNumber,
          totalWeeks: 12,
          phase: "PROGRESSIVE_OVERLOAD",
          volumeModifier: 1.0,
          intensityRpeTarget: 8.0,
          description: "Volume Accumulation: Drive progressive volume and metabolic tension.",
        };
      case 3:
        return {
          cycleId: `cycle_week_${weekNumber}`,
          currentWeek: weekNumber,
          totalWeeks: 12,
          phase: "INTENSIFICATION",
          volumeModifier: 1.05,
          intensityRpeTarget: 8.5,
          description: "Intensification: Peak overload loads near top of prescribed rep ranges.",
        };
      case 4:
      default:
        return {
          cycleId: `cycle_week_${weekNumber}`,
          currentWeek: weekNumber,
          totalWeeks: 12,
          phase: "ACTIVE_DELOAD",
          volumeModifier: 0.65,
          intensityRpeTarget: 6.5,
          description: "Deload & Active Dissipation: Reduce neurological stress to facilitate connective tissue remodeling.",
        };
    }
  }

  /**
   * Applies progression and periodization to a user's workout plan
   */
  applyProgressionToWorkout(userId: string, workout: WorkoutPlanOutput): WorkoutPlanOutput & { periodization?: PeriodizationCycle } {
    const currentWeek = this.getCurrentMesocycleWeek(userId);
    const userState = getUserState(userId);
    const goal = userState.goal?.type || "GENERAL_FITNESS";
    const conservative = !userState.fitnessProfile?.injuries || userState.fitnessProfile.injuries.length > 0;

    const cycle = this.getPeriodizationCycle(currentWeek, goal, conservative);

    const updatedDays = workout.days.map((day: PlannedWorkoutDay) => ({
      ...day,
      exercises: day.exercises.map((ex: PlannedExerciseItem) => {
        const adjustedSets = Math.max(2, Math.round(ex.sets * cycle.volumeModifier));
        const adjustedRpe = Math.min(ex.rpeTarget || 8.0, cycle.intensityRpeTarget);
        return {
          ...ex,
          sets: adjustedSets,
          rpeTarget: adjustedRpe,
          progressionNote: `[${cycle.phase}] Week ${cycle.currentWeek}: Target ${adjustedSets} sets @ RPE ${adjustedRpe}.`,
        };
      }),
    }));

    return {
      ...workout,
      days: updatedDays,
      periodization: cycle,
    };
  }

  /**
   * Retrieves recent exercise set logs for a user from Prisma or memory
   */
  async getRecentExerciseLogs(userId: string): Promise<Record<string, CompletedSetLog[]>> {
    const logsByExercise: Record<string, CompletedSetLog[]> = {};

    try {
      const recentSessions = await prisma.workoutSession.findMany({
        where: { userId },
        orderBy: { completedAt: "desc" },
        take: 5,
        include: {
          sets: {
            include: { exercise: true },
          },
        },
      });

      for (const session of recentSessions) {
        for (const s of session.sets) {
          const slug = s.exercise.slug;
          if (!logsByExercise[slug]) {
            logsByExercise[slug] = [];
          }
          logsByExercise[slug].push({
            setNumber: s.setNumber,
            reps: s.reps,
            weightKg: s.weightKg || 0,
            rpe: s.rpe || 8.0,
            completedAt: s.completedAt,
          });
        }
      }
    } catch {
      // Memory fallback
    }

    return logsByExercise;
  }
}

export const progressionService = new ProgressionService();
