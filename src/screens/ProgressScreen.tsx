import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { endpoints } from "@/api/endpoints";
import { GymReminderModal } from "@/components/GymReminderModal";
import type { ProgressSnapshot } from "@/types/models";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DailyChecklist {
  workoutDone: boolean;
  breakfastDone: boolean;
  lunchDone: boolean;
  dinnerDone: boolean;
  waterDone: boolean;
}

const DEFAULT_CHECKLIST: DailyChecklist = {
  workoutDone: false,
  breakfastDone: false,
  lunchDone: false,
  dinnerDone: false,
  waterDone: false,
};

const TASK_DEFS: { key: keyof DailyChecklist; label: string; sub: string }[] = [
  { key: "workoutDone", label: "Programmed Workout", sub: "Full routine & sets completed" },
  { key: "breakfastDone", label: "Breakfast Nutrition", sub: "High-protein morning fuel" },
  { key: "lunchDone", label: "Lunch Nutrition", sub: "Balanced carbs and clean protein" },
  { key: "dinnerDone", label: "Dinner Recovery", sub: "Muscle repair and micronutrients" },
  { key: "waterDone", label: "Daily Hydration", sub: "Reached full daily water target" },
];

export function ProgressScreen() {
  const { colors, isDark } = useTheme();
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateKey, setSelectedDateKey] = useState(new Date().toISOString().split("T")[0]);
  const [checklist, setChecklist] = useState<DailyChecklist>(DEFAULT_CHECKLIST);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    return { key, dayName: DAYS_SHORT[d.getDay()], dateNum: d.getDate(), isToday: key === new Date().toISOString().split("T")[0] };
  });

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      const data = await endpoints.getProgressTimeline();
      setSnapshots(data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const loadChecklistForDate = useCallback(async (dateKey: string) => {
    try {
      const stored = await AsyncStorage.getItem(`checklist_${dateKey}`);
      setChecklist(stored ? JSON.parse(stored) : DEFAULT_CHECKLIST);
    } catch { setChecklist(DEFAULT_CHECKLIST); }
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);
  useEffect(() => { loadChecklistForDate(selectedDateKey); }, [selectedDateKey, loadChecklistForDate]);

  async function toggleCheckItem(key: keyof DailyChecklist) {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    try { await AsyncStorage.setItem(`checklist_${selectedDateKey}`, JSON.stringify(updated)); } catch {}
  }

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const percent = Math.round((completedCount / 5) * 100);

  const chipBg = isDark ? "rgba(44,44,46,0.75)" : "rgba(242,242,247,0.90)";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Progress</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Track your daily habits and review your protocol compliance</Text>

      {/* Date Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {recentDays.map((d) => {
          const isSelected = selectedDateKey === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              activeOpacity={0.75}
              style={[
                styles.dateChip,
                {
                  backgroundColor: isSelected ? colors.accent : chipBg,
                  borderColor: isSelected ? colors.accent : d.isToday ? colors.accent : colors.glassBorder,
                  borderWidth: isSelected ? 0 : d.isToday ? 1.5 : 0.5,
                },
              ]}
              onPress={() => setSelectedDateKey(d.key)}
            >
              <Text style={[styles.dateDayName, { color: isSelected ? "#FFF" : colors.textSecondary }]}>{d.dayName}</Text>
              <Text style={[styles.dateNum, { color: isSelected ? "#FFF" : colors.textPrimary }]}>{d.dateNum}</Text>
              {d.isToday && !isSelected && <Text style={[styles.todayDot, { color: colors.accent }]}>•</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Checklist Card */}
      <GlassCard strong style={styles.checkCard}>
        <View style={styles.checkHeader}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>DAILY CHECKLIST</Text>
          <Text style={[styles.scoreText, { color: percent >= 100 ? colors.success : colors.accent }]}>{completedCount}/5 · {percent}%</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.glassBackground }]}>
          <View style={[styles.progressFill, { width: `${percent}%` as any, backgroundColor: percent >= 100 ? colors.success : colors.accent }]} />
        </View>
        <View style={styles.tasks}>
          {TASK_DEFS.map((task) => {
            const done = checklist[task.key];
            return (
              <TouchableOpacity
                key={task.key}
                activeOpacity={0.75}
                style={[
                  styles.taskRow,
                  {
                    backgroundColor: done ? colors.successMuted : colors.glassBackground,
                    borderColor: done ? colors.success : colors.glassBorder,
                  },
                ]}
                onPress={() => toggleCheckItem(task.key)}
              >
                <View style={[styles.checkbox, { borderColor: done ? colors.success : colors.glassBorderStrong, backgroundColor: done ? colors.success : "transparent" }]}>
                  {done && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[styles.taskLabel, { color: colors.textPrimary }, done && styles.strikethrough]}>{task.label}</Text>
                  <Text style={[styles.taskSub, { color: colors.textSecondary }]}>{task.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassCard>

      {/* Schedule Reminder */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => setShowReminderModal(true)}>
        <GlassCard style={styles.reminderCard}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.reminderTitle, { color: colors.textPrimary }]}>Workout Schedule Alerts</Text>
            <Text style={[styles.reminderSub, { color: colors.textSecondary }]}>Set your gym time for daily reminders</Text>
          </View>
          <Text style={[styles.reminderAction, { color: colors.accent }]}>Configure →</Text>
        </GlassCard>
      </TouchableOpacity>

      {/* Narrative Cards */}
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        snapshots.map((snap, i) => (
          <GlassCard key={i} style={{ gap: 8 }}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>PROTOCOL ANALYSIS</Text>
            {snap.weightKg != null && (
              <Text style={[styles.weightNum, { color: colors.textPrimary }]}>{snap.weightKg} <Text style={{ fontSize: 16, fontWeight: "400", color: colors.textSecondary }}>kg recorded</Text></Text>
            )}
            <Text style={[styles.narrative, { color: colors.textSecondary }]}>
              {snap.aiNarrative || "Baseline initialized. Complete your daily targets to establish your progression trend."}
            </Text>
          </GlassCard>
        ))
      )}

      <GymReminderModal visible={showReminderModal} onClose={() => setShowReminderModal(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: Platform.OS === "ios" ? 60 : 48, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 14, letterSpacing: -0.2, marginTop: 2, marginBottom: 4 },
  dateRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  dateChip: { width: 48, paddingVertical: 10, borderRadius: 14, alignItems: "center", gap: 2 },
  dateDayName: { fontSize: 11, fontWeight: "600" },
  dateNum: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  todayDot: { fontSize: 14 },
  checkCard: { gap: 12 },
  checkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  scoreText: { fontSize: 14, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  tasks: { gap: 8 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12, borderWidth: 0.5 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkmark: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  taskLabel: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  strikethrough: { textDecorationLine: "line-through" },
  taskSub: { fontSize: 12 },
  reminderCard: { flexDirection: "row", alignItems: "center" },
  reminderTitle: { fontSize: 15, fontWeight: "600" },
  reminderSub: { fontSize: 12 },
  reminderAction: { fontSize: 14, fontWeight: "500" },
  weightNum: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  narrative: { fontSize: 14, lineHeight: 20 },
});
