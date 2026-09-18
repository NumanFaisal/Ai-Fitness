import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { endpoints } from "@/api/endpoints";
import { GymReminderModal } from "@/components/GymReminderModal";
import type { NutritionPlanToday, WaterStatus, WorkoutDay, UserReminders, TargetBodyBlueprint } from "@/types/models";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "@/navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Dashboard">;

export function DashboardScreen({ navigation }: Props) {
  const { colors, isDark, toggleTheme } = useTheme();
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
    try {
      const storedChecklist = await AsyncStorage.getItem(`checklist_${todayKey}`);
      if (storedChecklist) {
        const parsed = JSON.parse(storedChecklist);
        setChecklistCount(Object.values(parsed).filter(Boolean).length);
      }
      const storedReminders = await AsyncStorage.getItem("user_gym_reminders");
      if (storedReminders) setReminders(JSON.parse(storedReminders));
    } catch {}

    const [w, n, h2o, rem, bp] = await Promise.allSettled([
      endpoints.getTodayWorkout(),
      endpoints.getTodayNutrition(),
      endpoints.getWaterStatus(),
      endpoints.getReminders(),
      endpoints.getTargetBodyBlueprint(),
    ]);

    let loadedWorkout = w.status === "fulfilled" ? w.value : null;
    let loadedNutrition = n.status === "fulfilled" ? n.value : null;

    if (!loadedWorkout && !loadedNutrition) {
      try {
        await endpoints.generatePlan();
        const [wRetry, nRetry] = await Promise.allSettled([
          endpoints.getTodayWorkout(),
          endpoints.getTodayNutrition(),
        ]);
        if (wRetry.status === "fulfilled") loadedWorkout = wRetry.value;
        if (nRetry.status === "fulfilled") loadedNutrition = nRetry.value;
      } catch {}
    }

    setWorkout(loadedWorkout);
    setNutrition(loadedNutrition);
    setWater(h2o.status === "fulfilled" ? h2o.value : null);
    if (rem.status === "fulfilled" && rem.value) setReminders(rem.value);
    if (bp.status === "fulfilled" && bp.value) setBlueprint(bp.value);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const gymTimeDisplay = reminders?.gymTime || "06:00 PM";

  // Theme-derived colors inline
  const habitPct = (checklistCount / 5) * 100;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Today</Text>
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{dateStr}</Text>
        </View>
        {/* Dark/Light Toggle */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeToggle, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
        </TouchableOpacity>
      </View>

      {/* Target Physique Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Profile")}>
        <GlassCard strong style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>TARGET PHYSIQUE</Text>
            <Text style={[styles.cardAction, { color: colors.accent }]}>View →</Text>
          </View>
          <Text style={[styles.cardBodyText, { color: colors.textSecondary }]} numberOfLines={2}>
            {blueprint?.targetPhysique.targetDescription || "Personalized hypertrophy and lean mass transformation protocol."}
          </Text>
          <View style={[styles.statsRow, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statMeta, { color: colors.textTertiary }]}>Current</Text>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{blueprint?.currentStats.weightKg || 75}<Text style={[styles.statUnit, { color: colors.textSecondary }]}> kg</Text></Text>
            </View>
            <Text style={[styles.statArrow, { color: colors.textTertiary }]}>→</Text>
            <View style={styles.statItem}>
              <Text style={[styles.statMeta, { color: colors.textTertiary }]}>Target</Text>
              <Text style={[styles.statNum, { color: colors.accent }]}>{blueprint?.targetPhysique.targetWeightKg || 79}<Text style={[styles.statUnit, { color: colors.textSecondary }]}> kg</Text></Text>
            </View>
            <View style={[styles.statItem, { alignItems: "flex-end" }]}>
              <Text style={[styles.statMeta, { color: colors.textTertiary }]}>Timeline</Text>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{blueprint?.targetPhysique.estimatedWeeks || 12}<Text style={[styles.statUnit, { color: colors.textSecondary }]}> wks</Text></Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>

      {/* Daily Checklist Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Progress" as never)}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>DAILY HABITS</Text>
            <Text style={[styles.cardAction, { color: colors.success }]}>{checklistCount} / 5</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.glassBackground }]}>
            <View style={[styles.progressFill, { width: `${habitPct}%` as any, backgroundColor: habitPct >= 100 ? colors.success : colors.accent }]} />
          </View>
          <Text style={[styles.cardBodyText, { color: colors.textSecondary }]}>Tap to check off workout, meals, and water →</Text>
        </GlassCard>
      </TouchableOpacity>

      {/* Gym Session Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => setShowReminderModal(true)}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>GYM SESSION</Text>
            <Text style={[styles.cardAction, { color: colors.accent }]}>Adjust →</Text>
          </View>
          <Text style={[styles.bigNum, { color: colors.textPrimary }]}>{gymTimeDisplay}</Text>
        </GlassCard>
      </TouchableOpacity>

      {/* Training Session Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Workout")}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>TRAINING</Text>
            <Text style={[styles.cardAction, { color: colors.accent }]}>View week →</Text>
          </View>
          {workout ? (
            <View style={{ gap: 4 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{workout.focus}</Text>
              <Text style={[styles.cardBodyText, { color: colors.textSecondary }]}>{workout.exercises.length} exercises · Video form guides</Text>
            </View>
          ) : (
            <EmptyState title="Rest & recovery" description="No heavy training today. Mobility and recovery." actionLabel="Open workout" onAction={() => navigation.navigate("Workout")} />
          )}
        </GlassCard>
      </TouchableOpacity>

      {/* Nutrition Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Nutrition")}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>NUTRITION</Text>
            <Text style={[styles.cardAction, { color: colors.accent }]}>View meals →</Text>
          </View>
          {nutrition ? (
            <View style={{ gap: 4 }}>
              <Text style={[styles.bigNum, { color: colors.textPrimary }]}>
                {nutrition.calorieTarget.value} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal</Text>
                {"  "}
                <Text style={{ color: colors.accent }}>{nutrition.proteinTargetG.value}<Text style={[styles.statUnit, { color: colors.textSecondary }]}>g protein</Text></Text>
              </Text>
              <Text style={[styles.cardBodyText, { color: colors.textSecondary }]}>{nutrition.meals.length} meals planned with preparation steps</Text>
            </View>
          ) : (
            <EmptyState title="No nutrition plan yet" description="Meals will appear once your plan is generated." actionLabel="Open nutrition" onAction={() => navigation.navigate("Nutrition")} />
          )}
        </GlassCard>
      </TouchableOpacity>

      {/* Hydration Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("Water" as never)}>
        <GlassCard style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>HYDRATION</Text>
            <Text style={[styles.cardAction, { color: colors.accent }]}>Log water →</Text>
          </View>
          {water ? (
            <View style={{ gap: 4 }}>
              <Text style={[styles.bigNum, { color: colors.textPrimary }]}>
                {water.consumedMl} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>/ {water.targetMl} ml</Text>
              </Text>
              <Text style={[styles.cardBodyText, { color: colors.textSecondary }]}>
                {Math.round((water.consumedMl / water.targetMl) * 100)}% of daily target reached
              </Text>
            </View>
          ) : (
            <EmptyState title="Hydration" description="Log water throughout the day." actionLabel="Log water" onAction={() => navigation.navigate("Water" as never)} />
          )}
        </GlassCard>
      </TouchableOpacity>

      <GymReminderModal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSaved={(r) => setReminders(r)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 100,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  dateLabel: { fontSize: 15, letterSpacing: -0.2, marginTop: 2 },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    marginTop: 4,
  },
  card: { gap: 10 },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  cardAction: { fontSize: 13, fontWeight: "500" },
  cardTitle: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
  cardBodyText: { fontSize: 13, lineHeight: 18 },
  bigNum: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0.5,
  },
  statItem: { gap: 2 },
  statMeta: { fontSize: 11, fontWeight: "500" },
  statNum: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  statUnit: { fontSize: 13, fontWeight: "400" },
  statArrow: { fontSize: 16 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
