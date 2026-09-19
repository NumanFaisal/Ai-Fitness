import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
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
  const { colors, isDark } = useTheme();
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
          } catch {}
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeDayWorkout =
    weeklyWorkout.find((d) => d.dayOfWeek === selectedDayOfWeek) ||
    (weeklyWorkout.length > 0 && selectedDayOfWeek === new Date().getDay() ? weeklyWorkout[0] : null);

  function toggleExerciseComplete(key: string) {
    setCompletedExercises((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const chipBg = isDark ? "rgba(44,44,46,0.75)" : "rgba(242,242,247,0.90)";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Workout</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Select any day to view your routine</Text>

      {/* Day Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {DAYS.map((d) => {
          const isSelected = selectedDayOfWeek === d.index;
          const hasWorkout = weeklyWorkout.some((w) => w.dayOfWeek === d.index);
          const isToday = new Date().getDay() === d.index;
          return (
            <TouchableOpacity
              key={d.label}
              activeOpacity={0.75}
              style={[
                styles.dayBtn,
                {
                  backgroundColor: isSelected ? colors.accent : chipBg,
                  borderColor: isSelected ? colors.accent : isToday ? colors.accent : colors.glassBorder,
                  borderWidth: isSelected ? 0 : isToday ? 1.5 : 0.5,
                },
              ]}
              onPress={() => setSelectedDayOfWeek(d.index)}
            >
              <Text style={[styles.dayLabel, { color: isSelected ? "#FFF" : colors.textSecondary }]}>{d.label}</Text>
              <View style={[styles.dayDot, { backgroundColor: hasWorkout ? (isSelected ? "#FFF" : colors.accent) : "transparent" }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 40 }} />
      ) : !activeDayWorkout || activeDayWorkout.exercises.length === 0 ? (
        <EmptyState title="Rest & Recovery" description="No heavy training today. Focus on hydration, mobility, and nutrition." />
      ) : (
        <>
          <GlassCard strong style={styles.bannerCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <View style={{ backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>AI DYNAMIC PLAN</Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "600" }}>Tailored from Body Scan & Goal</Text>
            </View>
            <Text style={[styles.focusTitle, { color: colors.textPrimary }]}>{activeDayWorkout.focus}</Text>
            <Text style={[styles.focusMeta, { color: colors.textSecondary }]}>
              {activeDayWorkout.exercises.length} exercises · Progressive Overload
            </Text>
          </GlassCard>

          {activeDayWorkout.exercises.map((ex, i) => {
            const key = `${activeDayWorkout.dayOfWeek}-${ex.exerciseSlug}-${i}`;
            const isDone = Boolean(completedExercises[key]);
            const visual = getExerciseVisual(ex.exerciseName, ex.exerciseSlug);
            const imageUri = ex.mediaUri && ex.mediaUri.startsWith("http") ? ex.mediaUri : visual.imageUri;
            const youtubeUrl = ex.youtubeUrl || visual.youtubeUrl;

            return (
              <GlassCard key={key} style={[styles.exCard, isDone && { opacity: 0.55 }]}>
                <View style={styles.exHeader}>
                  <View style={[styles.exThumb, { backgroundColor: colors.surfaceAlt }]}>
                    <Image source={{ uri: imageUri }} style={styles.exImg} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.exName, { color: colors.textPrimary }, isDone && styles.strikethrough]}>{ex.exerciseName}</Text>
                    <Text style={[styles.exMeta, { color: colors.textSecondary }]}>
                      {ex.sets} sets × {ex.repRangeLow}–{ex.repRangeHigh} reps · {ex.restSeconds}s rest
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {ex.rpeTarget ? (
                        <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
                          <Text style={[styles.badgeText, { color: colors.accent }]}>RPE {ex.rpeTarget}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.badge, { backgroundColor: colors.glassBackground }]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{visual.muscleGroup}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: isDone ? colors.success : colors.glassBackground, borderColor: isDone ? colors.success : colors.glassBorder }]}
                    onPress={() => toggleExerciseComplete(key)}
                  >
                    <Text style={[styles.doneBtnText, { color: isDone ? "#FFF" : colors.textSecondary }]}>{isDone ? "✓" : "Done"}</Text>
                  </TouchableOpacity>
                </View>

                {ex.progressionNote ? (
                  <View style={{ backgroundColor: colors.accentMuted, padding: 8, borderRadius: 6, marginTop: 4 }}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500", lineHeight: 17 }}>
                      💡 Coaching Cue: {ex.progressionNote}
                    </Text>
                  </View>
                ) : null}

                {ex.instructions ? (
                  <Text style={[styles.instructions, { color: colors.textSecondary, borderTopColor: colors.glassBorder }]}>{ex.instructions}</Text>
                ) : null}

                <TouchableOpacity
                  style={styles.ytBtn}
                  onPress={() => Linking.openURL(youtubeUrl).catch(() => {})}
                >
                  <Text style={[styles.ytText, { color: colors.accent }]}>▶ Watch Form Tutorial</Text>
                </TouchableOpacity>
              </GlassCard>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: Platform.OS === "ios" ? 60 : 48, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 15, letterSpacing: -0.2, marginTop: 2, marginBottom: 4 },
  dayRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  dayBtn: { width: 48, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4 },
  dayLabel: { fontSize: 12, fontWeight: "600" },
  dayDot: { width: 5, height: 5, borderRadius: 2.5 },
  bannerCard: { gap: 4 },
  focusTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  focusMeta: { fontSize: 13 },
  exCard: { gap: 10 },
  exHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  exThumb: { width: 72, height: 72, borderRadius: 12, overflow: "hidden" },
  exImg: { width: "100%", height: "100%" },
  exName: { fontSize: 16, fontWeight: "600", letterSpacing: -0.3 },
  strikethrough: { textDecorationLine: "line-through" },
  exMeta: { fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  doneBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 0.5, alignItems: "center" },
  doneBtnText: { fontSize: 13, fontWeight: "600" },
  instructions: { fontSize: 13, lineHeight: 19, paddingTop: 10, borderTopWidth: 0.5 },
  ytBtn: { paddingTop: 2 },
  ytText: { fontSize: 13, fontWeight: "500" },
});
