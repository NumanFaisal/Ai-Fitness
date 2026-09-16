import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={{ gap: 12 }}>
        <Text style={styles.title}>Your transformation, coached honestly.</Text>
        <Text style={styles.subtitle}>
          Real plans from your real data. No fake numbers, no guaranteed
          outcomes — just a coach that adapts as you actually progress.
        </Text>
      </View>
      <PrimaryButton label="Get started" onPress={() => navigation.navigate("AccountCreation")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "space-between",
    paddingTop: 120,
    paddingBottom: 48,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
});
