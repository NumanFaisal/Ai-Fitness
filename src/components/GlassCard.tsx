import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/store/ThemeContext";

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Extra glass strength — increases border and highlight opacity */
  strong?: boolean;
  /** Remove padding (for full-bleed content) */
  noPadding?: boolean;
}

/**
 * GlassCard — Apple glassmorphism surface.
 * Uses semi-transparent backgrounds + subtle border + inner top highlight
 * to simulate frosted-glass without expo-blur dependency.
 */
export function GlassCard({ children, style, strong = false, noPadding = false }: GlassCardProps) {
  const { colors, isDark } = useTheme();

  const bg = strong ? colors.glassBackground : colors.glassBackgroundLight;
  const border = strong ? colors.glassBorderStrong : colors.glassBorder;
  const highlight = isDark
    ? strong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)"
    : strong ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.55)";

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
        },
        !noPadding && styles.padding,
        style,
      ]}
    >
      {/* Inner top highlight shimmer — simulates frosted glass catch-light */}
      <View
        style={[
          styles.highlight,
          {
            backgroundColor: highlight,
          },
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 0.5,
    overflow: "hidden",
    position: "relative",
  },
  padding: {
    padding: 16,
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
});
