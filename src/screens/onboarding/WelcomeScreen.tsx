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
  React.useEffect(() => {
    AsyncStorage.getItem("auth_token").then((token) => {
      if (token) {
        navigation.replace("ProfileSetup");
      }
    });
  }, [navigation]);

  async function handleGetStarted() {
    const token = await AsyncStorage.getItem("auth_token");
    if (token) {
      navigation.navigate("ProfileSetup");
    } else {
      navigation.navigate("AccountCreation");
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ gap: 12 }}>
        <Text style={styles.title}>Your transformation, coached honestly.</Text>
        <Text style={styles.subtitle}>
          Real plans from your real data. No fake numbers, no guaranteed
          outcomes — just a coach that adapts as you actually progress.
        </Text>
      </View>
      <PrimaryButton label="Get started" onPress={handleGetStarted} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    padding: 24,
    justifyContent: "space-between",
    paddingTop: 120,
    paddingBottom: 48,
  },
  title: { ...typography.h1, color: colors.bone },
  subtitle: { ...typography.body, color: colors.ash },
});
