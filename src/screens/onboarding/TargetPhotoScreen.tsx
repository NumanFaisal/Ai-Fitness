import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
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

type Props = NativeStackScreenProps<OnboardingStackParamList, "TargetPhoto">;

export function TargetPhotoScreen({ navigation }: Props) {
  const {
    profile,
    goal,
    targetPhotoUri,
    targetWeightKg,
    targetPhysiqueAnalysis,
    setTargetPhotoUri,
    setTargetWeightKg,
    setTargetPhysiqueAnalysis,
  } = useOnboarding();

  const [uri, setUri] = useState<string | null>(targetPhotoUri || null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(targetPhysiqueAnalysis || null);
  const [manualTargetWeight, setManualTargetWeight] = useState<string>(
    targetWeightKg ? String(targetWeightKg) : ""
  );

  async function pickAndAnalyzePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Gallery permission is needed to select a target physique photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUri(asset.uri);
      setTargetPhotoUri(asset.uri);

      // Perform AI Physique & Target Weight Vision Analysis
      setAnalyzing(true);
      try {
        const base64Data = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : undefined;

        const res = await endpoints.analyzeTargetPhysique({
          imageBase64: base64Data,
          heightCm: profile.heightCm || 175,
          currentWeightKg: profile.weightKg || 75,
          sex: profile.sex || "MALE",
          goal: goal?.type || "RECOMPOSITION",
        });

        if (res) {
          setAnalysis(res);
          setTargetPhysiqueAnalysis(res);
          setManualTargetWeight(String(res.targetWeightKg));
          setTargetWeightKg(res.targetWeightKg);
        }
      } catch (err) {
        console.warn("Target image analysis error:", err);
        // Calculate sports-science estimate as fallback
        const currentW = profile.weightKg || 75;
        const targetW = goal?.type === "FAT_LOSS" ? Math.round(currentW * 0.88) : Math.round(currentW + 4);
        setManualTargetWeight(String(targetW));
        setTargetWeightKg(targetW);
      } finally {
        setAnalyzing(false);
      }
    }
  }

  function handleContinue() {
    if (manualTargetWeight && Number(manualTargetWeight) > 0) {
      setTargetWeightKg(Number(manualTargetWeight));
    }
    navigation.navigate("ReviewGenerate");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40, gap: 16 }}
    >
      <View style={{ gap: 6 }}>
        <Text style={styles.title}>Target physique & weight</Text>
        <Text style={styles.subtitle}>
          Upload a visual reference photo. Our AI vision analyzes the body composition,
          estimates body fat %, and calculates a realistic target weight and muscle-group focus.
        </Text>
      </View>

      {/* Target Image Picker */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.tile, uri ? styles.tileActive : null]}
        onPress={pickAndAnalyzePhoto}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.image as any} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.cameraIcon}>📸</Text>
            <Text style={styles.tileTitle}>Tap to select target reference photo</Text>
            <Text style={styles.tileSubtitle}>Celebrity, athlete, or physique benchmark</Text>
          </View>
        )}

        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.analyzingText}>AI Vision Analyzing Physique...</Text>
            <Text style={styles.analyzingSubtext}>Estimating body fat & calculating target weight</Text>
          </View>
        )}
      </TouchableOpacity>

      {uri && (
        <TouchableOpacity
          onPress={pickAndAnalyzePhoto}
          style={styles.changePhotoBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.changePhotoText}>Change Reference Photo</Text>
        </TouchableOpacity>
      )}

      {/* Target Weight Input & Review Card */}
      <View style={styles.weightCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Calibrated Target Weight</Text>
          {analysis && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI Vision Calibrated</Text>
            </View>
          )}
        </View>

        <Text style={styles.weightHelper}>
          {analysis
            ? "Calculated based on your height, current body weight, and the physique archetype in your reference image."
            : "Enter your desired target weight (kg). You can adjust this at any time."}
        </Text>

        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Current Weight</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{profile.weightKg || 75} kg</Text>
            </View>
          </View>

          <Text style={styles.arrowIcon}>➔</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Target Weight (kg)</Text>
            <TextInput
              style={styles.weightInput}
              keyboardType="decimal-pad"
              value={manualTargetWeight}
              onChangeText={(val) => {
                setManualTargetWeight(val);
                if (Number(val) > 0) setTargetWeightKg(Number(val));
              }}
              placeholder="e.g. 72"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
      </View>

      {/* AI Physique Analysis Results */}
      {analysis && (
        <View style={styles.analysisCard}>
          <Text style={styles.aestheticTitle}>{analysis.physiqueAesthetic}</Text>
          <Text style={styles.analysisDesc}>{analysis.description}</Text>

          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>~{analysis.targetBodyFatPct}%</Text>
              <Text style={styles.metricLabel}>Target Body Fat</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{analysis.estimatedWeeks} wks</Text>
              <Text style={styles.metricLabel}>Realistic Timeline</Text>
            </View>
          </View>

          <Text style={styles.musclesHeading}>Target Muscle Focus (5-6 Exercises/Session):</Text>
          <View style={styles.chipsContainer}>
            {analysis.standoutMuscles?.map((muscle: string, i: number) => (
              <View key={i} style={styles.muscleChip}>
                <Text style={styles.muscleChipText}>✓ {muscle}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Navigation Actions */}
      <View style={{ gap: 12, marginTop: 8 }}>
        <PrimaryButton label="Continue" onPress={handleContinue} />
        {!uri && (
          <PrimaryButton
            label="Skip photo and continue"
            variant="secondary"
            onPress={handleContinue}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  tile: {
    height: 240,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  tileActive: {
    borderStyle: "solid",
    borderColor: colors.primary,
  },
  placeholderContainer: {
    alignItems: "center",
    padding: 16,
    gap: 6,
  },
  cameraIcon: { fontSize: 36, marginBottom: 4 },
  tileTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 14, textAlign: "center" },
  tileSubtitle: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  image: { width: "100%", height: "100%" },
  changePhotoBtn: { alignSelf: "center", paddingVertical: 4 },
  changePhotoText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  analyzingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 15, 29, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },
  analyzingText: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  analyzingSubtext: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
  weightCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  aiBadge: {
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  aiBadgeText: { color: colors.success, fontSize: 10, fontWeight: "700" },
  weightHelper: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  readOnlyInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  readOnlyText: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  arrowIcon: { color: colors.primary, fontSize: 16, fontWeight: "900", marginTop: 14 },
  weightInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: colors.brass,
    textAlign: "center",
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  aestheticTitle: { color: colors.bone, fontWeight: "600", fontSize: 15 },
  analysisDesc: { color: colors.ash, fontSize: 12, lineHeight: 17 },
  metricRow: { flexDirection: "row", gap: 12, marginVertical: 4 },
  metricBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricVal: { fontSize: 16, fontWeight: "600", color: colors.bone },
  metricLabel: { color: colors.ash, fontSize: 11, marginTop: 2 },
  musclesHeading: { color: colors.bone, fontWeight: "600", fontSize: 13, marginTop: 4 },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  muscleChip: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleChipText: { color: colors.ash, fontSize: 11, fontWeight: "500" },
});
