import React from "react";
import { View, StyleSheet } from "react-native";

interface IconProps {
  color: string;
  focused: boolean;
  size?: number;
}

/**
 * 1. Today Dashboard Icon (2x2 Clean Minimalist Command Grid)
 */
export function TodayTabIcon({ color, focused, size = 22 }: IconProps) {
  const boxSize = 8;
  const gap = 3;
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ flexDirection: "row", gap }}>
        <View
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: focused ? 1 : 0.65,
          }}
        />
        <View
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: focused ? 1 : 0.65,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", gap, marginTop: gap }}>
        <View
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: focused ? 1 : 0.65,
          }}
        />
        <View
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: focused ? 1 : 0.65,
          }}
        />
      </View>
    </View>
  );
}

/**
 * 2. Workout Barbell Icon (Sleek Athletic Barbell Geometry)
 */
export function WorkoutTabIcon({ color, focused, size = 22 }: IconProps) {
  return (
    <View style={[styles.center, { width: size, height: size, flexDirection: "row", alignItems: "center" }]}>
      {/* Outer Left Plate */}
      <View style={{ width: 3, height: 16, borderRadius: 1.5, backgroundColor: color }} />
      {/* Inner Left Plate */}
      <View style={{ width: 2.5, height: 12, borderRadius: 1, backgroundColor: color, marginLeft: 1.5 }} />
      {/* Center Bar */}
      <View style={{ flex: 1, height: 3, backgroundColor: color, opacity: focused ? 1 : 0.7 }} />
      {/* Inner Right Plate */}
      <View style={{ width: 2.5, height: 12, borderRadius: 1, backgroundColor: color, marginRight: 1.5 }} />
      {/* Outer Right Plate */}
      <View style={{ width: 3, height: 16, borderRadius: 1.5, backgroundColor: color }} />
    </View>
  );
}

/**
 * 3. Nutrition Icon (Modern Plate & Nutrition Geometry)
 */
export function NutritionTabIcon({ color, focused, size = 22 }: IconProps) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Outer Circle Ring */}
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Inner Core Macro Dot */}
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: focused ? 1 : 0.5,
          }}
        />
      </View>
    </View>
  );
}

/**
 * 4. Coach Icon (Pulse Waveform & Adaptive Intelligence)
 */
export function CoachTabIcon({ color, focused, size = 22 }: IconProps) {
  return (
    <View style={[styles.center, { width: size, height: size, flexDirection: "row", alignItems: "center", gap: 2.5 }]}>
      <View style={{ width: 2.5, height: 6, borderRadius: 1.5, backgroundColor: color, opacity: 0.7 }} />
      <View style={{ width: 2.5, height: 13, borderRadius: 1.5, backgroundColor: color, opacity: 0.9 }} />
      <View style={{ width: 2.5, height: 19, borderRadius: 1.5, backgroundColor: color }} />
      <View style={{ width: 2.5, height: 13, borderRadius: 1.5, backgroundColor: color, opacity: 0.9 }} />
      <View style={{ width: 2.5, height: 6, borderRadius: 1.5, backgroundColor: color, opacity: 0.7 }} />
    </View>
  );
}

/**
 * 5. Profile Icon (Athletic Silhouette)
 */
export function ProfileTabIcon({ color, focused, size = 22 }: IconProps) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Head */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          marginBottom: 2,
        }}
      />
      {/* Shoulders / Torso */}
      <View
        style={{
          width: 16,
          height: 8,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          backgroundColor: color,
          opacity: focused ? 1 : 0.7,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
