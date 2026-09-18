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
import { useOnboarding } from "@/store/OnboardingContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "BodyPhotos">;

const ANGLES: { label: string; value: "FRONT" | "BACK" | "LEFT" | "RIGHT" }[] = [
  { label: "Front", value: "FRONT" },
  { label: "Back", value: "BACK" },
  { label: "Left side", value: "LEFT" },
  { label: "Right side", value: "RIGHT" },
];
type Angle = "FRONT" | "BACK" | "LEFT" | "RIGHT";

export function BodyPhotosScreen({ navigation }: Props) {
  const { bodyPhotos, setBodyPhotos } = useOnboarding();
  const [photos, setPhotos] = useState<Partial<Record<Angle, string>>>(bodyPhotos || {});

  async function takeWithCamera(angle: Angle, label: string) {
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

  async function pickFromDevice(angle: Angle, label: string) {
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

  function handleTilePress(angle: Angle, label: string) {
    Alert.alert(
      `${label} photo`,
      "Choose how you want to add this photo:",
      [
        {
          text: "Upload from device",
          onPress: () => pickFromDevice(angle, label),
        },
        {
          text: "Take with camera",
          onPress: () => takeWithCamera(angle, label),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }

  const canContinue = ANGLES.every((a) => photos[a.value]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40, gap: 16 }}
    >
      <Text style={styles.title}>Current body photos</Text>
      <Text style={styles.subtitle}>
        Use consistent lighting, distance, and posture. These establish your baseline and are stored privately.
      </Text>

      <View style={styles.grid}>
        {ANGLES.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            activeOpacity={0.8}
            style={[styles.tile, photos[value] ? styles.tileFilled : null]}
            onPress={() => handleTilePress(value, label)}
          >
            {photos[value] ? (
              <>
                <Image source={{ uri: photos[value] }} style={styles.image} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{label} ✓</Text>
                </View>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={styles.angleText}>{label}</Text>
                <Text style={styles.tileAction}>Tap to add</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        <PrimaryButton
          label="Continue"
          disabled={!canContinue}
          onPress={() => {
            setBodyPhotos(photos as any);
            navigation.navigate("TargetPhoto");
          }}
        />
        {!canContinue && (
          <PrimaryButton
            label="Skip for now"
            variant="secondary"
            onPress={() => {
              setBodyPhotos(photos as any);
              navigation.navigate("TargetPhoto");
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  title: { ...typography.h1, color: colors.bone },
  subtitle: { ...typography.body, color: colors.ash },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: {
    width: "47%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  tileFilled: {
    borderColor: colors.moss,
    borderWidth: 1,
  },
  placeholderContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 6,
  },
  angleText: {
    color: colors.bone,
    fontWeight: "600",
    fontSize: 14,
  },
  tileAction: {
    color: colors.ash,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    position: "absolute",
    bottom: 8,
    backgroundColor: "rgba(20, 19, 15, 0.85)",
    borderColor: colors.moss,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: colors.bone,
    fontSize: 11,
    fontWeight: "500",
  },
  image: { width: "100%", height: "100%" },
});
