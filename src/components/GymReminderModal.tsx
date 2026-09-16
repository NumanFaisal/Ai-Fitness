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
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
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
  const [selectedTime, setSelectedTime] = useState("06:00 PM");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 4, 5]); // Mon, Tue, Thu, Fri
  const [gymAlertEnabled, setGymAlertEnabled] = useState(true);
  const [mealAlertEnabled, setMealAlertEnabled] = useState(true);
  const [waterAlertEnabled, setWaterAlertEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSavedReminders();
    }
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
      Alert.alert(
        "Reminders Configured",
        `Your daily workout alert is scheduled for ${selectedTime} on your training days.`
      );
      if (onSaved) onSaved(data);
      onClose();
    } catch {
      Alert.alert("Saved Locally", `Your gym alert is saved for ${selectedTime}.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Gym Schedule & Reminders</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 16 }}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What time do you go to the gym?</Text>
              <Text style={styles.sectionSub}>We'll notify you 30 mins before your session</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChips}>
                {COMMON_TIMES.map((time) => {
                  const active = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedTime(time)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Training Days</Text>
              <View style={styles.daysRow}>
                {DAYS.map((dayName, idx) => {
                  const active = selectedDays.includes(idx);
                  return (
                    <TouchableOpacity
                      key={dayName}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      onPress={() => toggleDay(idx)}
                    >
                      <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{dayName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Gym Workout Alert</Text>
                <Text style={styles.switchSub}>Daily reminder before workout time</Text>
              </View>
              <Switch
                value={gymAlertEnabled}
                onValueChange={setGymAlertEnabled}
                trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Meal & Diet Reminders</Text>
                <Text style={styles.switchSub}>Alerts for Breakfast, Lunch, & Dinner</Text>
              </View>
              <Switch
                value={mealAlertEnabled}
                onValueChange={setMealAlertEnabled}
                trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Hydration Reminders</Text>
                <Text style={styles.switchSub}>Periodic alerts to drink water</Text>
              </View>
              <Switch
                value={waterAlertEnabled}
                onValueChange={setWaterAlertEnabled}
                trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton label="Save Reminders" onPress={handleSave} loading={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "bold",
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  sectionSub: {
    color: colors.textMuted,
    fontSize: 12,
  },
  timeChips: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  dayChipTextActive: {
    color: "#FFFFFF",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchTitle: {
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  switchSub: {
    color: colors.textMuted,
    fontSize: 12,
  },
  footer: {
    marginTop: 16,
  },
});
