import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
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

export function ProgressScreen() {
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateKey, setSelectedDateKey] = useState(new Date().toISOString().split("T")[0]);
  const [checklist, setChecklist] = useState<DailyChecklist>(DEFAULT_CHECKLIST);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Generate last 7 days for the date selector strip
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    return {
      key,
      dayName: DAYS_SHORT[d.getDay()],
      dateNum: d.getDate(),
      isToday: key === new Date().toISOString().split("T")[0],
    };
  });

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      const data = await endpoints.getProgressTimeline();
      setSnapshots(data || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChecklistForDate = useCallback(async (dateKey: string) => {
    try {
      const stored = await AsyncStorage.getItem(`checklist_${dateKey}`);
      if (stored) {
        setChecklist(JSON.parse(stored));
      } else {
        setChecklist(DEFAULT_CHECKLIST);
      }
    } catch {
      setChecklist(DEFAULT_CHECKLIST);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    loadChecklistForDate(selectedDateKey);
  }, [selectedDateKey, loadChecklistForDate]);

  async function toggleCheckItem(key: keyof DailyChecklist) {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    try {
      await AsyncStorage.setItem(`checklist_${selectedDateKey}`, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to persist checklist item:", err);
    }
  }

  // Calculate completion percentage
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalTasks = 5;
  const percent = Math.round((completedCount / totalTasks) * 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 18 }}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Daily Progress & Habits</Text>
          <Text style={styles.subtitle}>Tick off your workout, meals, and hydration targets daily</Text>
        </View>
      </View>

      {/* 7-Day Date Selector Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {recentDays.map((d) => {
          const isSelected = selectedDateKey === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              activeOpacity={0.8}
              style={[
                styles.dateCard,
                isSelected && styles.dateCardSelected,
                d.isToday && !isSelected && styles.dateCardToday,
              ]}
              onPress={() => setSelectedDateKey(d.key)}
            >
              <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>{d.dayName}</Text>
              <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>{d.dateNum}</Text>
              {d.isToday && <Text style={styles.todayIndicator}>TODAY</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Daily Checklist Card */}
      <View style={styles.checklistCard}>
        <View style={styles.checklistCardHeader}>
          <Text style={styles.checklistTitle}>Checklist for {selectedDateKey}</Text>
          <Text style={styles.checklistScore}>
            {completedCount}/{totalTasks} ({percent}%)
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
        </View>

        {/* Tasks Checklist */}
        <View style={styles.tasksContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.taskItem, checklist.workoutDone && styles.taskItemDone]}
            onPress={() => toggleCheckItem("workoutDone")}
          >
            <View style={[styles.checkbox, checklist.workoutDone && styles.checkboxChecked]}>
              {checklist.workoutDone && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskLabel, checklist.workoutDone && styles.taskLabelDone]}>
                Programmed Workout Session
              </Text>
              <Text style={styles.taskSub}>Full routine & sets completed</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.taskItem, checklist.breakfastDone && styles.taskItemDone]}
            onPress={() => toggleCheckItem("breakfastDone")}
          >
            <View style={[styles.checkbox, checklist.breakfastDone && styles.checkboxChecked]}>
              {checklist.breakfastDone && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskLabel, checklist.breakfastDone && styles.taskLabelDone]}>
                Breakfast Nutrition Target
              </Text>
              <Text style={styles.taskSub}>High-protein morning fuel</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.taskItem, checklist.lunchDone && styles.taskItemDone]}
            onPress={() => toggleCheckItem("lunchDone")}
          >
            <View style={[styles.checkbox, checklist.lunchDone && styles.checkboxChecked]}>
              {checklist.lunchDone && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskLabel, checklist.lunchDone && styles.taskLabelDone]}>
                Lunch Nutrition Target
              </Text>
              <Text style={styles.taskSub}>Balanced carbs and clean protein</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.taskItem, checklist.dinnerDone && styles.taskItemDone]}
            onPress={() => toggleCheckItem("dinnerDone")}
          >
            <View style={[styles.checkbox, checklist.dinnerDone && styles.checkboxChecked]}>
              {checklist.dinnerDone && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskLabel, checklist.dinnerDone && styles.taskLabelDone]}>
                Dinner Recovery Target
              </Text>
              <Text style={styles.taskSub}>Muscle repair and micronutrients</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.taskItem, checklist.waterDone && styles.taskItemDone]}
            onPress={() => toggleCheckItem("waterDone")}
          >
            <View style={[styles.checkbox, checklist.waterDone && styles.checkboxChecked]}>
              {checklist.waterDone && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskLabel, checklist.waterDone && styles.taskLabelDone]}>
                Daily Hydration Volume
              </Text>
              <Text style={styles.taskSub}>Reached full daily water recommendation</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gym Reminders Trigger Card */}
      <TouchableOpacity
        style={styles.gymReminderCard}
        activeOpacity={0.8}
        onPress={() => setShowReminderModal(true)}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.gymReminderTitle}>Workout Schedule Alerts</Text>
          <Text style={styles.gymReminderSub}>Set the exact time you head to the gym for daily reminders</Text>
        </View>
        <Text style={styles.gymReminderAction}>Configure ➔</Text>
      </TouchableOpacity>

      {/* AI Coaching Progress Narrative */}
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        snapshots.map((snap, i) => (
          <View key={i} style={styles.narrativeCard}>
            <Text style={styles.narrativeHeader}>Protocol Analysis & Summary</Text>
            {snap.weightKg != null && (
              <Text style={styles.weightText}>Current Recorded Weight: {snap.weightKg} kg</Text>
            )}
            <Text style={styles.narrativeBody}>
              {snap.aiNarrative || "Baseline initialized. Complete and check off your daily targets to establish your progression trend."}
            </Text>
          </View>
        ))
      )}

      <GymReminderModal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { gap: 4 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  dateStrip: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
  },
  dateCard: {
    width: 52,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  dateCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateCardToday: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  dateDayName: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  dateNum: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  dateTextSelected: { color: colors.background, fontWeight: "800" },
  todayIndicator: { fontSize: 8, color: colors.primary, fontWeight: "800", marginTop: 2 },
  checklistCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  checklistCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checklistTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  checklistScore: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10B981", // Emerald green for checklist completion
    borderRadius: 4,
  },
  tasksContainer: { gap: 10 },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskItemDone: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "#10B981",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  taskLabel: { color: colors.textPrimary, fontWeight: "600", fontSize: 14 },
  taskLabelDone: {
    textDecorationLine: "line-through",
    color: colors.textSecondary,
  },
  taskSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  gymReminderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gymReminderTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  gymReminderSub: { color: colors.textMuted, fontSize: 12 },
  gymReminderAction: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  narrativeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  narrativeHeader: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  weightText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  narrativeBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
