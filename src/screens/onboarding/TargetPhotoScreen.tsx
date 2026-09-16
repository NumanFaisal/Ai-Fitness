import React, { useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TargetPhoto">;

export function TargetPhotoScreen({ navigation }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setUri(result.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      <View style={{ gap: 12 }}>
        <Text style={styles.title}>Target physique (optional)</Text>
        <Text style={styles.subtitle}>
          A visual reference for training direction — not a promised outcome.
          Genetics, starting point, and training history all affect what's
          realistically achievable for you.
        </Text>
        <View style={styles.tile} onTouchEnd={pickPhoto}>
          {uri ? (
            <Image source={{ uri }} style={styles.image} />
          ) : (
            <Text style={styles.tileLabel}>Tap to choose a reference photo</Text>
          )}
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <PrimaryButton label="Continue" onPress={() => navigation.navigate("ReviewGenerate")} />
        {!uri && (
          <PrimaryButton
            label="Skip this step"
            variant="secondary"
            onPress={() => navigation.navigate("ReviewGenerate")}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60, paddingBottom: 48, justifyContent: "space-between" },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  tile: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileLabel: { color: colors.textMuted, textAlign: "center", fontSize: 13, padding: 16 },
  image: { width: "100%", height: "100%" },
});
