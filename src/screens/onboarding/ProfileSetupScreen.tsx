import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useOnboarding } from "@/store/OnboardingContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import type { Sex } from "@/types/models";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ProfileSetup">;

const SEX_OPTIONS: { label: string; value: Sex }[] = [
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
  { label: "Other", value: "OTHER" },
  { label: "Prefer not to say", value: "PREFER_NOT_TO_SAY" },
];

export function ProfileSetupScreen({ navigation }: Props) {
  const { setProfile } = useOnboarding();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const canContinue =
    name.trim().length > 0 &&
    Number(age) > 0 &&
    sex !== null &&
    Number(heightCm) > 0 &&
    Number(weightKg) > 0;

  function handleContinue() {
    setProfile({
      name,
      age: Number(age),
      sex: sex!,
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
    });
    navigation.navigate("GoalSelection");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 16 }}>
      <Text style={styles.title}>Tell us about you</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Age</Text>
      <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 27" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Biological sex</Text>
      <Text style={styles.helper}>Used only for calorie/hydration calculations — never shared or shown elsewhere.</Text>
      <View style={styles.row}>
        {SEX_OPTIONS.map((opt) => (
          <PrimaryButton
            key={opt.value}
            label={opt.label}
            variant={sex === opt.value ? "primary" : "secondary"}
            onPress={() => setSex(opt.value)}
            style={styles.chip}
          />
        ))}
      </View>

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput style={styles.input} value={heightCm} onChangeText={setHeightCm} keyboardType="number-pad" placeholder="e.g. 175" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Current Weight (kg)</Text>
      <Text style={styles.helper}>Critical for calculating your exact basal metabolic rate (BMR), protein intake, and hydration needs.</Text>
      <TextInput style={styles.input} value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" placeholder="e.g. 75" placeholderTextColor={colors.textMuted} />

      <PrimaryButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  title: { ...typography.h1, color: colors.bone },
  label: { ...typography.label, color: colors.ash, marginTop: 12, marginBottom: 4 },
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
  chip: { paddingVertical: 8, paddingHorizontal: 12 },
});
