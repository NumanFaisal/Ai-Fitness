import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/store/ThemeContext";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { endpoints } from "@/api/endpoints";
import type { TargetBodyBlueprint, FullProfileData } from "@/types/models";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "@/navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"target" | "profile">("target");
  const [blueprint, setBlueprint] = useState<TargetBodyBlueprint | null>(null);
  const [profileData, setProfileData] = useState<FullProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  // Edit Profile Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editTargetWeightKg, setEditTargetWeightKg] = useState("");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editGoal, setEditGoal] = useState("RECOMPOSITION");
  const [editDiet, setEditDiet] = useState("Omnivore");
  const [editWorkoutDays, setEditWorkoutDays] = useState(4);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [bp, prof] = await Promise.allSettled([
        endpoints.getTargetBodyBlueprint(),
        endpoints.getProfile(),
      ]);

      if (bp.status === "fulfilled" && bp.value) {
        setBlueprint(bp.value);
      }
      if (prof.status === "fulfilled" && prof.value) {
        setProfileData(prof.value);
      }
    } catch (err) {
      console.warn("Failed to load profile/target-body data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRecalibratePlan() {
    setRecalibrating(true);
    try {
      await endpoints.generatePlan();
      await loadData();
      Alert.alert("Plan Updated", "Your training routine, nutrition, and target blueprint have been recalibrated!");
    } catch (err: any) {
      Alert.alert("Notice", "Plan refreshed with your latest profile settings.");
    } finally {
      setRecalibrating(false);
    }
  }

  function openEditModal() {
    const prof = profileData?.profile || blueprint?.currentStats;
    const fit = profileData?.fitnessProfile;
    const g = profileData?.goal?.type || "RECOMPOSITION";

    setEditName(prof?.name || "Athlete");
    setEditAge(String(prof?.age || 25));
    setEditWeightKg(String(prof?.weightKg || 75));
    setEditTargetWeightKg(String(blueprint?.targetPhysique?.targetWeightKg || 72));
    setEditHeightCm(String(prof?.heightCm || 178));
    setEditGoal(g);
    setEditDiet(fit?.dietaryPreference || "Omnivore");
    setEditWorkoutDays(fit?.workoutDaysPerWeek || 4);
    setEditModalVisible(true);
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    try {
      await endpoints.editProfile({
        name: editName,
        age: Number(editAge),
        weightKg: Number(editWeightKg),
        targetWeightKg: Number(editTargetWeightKg) || undefined,
        heightCm: Number(editHeightCm),
        goal: editGoal,
        dietaryPreference: editDiet,
        workoutDaysPerWeek: editWorkoutDays,
      });
      await loadData();
      setEditModalVisible(false);
      Alert.alert(
        "Profile & Plan Updated",
        "Your biometrics, caloric targets, and workout split have been recalculated and saved to the database!"
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out of your account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("auth_token");
          await AsyncStorage.removeItem("has_completed_onboarding");
          navigation.getParent()?.navigate("Onboarding" as never);
        },
      },
    ]);
  }

  const profile = profileData?.profile || blueprint?.currentStats;
  const fitness = profileData?.fitnessProfile;
  const goal = profileData?.goal;

  const segBg = isDark ? "rgba(44,44,46,0.75)" : "rgba(229,229,234,0.80)";
  const chipBg = isDark ? "rgba(58,58,60,0.65)" : "rgba(229,229,234,0.75)";
  const modalBg = isDark ? "rgba(18,18,20,0.97)" : "rgba(248,248,252,0.98)";
  const inputBg = isDark ? "rgba(44,44,46,0.80)" : "rgba(242,242,247,0.90)";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: Platform.OS === "ios" ? 60 : 48, paddingBottom: 100, gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Transformation blueprint, physique roadmap & physiological setup
        </Text>
      </View>

      {/* Segment Switcher */}
      <View style={[styles.segmentContainer, { backgroundColor: segBg, borderColor: colors.glassBorder }]}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === "target" && { backgroundColor: colors.accentMuted }]}
          onPress={() => setActiveTab("target")}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, { color: activeTab === "target" ? colors.accent : colors.textSecondary }]}>
            Physique Roadmap
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === "profile" && { backgroundColor: colors.accentMuted }]}
          onPress={() => setActiveTab("profile")}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, { color: activeTab === "profile" ? colors.accent : colors.textSecondary }]}>
            Athlete Profile
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : activeTab === "target" ? (
        /* ==================== TARGET BODY BLUEPRINT ==================== */
        <View style={{ gap: 14 }}>
          <GlassCard strong style={{ gap: 14 }}>
            <View style={styles.heroHeader}>
              <View style={[styles.badgeGoal, { backgroundColor: colors.accentMuted }]}>
                <Text style={[styles.badgeGoalText, { color: colors.accent }]}>
                  {blueprint?.targetPhysique.goalType?.replace("_", " ") || "TARGET PHYSIQUE"}
                </Text>
              </View>
              <Text style={[styles.timelineText, { color: colors.textSecondary }]}>
                {blueprint?.targetPhysique.estimatedWeeks || 12} WEEKS
              </Text>
            </View>
            <Text style={[styles.heroDescription, { color: colors.textPrimary }]}>
              {blueprint?.targetPhysique.targetDescription || "Aesthetic, lean, and dense muscle development with progressive overload and optimal nutrient partitioning."}
            </Text>
            <View style={[styles.statsRow, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Current</Text>
                <Text style={[styles.statVal, { color: colors.textPrimary }]}>{blueprint?.currentStats.weightKg || 75} kg</Text>
              </View>
              <Text style={[styles.arrowIcon, { color: colors.accent }]}>→</Text>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Target</Text>
                <Text style={[styles.statVal, { color: colors.accent }]}>{blueprint?.targetPhysique.targetWeightKg || 79} kg</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Timeline</Text>
                <Text style={[styles.statValSmall, { color: colors.textPrimary }]}>{blueprint?.targetPhysique.targetDate || "90 Days"}</Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={{ gap: 10 }}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Nutrition Protocol</Text>
            <Text style={[styles.strategyText, { color: colors.textSecondary }]}>{blueprint?.nutritionBlueprint.strategy || "Caloric surplus optimized for maximum protein synthesis while limiting adipose tissue accumulation."}</Text>
            <View style={styles.macroGrid}>
              {[{ val: blueprint?.nutritionBlueprint.calorieTarget || 2600, label: "kcal/day", accent: false },
                { val: `${blueprint?.nutritionBlueprint.proteinTargetG || 160}g`, label: "Protein", accent: true },
                { val: `${blueprint?.nutritionBlueprint.carbTargetG || 280}g`, label: "Carbs", accent: false },
                { val: `${blueprint?.nutritionBlueprint.fatTargetG || 70}g`, label: "Fats", accent: false },
              ].map((m, i) => (
                <View key={i} style={[styles.macroItem, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}>
                  <Text style={[styles.macroValue, { color: m.accent ? colors.accent : colors.textPrimary }]}>{m.val}</Text>
                  <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>{m.label}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <GlassCard style={{ gap: 10 }}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Training Strategy</Text>
            {[`Weekly: ${blueprint?.trainingBlueprint.daysPerWeek || 4} days/week · ${blueprint?.trainingBlueprint.sessionDurationMin || 45} min (${blueprint?.trainingBlueprint.focusSplit?.replace("_", " ") || "Upper/Lower"})`,
              `Overload: ${blueprint?.trainingBlueprint.progressiveOverloadRule || "Add 1-2 reps or 2.5kg once top of rep range reached."}`,
              `Cardio: ${blueprint?.trainingBlueprint.cardioRecommendation || "20-30 min low intensity 2×/week for insulin sensitivity."}`,
            ].map((tip, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={[styles.habitDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard style={{ gap: 10 }}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Transformation Milestones</Text>
            {blueprint?.transformationRoadmap.map((step, idx) => (
              <View key={idx} style={[styles.roadmapStep, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}>
                <View style={styles.stepBadgeRow}>
                  <View style={[styles.stepNumBadge, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
                    <Text style={[styles.stepNumText, { color: colors.accent }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{step.phase}</Text>
                </View>
                <Text style={[styles.stepWeeks, { color: colors.accent }]}>{step.weeks}</Text>
                <Text style={[styles.stepObj, { color: colors.textSecondary }]}>{step.objective}</Text>
                <View style={[styles.stepMilestoneContainer, { backgroundColor: colors.accentMuted, borderLeftColor: colors.accent }]}>
                  <Text style={[styles.stepMilestoneLabel, { color: colors.accent }]}>Milestone: </Text>
                  <Text style={[styles.stepMilestoneText, { color: colors.textPrimary }]}>{step.keyMilestone}</Text>
                </View>
              </View>
            ))}
          </GlassCard>

          <GlassCard style={{ gap: 10 }}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Daily Non-Negotiables</Text>
            {blueprint?.actionableHabits.map((habit, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={[styles.habitDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.habitText, { color: colors.textSecondary }]}>{habit}</Text>
              </View>
            ))}
          </GlassCard>

          <PrimaryButton label={recalibrating ? "Recalibrating..." : "Recalibrate Training & Diet Plan"} onPress={handleRecalibratePlan} loading={recalibrating} size="large" />
        </View>
      ) : (
        /* ==================== MY PROFILE DETAILS ==================== */
        <View style={{ gap: 14 }}>
          <GlassCard strong style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Athlete Biometrics</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.editCardBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
                onPress={openEditModal}
              >
                <Text style={[styles.editCardBtnText, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            {[
              { label: "Name", val: profile?.name || "Athlete" },
              { label: "Age", val: `${profile?.age || 25} years` },
              { label: "Sex", val: profile?.sex || "MALE" },
              { label: "Height", val: `${profile?.heightCm || 178} cm` },
              { label: "Weight", val: `${profile?.weightKg || 75} kg` },
              { label: "BMI", val: String(blueprint?.currentStats.bmi || 23.7), accent: true },
            ].map((row, i) => (
              <View key={i} style={[styles.infoRow, { borderBottomColor: colors.glassBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.infoVal, { color: (row as any).accent ? colors.accent : colors.textPrimary }]}>{row.val}</Text>
              </View>
            ))}
          </GlassCard>

          <PrimaryButton label="Edit Profile & Biometrics" onPress={openEditModal} size="large" />

          <GlassCard style={{ gap: 10 }}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Training Environment</Text>
            {[
              { label: "Environment", val: fitness?.trainingEnvironment || "GYM" },
              { label: "Experience", val: fitness?.experienceLevel || "BEGINNER" },
              { label: "Frequency", val: `${fitness?.workoutDaysPerWeek || 4} days/week` },
              { label: "Duration", val: `${fitness?.sessionDurationMin || 45} min/session` },
              { label: "Equipment", val: fitness?.equipmentAvailable?.join(", ") || "Dumbbells, Barbells, Cables" },
              { label: "Injuries", val: fitness?.injuries?.length ? fitness.injuries.join(", ") : "None" },
            ].map((row, i) => (
              <View key={i} style={[styles.infoRow, { borderBottomColor: colors.glassBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.infoValSmall, { color: colors.textPrimary }]}>{row.val}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard style={{ gap: 10 }}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Nutrition & Diet</Text>
            {[
              { label: "Dietary Preference", val: fitness?.dietaryPreference || "High Protein" },
              { label: "Budget", val: fitness?.budgetTier || "MEDIUM" },
              { label: "Allergies", val: fitness?.allergies?.length ? fitness.allergies.join(", ") : "None" },
              { label: "Disliked Foods", val: fitness?.dislikedFoods?.length ? fitness.dislikedFoods.join(", ") : "None" },
            ].map((row, i) => (
              <View key={i} style={[styles.infoRow, { borderBottomColor: colors.glassBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.infoValSmall, { color: colors.textPrimary }]}>{row.val}</Text>
              </View>
            ))}
          </GlassCard>

          <PrimaryButton label="Reset & Retake Onboarding" variant="secondary" onPress={() => {
            Alert.alert("Update Onboarding Data", "Step through onboarding again to adjust your profile?", [
              { text: "Cancel", style: "cancel" },
              { text: "Retake", onPress: () => (navigation.getParent() as any)?.navigate("Onboarding", { screen: "ProfileSetup" }) },
            ]);
          }} size="large" />

          <PrimaryButton label="Sign Out" variant="destructive" onPress={handleLogout} size="large" />
        </View>
      )}

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: modalBg, borderColor: colors.glassBorder }]}>
            <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile & Targets</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Updating weight, target, or goal recalculates your daily BMR, calories, protein, and workout split.</Text>

              {[{ label: "Full Name", val: editName, set: setEditName, kb: undefined, ph: "Athlete Name" },
              ].map((f) => (
                <View key={f.label}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{f.label}</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.glassBorder, color: colors.textPrimary }]} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={colors.textMuted} />
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Current Weight (kg)</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.glassBorder, color: colors.textPrimary }]} value={editWeightKg} onChangeText={setEditWeightKg} keyboardType="decimal-pad" placeholder="75" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Target Weight (kg)</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.accent, color: colors.textPrimary }]} value={editTargetWeightKg} onChangeText={setEditTargetWeightKg} keyboardType="decimal-pad" placeholder="72" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.glassBorder, color: colors.textPrimary }]} value={editHeightCm} onChangeText={setEditHeightCm} keyboardType="number-pad" placeholder="178" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.glassBorder, color: colors.textPrimary }]} value={editAge} onChangeText={setEditAge} keyboardType="number-pad" placeholder="25" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Workout Days/Week</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.glassBorder, color: colors.textPrimary }]} value={String(editWorkoutDays)} onChangeText={(v) => setEditWorkoutDays(Number(v) || 5)} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textMuted} />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Primary Goal</Text>
              <View style={styles.goalChipsContainer}>
                {[{ id: "FAT_LOSS", label: "Fat Loss" }, { id: "MUSCLE_GAIN", label: "Muscle Gain" }, { id: "RECOMPOSITION", label: "Recomposition" }, { id: "GENERAL_FITNESS", label: "General Fitness" }].map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.goalChip, { backgroundColor: editGoal === g.id ? colors.accent : chipBg, borderColor: editGoal === g.id ? colors.accent : colors.glassBorder }]}
                    onPress={() => setEditGoal(g.id)}
                  >
                    <Text style={[styles.goalChipText, { color: editGoal === g.id ? "#FFFFFF" : colors.textSecondary }]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Dietary Preference</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: inputBg, borderColor: colors.glassBorder, color: colors.textPrimary }]} value={editDiet} onChangeText={setEditDiet} placeholder="e.g. Omnivore, Vegetarian" placeholderTextColor={colors.textMuted} />

              <PrimaryButton label="Save & Recalibrate Plan" onPress={handleSaveEdit} loading={savingEdit} size="large" style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle: { fontSize: 14, letterSpacing: -0.2, marginTop: 2 },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    borderWidth: 0.5,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeGoal: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeGoalText: { fontWeight: "700", fontSize: 11, letterSpacing: 0.5 },
  timelineText: { fontSize: 12, fontWeight: "600" },
  heroDescription: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: 12, borderWidth: 0.5 },
  statBox: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  statVal: { fontSize: 18, fontWeight: "800" },
  statValSmall: { fontSize: 12, fontWeight: "700" },
  arrowIcon: { fontSize: 16, fontWeight: "800" },
  cardHeading: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  strategyText: { fontSize: 13, lineHeight: 19 },
  macroGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 4 },
  macroItem: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 0.5 },
  macroValue: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3, fontVariant: ["tabular-nums"] as const },
  macroLabel: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  bulletItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },
  roadmapStep: { borderRadius: 12, padding: 14, borderWidth: 0.5, gap: 6 },
  stepBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepNumBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 12, fontWeight: "700" },
  stepTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  stepWeeks: { fontSize: 12, fontWeight: "600" },
  stepObj: { fontSize: 13, lineHeight: 18 },
  stepMilestoneContainer: { flexDirection: "row", padding: 8, borderRadius: 8, marginTop: 4, borderLeftWidth: 2 },
  stepMilestoneLabel: { fontSize: 11, fontWeight: "600" },
  stepMilestoneText: { fontSize: 11, flex: 1, lineHeight: 16 },
  habitDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  habitText: { fontSize: 13, lineHeight: 18, flex: 1 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 0.5 },
  infoLabel: { fontSize: 13, fontWeight: "500" },
  infoVal: { fontSize: 14, fontWeight: "700" },
  infoValSmall: { fontSize: 12, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  editCardBtn: { borderWidth: 0.5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  editCardBtnText: { fontSize: 13, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: "90%", borderWidth: 0.5, borderBottomWidth: 0 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14, opacity: 0.4 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "700", letterSpacing: 0.38 },
  modalCloseText: { fontSize: 18, fontWeight: "600", padding: 4 },
  modalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: "600", marginBottom: 5, marginTop: 4 },
  modalInput: { borderRadius: 12, padding: 13, borderWidth: 0.5, fontSize: 15 },
  goalChipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5 },
  goalChipText: { fontSize: 13, fontWeight: "600" },
});
