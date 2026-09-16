import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "BodyPhotos">;

const ANGLES = ["FRONT", "BACK", "LEFT", "RIGHT"] as const;
type Angle = (typeof ANGLES)[number];

export function BodyPhotosScreen({ navigation }: Props) {
  const [photos, setPhotos] = useState<Partial<Record<Angle, string>>>({});

  async function takeWithCamera(angle: Angle) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => ({ ...prev, [angle]: result.assets[0].uri }));
    }
  }

  async function pickFromDevice(angle: Angle) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Gallery permission is required to select photos from your device.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => ({ ...prev, [angle]: result.assets[0].uri }));
    }
  }

  function handleTilePress(angle: Angle) {
    Alert.alert(
      `${angle} View Photo`,
      "Choose how you want to add this photo:",
      [
        {
          text: "Upload from Device",
          onPress: () => pickFromDevice(angle),
        },
        {
          text: "Take with Camera",
          onPress: () => takeWithCamera(angle),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }

  const canContinue = ANGLES.every((a) => photos[a]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40, gap: 16 }}
    >
      <Text style={styles.title}>Current body photos</Text>
      <Text style={styles.subtitle}>
        Use consistent lighting, distance, and clothing across all four — this is
        what makes later progress comparisons meaningful. Stored privately and
        never shared.
      </Text>

      <View style={styles.grid}>
        {ANGLES.map((angle) => (
          <TouchableOpacity
            key={angle}
            activeOpacity={0.8}
            style={[styles.tile, photos[angle] ? styles.tileFilled : null]}
            onPress={() => handleTilePress(angle)}
          >
            {photos[angle] ? (
              <>
                <Image source={{ uri: photos[angle] }} style={styles.image} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{angle} ✓</Text>
                </View>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.angleText}>{angle}</Text>
                <Text style={styles.tileAction}>Tap to upload or take photo</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        <PrimaryButton
          label="Continue"
          disabled={!canContinue}
          onPress={() => navigation.navigate("TargetPhoto")}
        />
        {!canContinue && (
          <PrimaryButton
            label="Skip for now"
            variant="secondary"
            onPress={() => navigation.navigate("TargetPhoto")}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: {
    width: "47%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  tileFilled: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  placeholderContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
  },
  angleText: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  tileAction: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
  },
  badge: {
    position: "absolute",
    bottom: 8,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
  image: { width: "100%", height: "100%" },
});
