import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { endpoints } from "@/api/endpoints";
import { GymReminderModal } from "@/components/GymReminderModal";
import type { WaterStatus } from "@/types/models";

const QUICK_ADD = [
  { amount: 250, label: "+250ml", desc: "Glass" },
  { amount: 500, label: "+500ml", desc: "Bottle" },
  { amount: 750, label: "+750ml", desc: "Shaker" },
  { amount: 1000, label: "+1L", desc: "Jug" },
];

export function WaterTrackingScreen() {
  const { colors, isDark } = useTheme();
  const [status, setStatus] = useState<WaterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    endpoints.getWaterStatus().then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
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
    } finally { setLogging(false); }
  }

  const consumed = status?.consumedMl ?? 0;
  const target = status?.targetMl ?? 3000;
  const percent = Math.min(100, Math.round((consumed / target) * 100));
  const remaining = Math.max(0, target - consumed);
  const isComplete = percent >= 100;

  const chipBg = isDark ? "rgba(44,44,46,0.75)" : "rgba(242,242,247,0.90)";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Hydration</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>35ml per kg body weight · adjusted for training volume</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 40 }} />
      ) : !status ? (
        <EmptyState title="Hydration target" description="Complete onboarding to calculate your baseline water requirement." />
      ) : (
        <>
          {/* Main Intake Card */}
          <GlassCard strong style={styles.intakeCard}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TODAY'S INTAKE</Text>
            <View style={styles.intakeRow}>
              <Text style={[styles.consumedNum, { color: colors.textPrimary }]}>{consumed}</Text>
              <Text style={[styles.targetNum, { color: colors.textSecondary }]}>/ {target} ml</Text>
              {isComplete && (
                <View style={[styles.badge, { backgroundColor: colors.successMuted }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>Goal ✓</Text>
                </View>
              )}
            </View>
            {/* Progress bar */}
            <View style={[styles.track, { backgroundColor: colors.glassBackground }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${percent}%` as any, backgroundColor: isComplete ? colors.success : colors.accent },
                ]}
              />
            </View>
            <Text style={[styles.remainText, { color: colors.textSecondary }]}>
              {remaining > 0 ? `${remaining} ml remaining to reach daily target` : "Optimal hydration target achieved ✓"}
            </Text>
          </GlassCard>

          {/* Quick Add */}
          <GlassCard style={styles.quickSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>QUICK LOG</Text>
            <View style={styles.quickGrid}>
              {QUICK_ADD.map((item) => (
                <TouchableOpacity
                  key={item.amount}
                  activeOpacity={0.7}
                  style={[styles.quickCard, { backgroundColor: chipBg, borderColor: colors.glassBorder }]}
                  disabled={logging}
                  onPress={() => handleAdd(item.amount)}
                >
                  <Text style={[styles.quickAmount, { color: colors.accent }]}>{item.label}</Text>
                  <Text style={[styles.quickDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>

          {/* Guidelines */}
          <GlassCard style={{ gap: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PROTOCOL GUIDELINES</Text>
            {[
              "Drink 500ml upon waking to restore overnight fluid loss.",
              "Sip 250ml every 15–20 minutes during resistance training.",
              "Fluid balance accelerates muscle protein synthesis and mental focus.",
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </GlassCard>

          {/* Reminder link */}
          <TouchableOpacity onPress={() => setShowReminderModal(true)} style={styles.reminderBtn}>
            <Text style={[styles.reminderText, { color: colors.accent }]}>Configure reminder schedule →</Text>
          </TouchableOpacity>
        </>
      )}

      <GymReminderModal visible={showReminderModal} onClose={() => setShowReminderModal(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: Platform.OS === "ios" ? 60 : 48, gap: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 14, letterSpacing: -0.2, marginTop: 2, marginBottom: 4 },
  intakeCard: { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  intakeRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  consumedNum: { fontSize: 48, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  targetNum: { fontSize: 20, fontWeight: "500", letterSpacing: -0.3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginLeft: "auto" as any },
  badgeText: { fontSize: 12, fontWeight: "600" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  remainText: { fontSize: 13, lineHeight: 18 },
  quickSection: { gap: 10 },
  quickGrid: { flexDirection: "row", gap: 8 },
  quickCard: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 2, borderWidth: 0.5 },
  quickAmount: { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },
  quickDesc: { fontSize: 11 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  reminderBtn: { paddingVertical: 8 },
  reminderText: { fontSize: 14, fontWeight: "500" },
});
