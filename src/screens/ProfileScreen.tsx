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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { endpoints } from "@/api/endpoints";
import type { TargetBodyBlueprint, FullProfileData } from "@/types/models";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "@/navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 50, gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Target Body & Profile</Text>
        <Text style={styles.subtitle}>
          Your transformation blueprint, physique roadmap & physiological setup
        </Text>
      </View>

      {/* Segment Switcher */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === "target" && styles.segmentBtnActive]}
          onPress={() => setActiveTab("target")}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, activeTab === "target" && styles.segmentTextActive]}>
            Physique Roadmap
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === "profile" && styles.segmentBtnActive]}
          onPress={() => setActiveTab("profile")}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, activeTab === "profile" && styles.segmentTextActive]}>
            Athlete Profile
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : activeTab === "target" ? (
        /* ==================== TARGET BODY BLUEPRINT ==================== */
        <View style={{ gap: 16 }}>
          {/* Target Physique Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.badgeGoal}>
                <Text style={styles.badgeGoalText}>
                  {blueprint?.targetPhysique.goalType.replace("_", " ") || "TARGET PHYSIQUE"}
                </Text>
              </View>
              <Text style={styles.timelineText}>
                {blueprint?.targetPhysique.estimatedWeeks || 12} WEEKS PROTOCOL
              </Text>
            </View>

            <Text style={styles.heroDescription}>
              {blueprint?.targetPhysique.targetDescription ||
                "Aesthetic, lean, and dense muscle development with progressive overload and optimal nutrient partitioning."}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Current Weight</Text>
                <Text style={styles.statVal}>
                  {blueprint?.currentStats.weightKg || 75} kg
                </Text>
              </View>
              <Text style={styles.arrowIcon}>➔</Text>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Target Weight</Text>
                <Text style={[styles.statVal, { color: colors.primary }]}>
                  {blueprint?.targetPhysique.targetWeightKg || 79} kg
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Target Date</Text>
                <Text style={styles.statValSmall}>
                  {blueprint?.targetPhysique.targetDate || "90 Days"}
                </Text>
              </View>
            </View>
          </View>

          {/* Caloric & Macronutrient Strategy */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Nutrition & Caloric Protocol</Text>
            </View>
            <Text style={styles.strategyText}>
              {blueprint?.nutritionBlueprint.strategy ||
                "Caloric surplus optimized for maximum protein synthesis while limiting adipose tissue accumulation."}
            </Text>

            <View style={styles.macroGrid}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {blueprint?.nutritionBlueprint.calorieTarget || 2600}
                </Text>
                <Text style={styles.macroLabel}>kcal / Day</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: colors.primary }]}>
                  {blueprint?.nutritionBlueprint.proteinTargetG || 160}g
                </Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {blueprint?.nutritionBlueprint.carbTargetG || 280}g
                </Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {blueprint?.nutritionBlueprint.fatTargetG || 70}g
                </Text>
                <Text style={styles.macroLabel}>Fats</Text>
              </View>
            </View>
          </View>

          {/* Training Strategy */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Training & Overload Strategy</Text>
            </View>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Weekly Routine: </Text>
                  {blueprint?.trainingBlueprint.daysPerWeek || 4} days/week · {blueprint?.trainingBlueprint.sessionDurationMin || 45} mins ({blueprint?.trainingBlueprint.focusSplit?.replace("_", " ") || "Upper/Lower Split"})
                </Text>
              </View>

              <View style={styles.bulletItem}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Progressive Overload: </Text>
                  {blueprint?.trainingBlueprint.progressiveOverloadRule || "Add 1-2 reps or 2.5kg once top of rep range is reached with clean form."}
                </Text>
              </View>

              <View style={styles.bulletItem}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Cardiovascular Health: </Text>
                  {blueprint?.trainingBlueprint.cardioRecommendation || "20-30 min low intensity cardio 2x/week to preserve insulin sensitivity."}
                </Text>
              </View>
            </View>
          </View>

          {/* 3-Phase Transformation Roadmap */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Transformation Milestones</Text>
            </View>

            {blueprint?.transformationRoadmap.map((step, idx) => (
              <View key={idx} style={styles.roadmapStep}>
                <View style={styles.stepBadgeRow}>
                  <View style={styles.stepNumBadge}>
                    <Text style={styles.stepNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.phase}</Text>
                </View>
                <Text style={styles.stepWeeks}>{step.weeks}</Text>
                <Text style={styles.stepObj}>{step.objective}</Text>
                <View style={styles.stepMilestoneContainer}>
                  <Text style={styles.stepMilestoneLabel}>Target Milestone: </Text>
                  <Text style={styles.stepMilestoneText}>{step.keyMilestone}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Core Daily Non-Negotiables */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Daily Non-Negotiable Habits</Text>
            </View>
            {blueprint?.actionableHabits.map((habit, i) => (
              <View key={i} style={styles.habitRow}>
                <View style={styles.habitDot} />
                <Text style={styles.habitText}>{habit}</Text>
              </View>
            ))}
          </View>

          {/* Recalibrate Action Button */}
          <TouchableOpacity
            style={styles.recalibrateBtn}
            activeOpacity={0.8}
            onPress={handleRecalibratePlan}
            disabled={recalibrating}
          >
            {recalibrating ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.recalibrateBtnText}>Recalibrate Training & Diet Plan</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* ==================== MY PROFILE DETAILS ==================== */
        <View style={{ gap: 16 }}>
          {/* Biometrics & Personal Info */}
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.cardHeading}>Athlete Biometrics</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.editCardBtn}
                onPress={openEditModal}
              >
                <Text style={styles.editCardBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoVal}>{profile?.name || "Athlete"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age</Text>
                <Text style={styles.infoVal}>{profile?.age || 25} years</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Biological Sex</Text>
                <Text style={styles.infoVal}>{profile?.sex || "MALE"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Height</Text>
                <Text style={styles.infoVal}>{profile?.heightCm || 178} cm</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Weight</Text>
                <Text style={styles.infoVal}>{profile?.weightKg || 75} kg</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Body Mass Index (BMI)</Text>
                <Text style={[styles.infoVal, { color: colors.primary }]}>
                  {blueprint?.currentStats.bmi || 23.7}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Edit Profile Action Button */}
          <TouchableOpacity
            style={[styles.recalibrateBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={openEditModal}
          >
            <Text style={styles.recalibrateBtnText}>Edit Profile & Biometrics</Text>
          </TouchableOpacity>

          {/* Training & Fitness Setup */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Training Environment & Specs</Text>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Training Environment</Text>
                <Text style={styles.infoVal}>
                  {fitness?.trainingEnvironment || "GYM"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Experience Level</Text>
                <Text style={styles.infoVal}>
                  {fitness?.experienceLevel || "BEGINNER"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Workout Frequency</Text>
                <Text style={styles.infoVal}>
                  {fitness?.workoutDaysPerWeek || 4} days / week
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Session Duration</Text>
                <Text style={styles.infoVal}>
                  {fitness?.sessionDurationMin || 45} minutes
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Equipment</Text>
                <Text style={styles.infoValSmall}>
                  {fitness?.equipmentAvailable?.join(", ") || "Dumbbells, Barbells, Cables, Bench"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Injuries / Limits</Text>
                <Text style={styles.infoValSmall}>
                  {fitness?.injuries?.length ? fitness.injuries.join(", ") : "None reported"}
                </Text>
              </View>
            </View>
          </View>

          {/* Diet & Preferences */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Nutrition & Dietary Setup</Text>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dietary Preference</Text>
                <Text style={styles.infoVal}>
                  {fitness?.dietaryPreference || "High Protein / Balanced"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Budget Tier</Text>
                <Text style={styles.infoVal}>{fitness?.budgetTier || "MEDIUM"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Allergies</Text>
                <Text style={styles.infoValSmall}>
                  {fitness?.allergies?.length ? fitness.allergies.join(", ") : "None"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Disliked Foods</Text>
                <Text style={styles.infoValSmall}>
                  {fitness?.dislikedFoods?.length ? fitness.dislikedFoods.join(", ") : "None"}
                </Text>
              </View>
            </View>
          </View>

          {/* Retake Questionnaire / Edit Profile Action */}
          <TouchableOpacity
            style={[styles.recalibrateBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                "Update Onboarding Data",
                "Would you like to step through the onboarding flow again to adjust your fitness goals, experience, or preferences?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Retake Setup",
                    onPress: () => navigation.getParent()?.navigate("Onboarding" as never),
                  },
                ]
              );
            }}
          >
            <Text style={[styles.recalibrateBtnText, { color: colors.textPrimary }]}>
              Reset & Retake Full Onboarding
            </Text>
          </TouchableOpacity>

          {/* Log Out Button */}
          <TouchableOpacity
            style={[styles.recalibrateBtn, { backgroundColor: "rgba(220, 38, 38, 0.08)", borderWidth: 1, borderColor: "rgba(220, 38, 38, 0.3)" }]}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Text style={[styles.recalibrateBtnText, { color: "#EF4444" }]}>
              Sign Out of Account
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile & Targets</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
              <Text style={styles.modalSubtitle}>
                Updating your weight or goal will automatically recalculate your daily BMR, calories, protein, and workout split in the database.
              </Text>

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Athlete Name"
                placeholderTextColor={colors.textMuted}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editWeightKg}
                    onChangeText={setEditWeightKg}
                    keyboardType="decimal-pad"
                    placeholder="75"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editHeightCm}
                    onChangeText={setEditHeightCm}
                    keyboardType="number-pad"
                    placeholder="178"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Age</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editAge}
                    onChangeText={setEditAge}
                    keyboardType="number-pad"
                    placeholder="25"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Workout Days/Week</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(editWorkoutDays)}
                    onChangeText={(v) => setEditWorkoutDays(Number(v) || 4)}
                    keyboardType="number-pad"
                    placeholder="4"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Primary Goal</Text>
              <View style={styles.goalChipsContainer}>
                {[
                  { id: "FAT_LOSS", label: "Fat Loss" },
                  { id: "MUSCLE_GAIN", label: "Muscle Hypertrophy" },
                  { id: "RECOMPOSITION", label: "Recomposition" },
                  { id: "GENERAL_FITNESS", label: "Athletic Conditioning" },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.goalChip,
                      editGoal === g.id && styles.goalChipSelected,
                    ]}
                    onPress={() => setEditGoal(g.id)}
                  >
                    <Text
                      style={[
                        styles.goalChipText,
                        editGoal === g.id && styles.goalChipTextSelected,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Dietary Preference</Text>
              <TextInput
                style={styles.modalInput}
                value={editDiet}
                onChangeText={setEditDiet}
                placeholder="e.g. Omnivore, High Protein, Vegetarian"
                placeholderTextColor={colors.textMuted}
              />

              <TouchableOpacity
                style={styles.saveEditBtn}
                activeOpacity={0.8}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.saveEditBtnText}>Save & Recalibrate Plan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { gap: 4 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.background,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    gap: 14,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeGoal: {
    backgroundColor: `${colors.primary}25`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeGoalText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  timelineText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  heroDescription: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  statVal: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  statValSmall: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  arrowIcon: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeading: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  strategyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  macroGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  macroItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  bulletDot: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  roadmapStep: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  stepBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "800",
  },
  stepTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  stepWeeks: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  stepObj: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  stepMilestoneContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  stepMilestoneLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  stepMilestoneText: {
    color: colors.textPrimary,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  habitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  habitText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  recalibrateBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  recalibrateBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  infoVal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  infoValSmall: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  editCardBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editCardBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textMuted,
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 2,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  goalChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalChip: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  goalChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  goalChipTextSelected: {
    color: colors.background,
    fontWeight: "800",
  },
  saveEditBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveEditBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
});
