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

  const sheetBg = isDark ? "rgba(18,18,20,0.97)" : "rgba(248,248,252,0.98)";
  const chipBg = isDark ? "rgba(58,58,60,0.70)" : "rgba(229,229,234,0.80)";
  const pillBg = isDark ? "rgba(44,44,46,0.80)" : "rgba(242,242,247,0.90)";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: sheetBg, borderColor: colors.glassBorder }]}>
          {/* Drag Handle */}
          <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Gym Schedule</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: pillBg }]}
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
                        { backgroundColor: active ? colors.accent : chipBg, borderColor: active ? colors.accent : colors.glassBorder },
                      ]}
                      onPress={() => setSelectedTime(time)}
                    >
                      <Text style={[styles.chipText, { color: active ? "#FFFFFF" : colors.textSecondary }]}>{time}</Text>
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
                        { backgroundColor: active ? colors.accent : chipBg, borderColor: active ? colors.accent : colors.glassBorder },
                      ]}
                      onPress={() => toggleDay(idx)}
                    >
                      <Text style={[styles.dayChipText, { color: active ? "#FFFFFF" : colors.textSecondary }]}>{dayName}</Text>
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
                  trackColor={{ false: chipBg, true: colors.accent }}
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
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "88%",
    borderWidth: 0.5,
    borderBottomWidth: 0,
    gap: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
    opacity: 0.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: 0.38 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 14, fontWeight: "600" },
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
  chipText: { fontSize: 13, fontWeight: "500" },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  dayChipText: { fontSize: 12, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  switchTitle: { fontSize: 15, fontWeight: "600" },
  switchSub: { fontSize: 12, marginTop: 1 },
  footer: { marginTop: 16 },
});
