import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { EmptyState } from "@/components/EmptyState";
import { endpoints } from "@/api/endpoints";
import { GymReminderModal } from "@/components/GymReminderModal";
import type { NutritionPlanToday, WaterStatus, WorkoutDay, UserReminders, TargetBodyBlueprint } from "@/types/models";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "@/navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Dashboard">;

export function DashboardScreen({ navigation }: Props) {
  const [workout, setWorkout] = useState<WorkoutDay | null>(null);
  const [nutrition, setNutrition] = useState<NutritionPlanToday | null>(null);
  const [water, setWater] = useState<WaterStatus | null>(null);
  const [reminders, setReminders] = useState<UserReminders | null>(null);
  const [blueprint, setBlueprint] = useState<TargetBodyBlueprint | null>(null);
  const [checklistCount, setChecklistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const todayKey = new Date().toISOString().split("T")[0];

    // Load saved checklist for today
    try {
      const storedChecklist = await AsyncStorage.getItem(`checklist_${todayKey}`);
      if (storedChecklist) {
        const parsed = JSON.parse(storedChecklist);
        setChecklistCount(Object.values(parsed).filter(Boolean).length);
      }
      const storedReminders = await AsyncStorage.getItem("user_gym_reminders");
      if (storedReminders) {
        setReminders(JSON.parse(storedReminders));
      }
    } catch {
      // Ignored
    }

    const [w, n, h2o, rem, bp] = await Promise.allSettled([
      endpoints.getTodayWorkout(),
      endpoints.getTodayNutrition(),
      endpoints.getWaterStatus(),
      endpoints.getReminders(),
      endpoints.getTargetBodyBlueprint(),
    ]);

    let loadedWorkout = w.status === "fulfilled" ? w.value : null;
    let loadedNutrition = n.status === "fulfilled" ? n.value : null;

    // If both are null, attempt auto-generation once
    if (!loadedWorkout && !loadedNutrition) {
      try {
        await endpoints.generatePlan();
        const [wRetry, nRetry] = await Promise.allSettled([
          endpoints.getTodayWorkout(),
          endpoints.getTodayNutrition(),
        ]);
        if (wRetry.status === "fulfilled") loadedWorkout = wRetry.value;
        if (nRetry.status === "fulfilled") loadedNutrition = nRetry.value;
      } catch {
        // Fallback
      }
    }

    setWorkout(loadedWorkout);
    setNutrition(loadedNutrition);
    setWater(h2o.status === "fulfilled" ? h2o.value : null);
    if (rem.status === "fulfilled" && rem.value) {
      setReminders(rem.value);
    }
    if (bp.status === "fulfilled" && bp.value) {
      setBlueprint(bp.value);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const gymTimeDisplay = reminders?.gymTime || "06:00 PM";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Today's Routine</Text>
        <Text style={styles.subtitle}>Your personalized weekly training, nutrition & target physique</Text>
      </View>

      {/* Target Body Blueprint Hero Card */}
      <TouchableOpacity
        style={styles.targetBodyBanner}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("Profile")}
      >
        <View style={styles.targetBodyHeader}>
          <View style={styles.targetBodyBadge}>
            <Text style={styles.targetBodyBadgeText}>
              {blueprint?.targetPhysique.goalType.replace("_", " ") || "TARGET PHYSIQUE"}
            </Text>
          </View>
          <Text style={styles.targetBodyAction}>View Roadmap ➔</Text>
        </View>

        <Text style={styles.targetBodyDesc}>
          {blueprint?.targetPhysique.targetDescription ||
            "Personalized hypertrophy & lean mass transformation plan."}
        </Text>

        <View style={styles.targetBodyStatsRow}>
          <View>
            <Text style={styles.targetBodyStatLabel}>Current</Text>
            <Text style={styles.targetBodyStatVal}>
              {blueprint?.currentStats.weightKg || 75} kg
            </Text>
          </View>
          <Text style={styles.targetBodyArrow}>➔</Text>
          <View>
            <Text style={styles.targetBodyStatLabel}>Target Physique</Text>
            <Text style={[styles.targetBodyStatVal, { color: colors.primary }]}>
              {blueprint?.targetPhysique.targetWeightKg || 79} kg
            </Text>
          </View>
          <View>
            <Text style={styles.targetBodyStatLabel}>Timeline</Text>
            <Text style={styles.targetBodyStatValSmall}>
              {blueprint?.targetPhysique.estimatedWeeks || 12} Weeks
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Gym Schedule Alert Banner */}
      <TouchableOpacity
        style={styles.gymBanner}
        activeOpacity={0.8}
        onPress={() => setShowReminderModal(true)}
      >
        <View style={styles.gymBannerIcon}>
          <View style={styles.clockRing}>
            <View style={styles.clockHandH} />
            <View style={styles.clockHandM} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.gymBannerTitle}>Gym Session: {gymTimeDisplay}</Text>
          <Text style={styles.gymBannerSub}>Daily workout scheduled · Tap to adjust</Text>
        </View>
        <Text style={styles.gymBannerEdit}>Edit</Text>
      </TouchableOpacity>

      {/* Daily Habits Checklist Card */}
      <TouchableOpacity
        style={styles.habitsCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("Progress")}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.habitsTitle}>Daily Habit Checklist</Text>
          <Text style={styles.habitsScore}>{checklistCount} / 5 Done</Text>
        </View>
        <View style={styles.habitsBarBg}>
          <View style={[styles.habitsBarFill, { width: `${(checklistCount / 5) * 100}%` }]} />
        </View>
        <Text style={styles.habitsSub}>Tap to tick off your workout, meals, and hydration ➔</Text>
      </TouchableOpacity>

      {/* Workout Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={() => navigation.navigate("Workout")}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeading}>Workout Plan</Text>
          <Text style={styles.cardAction}>View Week ➔</Text>
        </View>
        {workout ? (
          <View style={styles.cardContent}>
            <Text style={styles.cardHighlight}>{workout.focus}</Text>
            <Text style={styles.cardBody}>
              {workout.exercises.length} exercises scheduled with video form guides
            </Text>
          </View>
        ) : (
          <EmptyState
            title="Rest & Recovery"
            description="No workout scheduled for today. Check your full 7-day plan."
            actionLabel="Open workout tab"
            onAction={() => navigation.navigate("Workout")}
          />
        )}
      </TouchableOpacity>

      {/* Nutrition Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={() => navigation.navigate("Nutrition")}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeading}>Nutrition & Recipes</Text>
          <Text style={styles.cardAction}>View Recipes ➔</Text>
        </View>
        {nutrition ? (
          <View style={styles.cardContent}>
            <Text style={styles.cardHighlight}>
              {nutrition.calorieTarget.value} kcal · {nutrition.proteinTargetG.value}g Protein
            </Text>
            <Text style={styles.cardBody}>
              {nutrition.meals.length} meals planned with recipes & YouTube cooking links
            </Text>
          </View>
        ) : (
          <EmptyState
            title="No nutrition plan yet"
            description="Today's diet and recipes will show up once generated."
            actionLabel="Open nutrition tab"
            onAction={() => navigation.navigate("Nutrition")}
          />
        )}
      </TouchableOpacity>

      {/* Water Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={() => navigation.navigate("Water")}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeading}>Water Hydration</Text>
          <Text style={styles.cardAction}>Log Water ➔</Text>
        </View>
        {water ? (
          <View style={styles.cardContent}>
            <Text style={styles.cardHighlightWater}>
              {water.consumedMl} / {water.targetMl} ml
            </Text>
            <Text style={styles.cardBody}>
              {Math.round((water.consumedMl / water.targetMl) * 100)}% of today's target achieved
            </Text>
          </View>
        ) : (
          <EmptyState
            title="Hydration target"
            description="Log water and stay hydrated throughout the day."
            actionLabel="Log water"
            onAction={() => navigation.navigate("Water")}
          />
        )}
      </TouchableOpacity>

      <GymReminderModal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSaved={(newReminders) => setReminders(newReminders)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { gap: 4 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  gymBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gymBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  clockRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  clockHandH: {
    position: "absolute",
    width: 2,
    height: 6,
    backgroundColor: colors.primary,
    top: 5,
    borderRadius: 1,
  },
  clockHandM: {
    position: "absolute",
    width: 6,
    height: 2,
    backgroundColor: colors.primary,
    left: 9,
    borderRadius: 1,
  },
  gymBannerTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  gymBannerSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  gymBannerEdit: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  habitsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  habitsTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  habitsScore: { color: "#10B981", fontWeight: "700", fontSize: 14 },
  habitsBarBg: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: "hidden" },
  habitsBarFill: { height: "100%", backgroundColor: "#10B981", borderRadius: 4 },
  habitsSub: { color: colors.textSecondary, fontSize: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeading: { ...typography.h2, fontSize: 16, color: colors.textPrimary },
  cardAction: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  cardContent: { gap: 4 },
  cardHighlight: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  cardHighlightWater: { color: "#38BDF8", fontSize: 18, fontWeight: "700" },
  cardBody: { color: colors.textSecondary, fontSize: 13 },
  targetBodyBanner: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  targetBodyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  targetBodyBadge: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  targetBodyBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  targetBodyAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  targetBodyDesc: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  targetBodyStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetBodyStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  targetBodyStatVal: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  targetBodyStatValSmall: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  targetBodyArrow: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 15,
  },
});
