import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, View } from "react-native";
import { useTheme } from "@/store/ThemeContext";

interface Props {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "glass" | "destructive";
  size?: "regular" | "large" | "small";
}

export function PrimaryButton({
  label,
  onPress,
  style,
  disabled,
  loading,
  variant = "primary",
  size = "regular",
}: Props) {
  const { colors, isDark } = useTheme();

  const isSecondary = variant === "secondary";
  const isGlass = variant === "glass";
  const isDestructive = variant === "destructive";

  function getContainerStyle(): ViewStyle {
    if (variant === "primary") {
      return {
        backgroundColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.45 : 0.30,
        shadowRadius: 14,
        elevation: 8,
      };
    }
    if (variant === "destructive") {
      return {
        backgroundColor: colors.danger,
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
      };
    }
    if (variant === "glass") {
      return {
        backgroundColor: colors.glassBackground,
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
      };
    }
    // secondary
    return {
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      borderWidth: 0.5,
      borderColor: colors.border,
    };
  }

  function getLabelColor(): string {
    if (variant === "primary" || variant === "destructive") return "#FFFFFF";
    return colors.textPrimary;
  }

  const sizeStyle = (): ViewStyle => {
    if (size === "large") return { paddingVertical: 17, borderRadius: 16 };
    if (size === "small") return { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 };
    return { paddingVertical: 14, borderRadius: 14 };
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyle(),
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "destructive" ? "#FFFFFF" : colors.textPrimary}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            size === "large" && styles.labelLarge,
            size === "small" && styles.labelSmall,
            { color: getLabelColor() },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  disabled: { opacity: 0.38 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  labelLarge: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  labelSmall: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
});
