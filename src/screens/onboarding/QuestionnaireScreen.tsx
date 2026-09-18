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

const EXPERIENCE: { label: string; value: ExperienceLevel }[] = [
  { label: "Beginner", value: "BEGINNER" },
  { label: "Intermediate", value: "INTERMEDIATE" },
  { label: "Advanced", value: "ADVANCED" },
];
const ENVIRONMENTS: { label: string; value: TrainingEnvironment }[] = [
  { label: "Gym", value: "GYM" },
  { label: "Home", value: "HOME" },
  { label: "Outdoor", value: "OUTDOOR" },
];
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
          <Chip key={lvl.value} label={lvl.label} selected={experienceLevel === lvl.value} onPress={() => setExperienceLevel(lvl.value)} />
        ))}
      </View>

      <Text style={styles.label}>Where do you train?</Text>
      <View style={styles.row}>
        {ENVIRONMENTS.map((env) => (
          <Chip key={env.value} label={env.label} selected={trainingEnvironment === env.value} onPress={() => setTrainingEnvironment(env.value)} />
        ))}
      </View>

      <Text style={styles.label}>Workout days per week</Text>
      <View style={styles.row}>
        {["3", "4", "5", "6"].map((d) => (
          <Chip
            key={d}
            label={`${d} days`}
            selected={workoutDaysPerWeek === d}
            onPress={() => setWorkoutDaysPerWeek(d)}
          />
        ))}
      </View>
      <TextInput
        style={[styles.input, { marginTop: 6 }]}
        keyboardType="number-pad"
        value={workoutDaysPerWeek}
        onChangeText={setWorkoutDaysPerWeek}
        placeholder="e.g. 5 or 6 days"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Session duration (minutes)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={sessionDurationMin} onChangeText={setSessionDurationMin} placeholder="e.g. 60" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Injuries or physical limitations</Text>
      <Text style={styles.helper}>Leave blank if none. This routes you to a conservative baseline.</Text>
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
  container: { flex: 1, backgroundColor: colors.ink },
  title: { ...typography.h1, color: colors.bone },
  label: { ...typography.label, color: colors.ash, marginTop: 12, marginBottom: 6 },
  helper: { fontSize: 13, color: colors.ash, marginBottom: 8, lineHeight: 18 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.bone,
    borderWidth: 1,
    borderColor: colors.divider,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
