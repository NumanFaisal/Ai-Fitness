import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
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
  const isEstimate = provenance === "ESTIMATED";
  return (
    <View
      style={[
        styles.badge,
        { borderColor: isEstimate ? colors.estimated : colors.border },
      ]}
    >
      <Text style={[styles.text, isEstimate && { color: colors.estimated }]}>
        {LABELS[provenance]}
        {isEstimate && confidence != null ? ` · ${Math.round(confidence * 100)}% confidence` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, color: colors.textMuted },
});
