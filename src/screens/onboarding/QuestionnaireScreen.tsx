import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useOnboarding } from "@/store/OnboardingContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import type { ExperienceLevel, TrainingEnvironment, BudgetTier } from "@/types/models";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Questionnaire">;

const EXPERIENCE: ExperienceLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const ENVIRONMENTS: TrainingEnvironment[] = ["GYM", "HOME", "OUTDOOR"];
const BUDGETS: { label: string; value: BudgetTier }[] = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Flexible", value: "FLEXIBLE" },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PrimaryButton
      label={label}
      variant={selected ? "primary" : "secondary"}
      onPress={onPress}
      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
    />
  );
}

export function QuestionnaireScreen({ navigation }: Props) {
  const { setFitnessProfile } = useOnboarding();
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [trainingEnvironment, setTrainingEnvironment] = useState<TrainingEnvironment | null>(null);
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState("");
  const [sessionDurationMin, setSessionDurationMin] = useState("");
  const [injuries, setInjuries] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [allergies, setAllergies] = useState("");
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null);

  const canContinue =
    experienceLevel !== null &&
    trainingEnvironment !== null &&
    Number(workoutDaysPerWeek) > 0 &&
    Number(sessionDurationMin) > 0 &&
    dietaryPreference.trim().length > 0 &&
    budgetTier !== null;

  function handleContinue() {
    setFitnessProfile({
      experienceLevel: experienceLevel!,
      trainingEnvironment: trainingEnvironment!,
      equipmentAvailable: [], // captured on a dedicated equipment step in the full flow
      workoutDaysPerWeek: Number(workoutDaysPerWeek),
      sessionDurationMin: Number(sessionDurationMin),
      injuries: injuries.trim() ? injuries.split(",").map((s) => s.trim()) : [],
      physicalLimitations: [],
      dietaryPreference,
      allergies: allergies.trim() ? allergies.split(",").map((s) => s.trim()) : [],
      dislikedFoods: [],
      cuisinePreferences: [],
      budgetTier: budgetTier!,
    });
    navigation.navigate("BodyPhotos");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 16 }}>
      <Text style={styles.title}>Fitness & health</Text>

      <Text style={styles.label}>Training experience</Text>
      <View style={styles.row}>
        {EXPERIENCE.map((lvl) => (
          <Chip key={lvl} label={lvl} selected={experienceLevel === lvl} onPress={() => setExperienceLevel(lvl)} />
        ))}
      </View>

      <Text style={styles.label}>Where do you train?</Text>
      <View style={styles.row}>
        {ENVIRONMENTS.map((env) => (
          <Chip key={env} label={env} selected={trainingEnvironment === env} onPress={() => setTrainingEnvironment(env)} />
        ))}
      </View>

      <Text style={styles.label}>Workout days per week</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={workoutDaysPerWeek} onChangeText={setWorkoutDaysPerWeek} placeholder="e.g. 4" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Session duration (minutes)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={sessionDurationMin} onChangeText={setSessionDurationMin} placeholder="e.g. 60" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Injuries or physical limitations</Text>
      <Text style={styles.helper}>Leave blank if none. This can route you to a more conservative plan.</Text>
      <TextInput style={styles.input} value={injuries} onChangeText={setInjuries} placeholder="e.g. lower back, left knee" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Dietary preference</Text>
      <TextInput style={styles.input} value={dietaryPreference} onChangeText={setDietaryPreference} placeholder="e.g. vegetarian, omnivore" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Allergies</Text>
      <TextInput style={styles.input} value={allergies} onChangeText={setAllergies} placeholder="e.g. peanuts, shellfish" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Food budget</Text>
      <Text style={styles.helper}>Your nutrition plan will only suggest food within this range.</Text>
      <View style={styles.row}>
        {BUDGETS.map((b) => (
          <Chip key={b.value} label={b.label} selected={budgetTier === b.value} onPress={() => setBudgetTier(b.value)} />
        ))}
      </View>

      <PrimaryButton label="Continue" onPress={handleContinue} disabled={!canContinue} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: 8 },
  helper: { fontSize: 12, color: colors.textMuted, marginTop: -8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
