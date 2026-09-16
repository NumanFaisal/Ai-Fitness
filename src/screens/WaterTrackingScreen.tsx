import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { EmptyState } from "@/components/EmptyState";
import { endpoints } from "@/api/endpoints";
import { GymReminderModal } from "@/components/GymReminderModal";
import type { WaterStatus } from "@/types/models";

const QUICK_ADD = [
  { amount: 250, label: "+250ml", volumeTag: "250 ML", desc: "Glass" },
  { amount: 500, label: "+500ml", volumeTag: "500 ML", desc: "Bottle" },
  { amount: 750, label: "+750ml", volumeTag: "750 ML", desc: "Shaker" },
  { amount: 1000, label: "+1000ml", volumeTag: "1.0 L", desc: "Jug" },
];

export function WaterTrackingScreen() {
  const [status, setStatus] = useState<WaterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    endpoints
      .getWaterStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function handleAdd(amountMl: number) {
    if (logging) return;
    setLogging(true);
    try {
      const updated = await endpoints.logWater(amountMl);
      setStatus(updated);
    } catch {
      Alert.alert("Network Error", "Could not log water. Please verify your connection.");
    } finally {
      setLogging(false);
    }
  }

  const consumed = status?.consumedMl ?? 0;
  const target = status?.targetMl ?? 3000;
  const percent = Math.min(100, Math.round((consumed / target) * 100));
  const remaining = Math.max(0, target - consumed);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 18 }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Hydration Tracker</Text>
        <Text style={styles.subtitle}>
          Calculated based on your body weight (35ml/kg) and daily workout volume
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 40 }} />
      ) : !status ? (
        <EmptyState
          title="Hydration plan generating..."
          description="Complete your onboarding to calibrate your personalized daily water target."
        />
      ) : (
        <>
          {/* Main Hydration Card */}
          <View style={styles.mainCard}>
            <Text style={styles.cardHeaderTitle}>Today's Water Intake</Text>
            
            <View style={styles.progressCircleContainer}>
              <Text style={styles.consumedNumber}>{consumed}</Text>
              <Text style={styles.targetTotal}>/ {target} ml</Text>
              <Text style={styles.percentText}>{percent}% Completed</Text>
            </View>

            {/* Visual Fill Bar */}
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>

            <Text style={styles.remainingText}>
              {remaining > 0
                ? `${remaining} ml remaining to achieve today's optimal target.`
                : "Optimal cellular hydration target reached for today."}
            </Text>
          </View>

          {/* Quick Add Buttons */}
          <View style={styles.quickAddSection}>
            <Text style={styles.sectionLabel}>Quick Log Water</Text>
            <View style={styles.quickAddGrid}>
              {QUICK_ADD.map((item) => (
                <TouchableOpacity
                  key={item.amount}
                  activeOpacity={0.7}
                  style={styles.quickAddCard}
                  disabled={logging}
                  onPress={() => handleAdd(item.amount)}
                >
                  <View style={styles.volumeBadge}>
                    <Text style={styles.volumeBadgeText}>{item.volumeTag}</Text>
                  </View>
                  <Text style={styles.quickAddAmount}>{item.label}</Text>
                  <Text style={styles.quickAddDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Daily Hydration Guideline Card */}
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>Hydration & Recovery Protocol</Text>
            <Text style={styles.guideItem}>• Drink 500ml upon waking to restore fluid balance and kickstart metabolic rate.</Text>
            <Text style={styles.guideItem}>• Sip 250ml every 15-20 minutes during resistance training sessions.</Text>
            <Text style={styles.guideItem}>• Consistent hydration maintains muscle cell volume and accelerates recovery.</Text>
          </View>

          {/* Set Reminder Button */}
          <TouchableOpacity
            style={styles.reminderBtn}
            onPress={() => setShowReminderModal(true)}
          >
            <Text style={styles.reminderBtnText}>Configure Hydration & Gym Reminders</Text>
          </TouchableOpacity>
        </>
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
  header: { gap: 4 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressCircleContainer: {
    alignItems: "center",
    marginVertical: 6,
  },
  consumedNumber: {
    fontSize: 42,
    fontWeight: "800",
    color: "#38BDF8", // Cyan / Water blue
  },
  targetTotal: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  percentText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  progressBarBackground: {
    width: "100%",
    height: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 6,
  },
  remainingText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
  },
  quickAddSection: { gap: 10 },
  sectionLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  quickAddGrid: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  quickAddCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  volumeBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    marginBottom: 2,
  },
  volumeBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  quickAddAmount: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  quickAddDesc: { color: colors.textMuted, fontSize: 11 },
  guideCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guideTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  guideItem: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  reminderBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderBtnText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});
