import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { EmptyState } from "@/components/EmptyState";
import { endpoints } from "@/api/endpoints";
import { getExerciseVisual } from "@/utils/exerciseVisuals";
import type { WorkoutDay, WorkoutExerciseItem } from "@/types/models";

const DAYS = [
  { index: 1, label: "Mon" },
  { index: 2, label: "Tue" },
  { index: 3, label: "Wed" },
  { index: 4, label: "Thu" },
  { index: 5, label: "Fri" },
  { index: 6, label: "Sat" },
  { index: 0, label: "Sun" },
];

export function WorkoutTodayScreen() {
  const [weeklyWorkout, setWeeklyWorkout] = useState<WorkoutDay[]>([]);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(new Date().getDay());
  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const week = await endpoints.getWeeklyWorkout();
      if (week && week.length > 0) {
        setWeeklyWorkout(week);
      } else {
        const today = await endpoints.getTodayWorkout();
        if (today) {
          setWeeklyWorkout([today]);
        } else {
          try {
            await endpoints.generatePlan();
            const retryWeek = await endpoints.getWeeklyWorkout();
            if (retryWeek && retryWeek.length > 0) setWeeklyWorkout(retryWeek);
          } catch {
            // Ignore
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find workout for selected day of week
  const activeDayWorkout =
    weeklyWorkout.find((d) => d.dayOfWeek === selectedDayOfWeek) ||
    (weeklyWorkout.length > 0 && selectedDayOfWeek === new Date().getDay() ? weeklyWorkout[0] : null);

  function toggleExerciseComplete(exerciseKey: string) {
    setCompletedExercises((prev) => ({
      ...prev,
      [exerciseKey]: !prev[exerciseKey],
    }));
  }

  function openYouTube(ex: WorkoutExerciseItem) {
    const url =
      ex.youtubeUrl ||
      `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.exerciseName)}+form`;
    Linking.openURL(url).catch((err) => console.warn("Failed to open YouTube:", err));
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 16 }}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Weekly Workout</Text>
          <Text style={styles.subtitle}>Select any day to view and practice your routine</Text>
        </View>
      </View>

      {/* 7-Day Week Selector Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelectorContainer}
      >
        {DAYS.map((d) => {
          const isSelected = selectedDayOfWeek === d.index;
          const hasWorkout = weeklyWorkout.some((w) => w.dayOfWeek === d.index);
          const isToday = new Date().getDay() === d.index;

          return (
            <TouchableOpacity
              key={d.label}
              activeOpacity={0.8}
              style={[
                styles.dayButton,
                isSelected && styles.dayButtonSelected,
                isToday && !isSelected && styles.dayButtonToday,
              ]}
              onPress={() => setSelectedDayOfWeek(d.index)}
            >
              <Text
                style={[
                  styles.dayButtonLabel,
                  isSelected && styles.dayButtonLabelSelected,
                ]}
              >
                {d.label}
              </Text>
              <View
                style={[
                  styles.dayDot,
                  hasWorkout ? styles.dayDotActive : styles.dayDotRest,
                  isSelected && styles.dayDotSelected,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 40 }} />
      ) : !activeDayWorkout || activeDayWorkout.exercises.length === 0 ? (
        <EmptyState
          title="Rest & Recovery Day"
          description="No heavy training scheduled for this day. Focus on hydration, mobility, and healthy nutrition."
        />
      ) : (
        <>
          {/* Day Overview Banner */}
          <View style={styles.dayBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.focusTitle}>{activeDayWorkout.focus}</Text>
              <Text style={styles.focusMeta}>
                {activeDayWorkout.exercises.length} structured exercises · Optimal Progressive Overload
              </Text>
            </View>
          </View>

          {/* Exercise Cards */}
          {activeDayWorkout.exercises.map((ex, i) => {
            const exerciseKey = `${activeDayWorkout.dayOfWeek}-${ex.exerciseSlug}-${i}`;
            const isDone = Boolean(completedExercises[exerciseKey]);
            const visual = getExerciseVisual(ex.exerciseName, ex.exerciseSlug);
            const imageUri = ex.mediaUri && ex.mediaUri.startsWith("http") ? ex.mediaUri : visual.imageUri;
            const youtubeUrl = ex.youtubeUrl || visual.youtubeUrl;

            return (
              <View
                key={exerciseKey}
                style={[styles.card, isDone && styles.cardCompleted]}
              >
                <View style={styles.cardHeader}>
                  {/* High Quality Exercise Demonstration Visual */}
                  <View style={styles.mediaContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.exerciseName, isDone && styles.textDone]}>
                      {ex.exerciseName}
                    </Text>
                    <Text style={styles.exerciseMeta}>
                      {ex.sets} sets × {ex.repRangeLow}-{ex.repRangeHigh} reps · rest {ex.restSeconds}s
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      {ex.rpeTarget ? (
                        <Text style={styles.rpeBadge}>RPE {ex.rpeTarget}</Text>
                      ) : null}
                      <Text style={styles.muscleBadge}>{visual.muscleGroup}</Text>
                    </View>
                  </View>

                  {/* Completion checkmark button */}
                  <TouchableOpacity
                    style={[styles.checkBtn, isDone && styles.checkBtnDone]}
                    onPress={() => toggleExerciseComplete(exerciseKey)}
                  >
                    <Text style={[styles.checkBtnText, isDone && styles.checkBtnTextDone]}>
                      {isDone ? "✓" : "Done"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Form Instructions */}
                {ex.instructions ? (
                  <Text style={styles.instructions}>{ex.instructions}</Text>
                ) : null}

                {/* YouTube Video Form Button */}
                <TouchableOpacity
                  style={styles.youtubeBtn}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(youtubeUrl).catch((err) => console.warn("Failed to open YouTube:", err))}
                >
                  <View style={styles.youtubeLogoBadge}>
                    <Text style={styles.youtubePlayIcon}>▶</Text>
                  </View>
                  <Text style={styles.youtubeBtnText}>Watch Form Tutorial on YouTube</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { gap: 4 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  daySelectorContainer: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
  },
  dayButton: {
    width: 48,
    height: 58,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayButtonToday: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  dayButtonLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  dayButtonLabelSelected: {
    color: colors.background,
    fontWeight: "800",
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dayDotActive: {
    backgroundColor: "#10B981", // green for training day
  },
  dayDotRest: {
    backgroundColor: colors.textMuted,
  },
  dayDotSelected: {
    backgroundColor: colors.background,
  },
  dayBanner: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  focusTitle: { ...typography.h2, color: colors.primary, fontSize: 18 },
  focusMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardCompleted: {
    opacity: 0.75,
    borderColor: "#10B981",
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  mediaContainer: {
    width: 74,
    height: 74,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  mediaImage: { width: "100%", height: "100%" },
  exerciseName: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  exerciseMeta: { color: colors.textSecondary, fontSize: 12 },
  rpeBadge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(212, 251, 52, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(212, 251, 52, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  muscleBadge: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  textDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  checkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkBtnDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  checkBtnTextDone: {
    color: colors.background,
    fontWeight: "800",
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  youtubeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DC2626", // YouTube red
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#DC2626",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  youtubeLogoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  youtubePlayIcon: {
    color: "#DC2626",
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 1,
  },
  youtubeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
