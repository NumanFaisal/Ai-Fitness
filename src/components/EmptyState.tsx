import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "./PrimaryButton";

// The canonical "no dummy data" pattern. Any screen with nothing real to
// show renders this instead of a placeholder/fake number. See
// docs/PROJECT_CONTEXT.md.
interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: 8,
  },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: "center" },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  action: { marginTop: 12 },
});
