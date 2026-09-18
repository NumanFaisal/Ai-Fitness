import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/store/ThemeContext";
import type { DataProvenance } from "@/types/models";

// Makes data provenance visible in the UI, not just enforced internally —
// an estimated or wearable-sourced number should never look identical to a
// deterministic calculation or something the user typed themselves.
const LABELS: Record<DataProvenance, string> = {
  USER_PROVIDED: "You entered this",
  CALCULATED: "Calculated",
  WEARABLE: "From your device",
  OBSERVED: "From your photo",
  ESTIMATED: "Estimate",
};

export function ProvenanceBadge({
  provenance,
  confidence,
}: {
  provenance: DataProvenance;
  confidence?: number;
}) {
  const { colors } = useTheme();
  const isEstimate = provenance === "ESTIMATED";

  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: isEstimate ? colors.estimated : colors.glassBorder,
          backgroundColor: isEstimate
            ? colors.warningMuted
            : colors.glassBackground,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: isEstimate ? colors.warning : colors.textSecondary },
        ]}
      >
        {LABELS[provenance]}
        {isEstimate && confidence != null
          ? ` · ${Math.round(confidence * 100)}%`
          : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "500" },
});
