import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { EmptyState } from "@/components/EmptyState";
import { useOnboarding } from "@/store/OnboardingContext";
import { endpoints } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ReviewGenerate">;

type Phase = "idle" | "submitting" | "error";

export function ReviewGenerateScreen({ navigation }: Props) {
  const {
    profile,
    fitnessProfile,
    goal,
    targetWeightKg,
    targetPhotoUri,
    targetPhysiqueAnalysis,
  } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGenerate() {
    setPhase("submitting");
    setErrorMessage(null);
    try {
      const profileToSubmit = {
        ...profile,
        targetWeightKg,
        targetPhotoUri,
        targetPhysique: targetPhysiqueAnalysis,
      };
      await endpoints.submitProfile(profileToSubmit as any);
      await endpoints.submitFitnessProfile(fitnessProfile as any);
      if (goal) await endpoints.submitGoal(goal);
      await endpoints.generatePlan();
      await AsyncStorage.setItem("has_completed_onboarding", "true");
      navigation.getParent()?.navigate("Main" as never);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setErrorMessage(message);
      setPhase("error");
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ gap: 16 }}>
        <Text style={styles.title}>Ready to generate your plan</Text>
        <Text style={styles.subtitle}>
          We'll build your training, nutrition, cardio, and hydration plan
          from everything you've entered. This runs in the background —
          you'll get a notification when it's ready.
        </Text>

        {phase === "error" && errorMessage && (
          <EmptyState
            title="Couldn't generate your plan"
            description={errorMessage}
          />
        )}
      </View>

      <View style={{ gap: 12 }}>
        {phase === "submitting" ? (
          <ActivityIndicator color={colors.brass} />
        ) : (
          <PrimaryButton label="Generate my plan" onPress={handleGenerate} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink, padding: 24, paddingTop: 80, paddingBottom: 48, justifyContent: "space-between" },
  title: { ...typography.h1, color: colors.bone },
  subtitle: { ...typography.body, color: colors.ash, marginTop: 8 },
});
