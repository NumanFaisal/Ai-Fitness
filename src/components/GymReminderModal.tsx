import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/store/ThemeContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { endpoints } from "@/api/endpoints";
import type { UserReminders } from "@/types/models";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: (reminders: UserReminders) => void;
}

const COMMON_TIMES = ["06:00 AM", "07:00 AM", "08:30 AM", "05:00 PM", "06:00 PM", "07:30 PM", "08:30 PM"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function GymReminderModal({ visible, onClose, onSaved }: Props) {
  const { colors, isDark } = useTheme();
  const [selectedTime, setSelectedTime] = useState("06:00 PM");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 4, 5]);
  const [gymAlertEnabled, setGymAlertEnabled] = useState(true);
  const [mealAlertEnabled, setMealAlertEnabled] = useState(true);
  const [waterAlertEnabled, setWaterAlertEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) loadSavedReminders();
  }, [visible]);

  async function loadSavedReminders() {
    try {
      const local = await AsyncStorage.getItem("user_gym_reminders");
      if (local) {
        const parsed: UserReminders = JSON.parse(local);
        if (parsed.gymTime) setSelectedTime(parsed.gymTime);
        if (parsed.gymDays) setSelectedDays(parsed.gymDays);
        if (parsed.mealReminders !== undefined) setMealAlertEnabled(parsed.mealReminders);
        if (parsed.waterReminders !== undefined) setWaterAlertEnabled(parsed.waterReminders);
        return;
      }
      const remote = await endpoints.getReminders();
      if (remote) {
        if (remote.gymTime) setSelectedTime(remote.gymTime);
        if (remote.gymDays) setSelectedDays(remote.gymDays);
      }
    } catch {
      // Use defaults
    }
  }

  function toggleDay(dayIndex: number) {
    setSelectedDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  }

  async function handleSave() {
    setSaving(true);
    const data: UserReminders = {
      gymTime: selectedTime,
      gymDays: selectedDays,
      mealReminders: mealAlertEnabled,
      waterReminders: waterAlertEnabled,
      waterIntervalHours: 2,
    };
    try {
      await AsyncStorage.setItem("user_gym_reminders", JSON.stringify(data));
      await endpoints.saveReminders(data);
      Alert.alert("Reminders Configured", `Your daily workout alert is scheduled for ${selectedTime} on your training days.`);
      if (onSaved) onSaved(data);
      onClose();
    } catch {
      Alert.alert("Saved Locally", `Your gym alert is saved for ${selectedTime}.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const sheetBg = isDark ? "rgba(22,22,24,0.97)" : "rgba(255,255,255,0.98)";
  const chipBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const closeBtnBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const handleBg = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)";
  const highlightBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)";
  const overlayBg = isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.36)";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, { backgroundColor: sheetBg, borderColor: colors.glassBorderStrong }]}>
          {/* Inner top highlight shimmer — frosted glass catch-light */}
          <View style={[styles.highlight, { backgroundColor: highlightBg }]} pointerEvents="none" />

          {/* Drag Handle */}
          <View style={[styles.handle, { backgroundColor: handleBg }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Gym Schedule</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: closeBtnBg, borderColor: colors.glassBorder }]}
              accessibilityRole="button"
              accessibilityLabel="Close schedule modal"
            >
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 20 }} showsVerticalScrollIndicator={false}>
            {/* Time Picker */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Gym time</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Notified 30 min before your session</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChips}>
                {COMMON_TIMES.map((time) => {
                  const active = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? colors.accent : chipBg,
                          borderColor: active ? colors.accent : colors.glassBorder,
                          ...(active && styles.activeChipGlow),
                        },
                      ]}
                      onPress={() => setSelectedTime(time)}
                    >
                      <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.textSecondary, fontWeight: active ? "600" : "500" }]}>{time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Days Picker */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Training days</Text>
              <View style={styles.daysRow}>
                {DAYS.map((dayName, idx) => {
                  const active = selectedDays.includes(idx);
                  return (
                    <TouchableOpacity
                      key={dayName}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: active ? colors.accent : chipBg,
                          borderColor: active ? colors.accent : colors.glassBorder,
                          ...(active && styles.activeChipGlow),
                        },
                      ]}
                      onPress={() => toggleDay(idx)}
                    >
                      <Text style={[styles.dayChipText, { color: active ? "#FFFFFF" : colors.textSecondary, fontWeight: active ? "700" : "600" }]}>{dayName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Toggles */}
            {[
              { title: "Workout Alert", sub: "30 min before gym time", val: gymAlertEnabled, set: setGymAlertEnabled },
              { title: "Meal Reminders", sub: "Breakfast, Lunch & Dinner", val: mealAlertEnabled, set: setMealAlertEnabled },
              { title: "Hydration Alerts", sub: "Every 2 hours throughout the day", val: waterAlertEnabled, set: setWaterAlertEnabled },
            ].map((row) => (
              <View
                key={row.title}
                style={[styles.switchRow, { borderTopColor: colors.glassBorder }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>{row.title}</Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>{row.sub}</Text>
                </View>
                <Switch
                  value={row.val}
                  onValueChange={row.set}
                  trackColor={{ false: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)", true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton label="Save Schedule" onPress={handleSave} loading={saving} size="large" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "88%",
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 24,
    gap: 4,
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: 0.38 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 13, fontWeight: "600" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, marginTop: -4 },
  timeChips: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  activeChipGlow: {
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  chipText: { fontSize: 13 },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  dayChipText: { fontSize: 12 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 0.5,
  },
  switchTitle: { fontSize: 15, fontWeight: "600" },
  switchSub: { fontSize: 12, marginTop: 1 },
  footer: { marginTop: 16 },
});
