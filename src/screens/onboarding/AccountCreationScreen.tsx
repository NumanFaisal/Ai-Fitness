import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { endpoints } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "AccountCreation">;

export function AccountCreationScreen({ navigation }: Props) {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem("auth_token").then((token) => {
      if (token) {
        navigation.replace("ProfileSetup");
      }
    });
  }, [navigation]);

  async function handleSubmit() {
    if (!email.includes("@") || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const res = await endpoints.login(email.trim(), password);
        if (res.token) {
          await AsyncStorage.setItem("auth_token", res.token);
          const status = await endpoints.getUserStatus();
          if (status?.hasPlan || status?.hasCompletedOnboarding) {
            await AsyncStorage.setItem("has_completed_onboarding", "true");
            navigation.getParent()?.navigate("Main" as never);
            return;
          }
        }
        navigation.navigate("ProfileSetup");
      } else {
        const res = await endpoints.register(email.trim(), password);
        if (res.token) {
          await AsyncStorage.setItem("auth_token", res.token);
        }
        navigation.navigate("ProfileSetup");
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || "Authentication failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>{isLogin ? "Welcome back" : "Create your account"}</Text>
        <Text style={styles.subtitle}>
          {isLogin
            ? "Log in to access your customized fitness plan & workout logs."
            : "Sign up to begin your personalized health & body transformation."}
        </Text>

        <View style={{ gap: 12, marginTop: 24 }}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password (min 6 characters)</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>

      <View style={{ gap: 16 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brass} />
        ) : (
          <PrimaryButton
            label={isLogin ? "Log in" : "Create account & continue"}
            onPress={handleSubmit}
          />
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            setError(null);
            setIsLogin(!isLogin);
          }}
          style={styles.toggleBtn}
        >
          <Text style={styles.toggleText}>
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Log in"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    padding: 24,
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 48,
  },
  title: { ...typography.h1, color: colors.bone },
  subtitle: { ...typography.body, color: colors.ash, fontSize: 14, marginTop: 6 },
  label: { ...typography.label, color: colors.ash, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    color: colors.bone,
    borderWidth: 1,
    borderColor: colors.divider,
    fontSize: 15,
  },
  error: { color: colors.rust, fontSize: 13, marginTop: 4 },
  toggleBtn: { alignItems: "center", paddingVertical: 8 },
  toggleText: { color: colors.brass, fontSize: 14, fontWeight: "500" },
});
