import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useOnboarding } from "@/store/OnboardingContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import type { FitnessGoal } from "@/types/models";

type Props = NativeStackScreenProps<OnboardingStackParamList, "GoalSelection">;

const GOALS: { label: string; value: FitnessGoal; description: string }[] = [
  { label: "Fat loss", value: "FAT_LOSS", description: "Reduce body fat while preserving muscle" },
  { label: "Muscle gain", value: "MUSCLE_GAIN", description: "Build size and strength" },
  { label: "Recomposition", value: "RECOMPOSITION", description: "Lose fat and build muscle together" },
  { label: "Strength", value: "STRENGTH", description: "Get stronger on key lifts" },
  { label: "Endurance", value: "ENDURANCE", description: "Improve cardiovascular capacity" },
  { label: "General fitness", value: "GENERAL_FITNESS", description: "Feel and move better overall" },
  { label: "Athletic performance", value: "ATHLETIC_PERFORMANCE", description: "Train for a sport or activity" },
  { label: "Maintenance", value: "MAINTENANCE", description: "Stay where you are, consistently" },
];

export function GoalSelectionScreen({ navigation }: Props) {
  const { setGoal } = useOnboarding();
  const [selected, setSelected] = useState<FitnessGoal | null>(null);

  function handleContinue() {
    if (!selected) return;
    setGoal({ type: selected, isPrimary: true });
    navigation.navigate("Questionnaire");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 12 }}>
      <Text style={styles.title}>What's your primary goal?</Text>
      <Text style={styles.subtitle}>You can adjust this later as your plan adapts.</Text>
      {GOALS.map((goal) => {
        const isSelected = selected === goal.value;
        return (
          <View
            key={goal.value}
            style={[styles.card, isSelected && styles.cardSelected]}
            onTouchEnd={() => setSelected(goal.value)}
          >
            <Text style={styles.cardTitle}>{goal.label}</Text>
            <Text style={styles.cardDescription}>{goal.description}</Text>
          </View>
        );
      })}
      <PrimaryButton label="Continue" onPress={handleContinue} disabled={!selected} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.primary },
  cardTitle: { ...typography.h2, color: colors.textPrimary, fontSize: 16 },
  cardDescription: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
});
