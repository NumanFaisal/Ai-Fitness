import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useOnboarding } from "@/store/OnboardingContext";
import { endpoints } from "@/api/endpoints";
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
  const {
    profile,
    goal,
    bodyPhotos,
    setBodyPhotos,
    userPhysiqueAnalysis,
    setUserPhysiqueAnalysis,
  } = useOnboarding();
  const [photos, setPhotos] = useState<Partial<Record<Angle, string>>>(bodyPhotos || {});
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(userPhysiqueAnalysis || null);

  async function analyzePhotoAsync(base64Data: string, angle: Angle) {
    setScanning(true);
    try {
      const res = await endpoints.analyzeUserBodyPhoto({
        imageBase64: base64Data,
        angle,
        heightCm: profile.heightCm || 175,
        currentWeightKg: profile.weightKg || 75,
        sex: profile.sex || "MALE",
        age: profile.age || 25,
        goal: goal?.type || "RECOMPOSITION",
      });
      if (res) {
        setScanResult(res);
        setUserPhysiqueAnalysis(res);
      }
    } catch (err) {
      console.warn("Body photo scan notice:", err);
    } finally {
      setScanning(false);
    }
  }

  async function takeWithCamera(angle: Angle, label: string) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const base64 = result.assets[0].base64
        ? `data:image/jpeg;base64,${result.assets[0].base64}`
        : uri;
      setPhotos((prev) => ({ ...prev, [angle]: base64 }));
      analyzePhotoAsync(base64, angle);
    }
  }

  async function pickFromDevice(angle: Angle, label: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Gallery permission is required to select photos from your device.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const base64 = result.assets[0].base64
        ? `data:image/jpeg;base64,${result.assets[0].base64}`
        : uri;
      setPhotos((prev) => ({ ...prev, [angle]: base64 }));
      analyzePhotoAsync(base64, angle);
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

  const canContinue = ANGLES.some((a) => photos[a.value]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40, gap: 16 }}
    >
      <Text style={styles.title}>Current body photos</Text>
      <Text style={styles.subtitle}>
        Upload or take a photo. Our vision AI analyzes body composition, posture, and muscular leverage to dynamically build your workout and diet.
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

      {/* AI Vision Scan Status & Feedback */}
      {scanning && (
        <View style={styles.scanCard}>
          <ActivityIndicator size="small" color={colors.moss} />
          <Text style={styles.scanText}>Analyzing posture, frame & body fat from photo...</Text>
        </View>
      )}

      {!scanning && scanResult && (
        <View style={styles.scanResultCard}>
          <View style={styles.scanHeaderRow}>
            <View style={styles.scanTag}>
              <Text style={styles.scanTagText}>AI VISION SCAN</Text>
            </View>
            <Text style={styles.bfText}>~{scanResult.estimatedBodyFatPct}% Body Fat ({scanResult.bodyFatCategory || "Athletic"})</Text>
          </View>
          <Text style={styles.scanNarrative}>{scanResult.summaryNarrative}</Text>
          {scanResult.developmentPriorityMuscles && (
            <View style={styles.priorityRow}>
              <Text style={styles.priorityLabel}>Priority Muscle Groups:</Text>
              <Text style={styles.priorityValue}>
                {scanResult.developmentPriorityMuscles.slice(0, 3).join(" • ")}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={{ gap: 12, marginTop: 8 }}>
        <PrimaryButton
          label="Continue"
          disabled={!canContinue}
          onPress={() => {
            setBodyPhotos(photos as any);
            if (scanResult) setUserPhysiqueAnalysis(scanResult);
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
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(107, 142, 35, 0.12)",
    borderColor: colors.moss,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  scanText: {
    color: colors.bone,
    fontSize: 13,
    flex: 1,
  },
  scanResultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.moss,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  scanHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scanTag: {
    backgroundColor: colors.moss,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scanTagText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bfText: {
    color: colors.moss,
    fontSize: 13,
    fontWeight: "600",
  },
  scanNarrative: {
    color: colors.ash,
    fontSize: 13,
    lineHeight: 18,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginTop: 2,
  },
  priorityLabel: {
    color: colors.bone,
    fontSize: 12,
    fontWeight: "600",
  },
  priorityValue: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: "500",
  },
});

