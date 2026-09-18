import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/store/ThemeContext";
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
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.glassBackground,
          borderColor: colors.glassBorder,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          style={styles.action}
          size="small"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "left",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  action: { marginTop: 10 },
});
