// Apple SF Pro-inspired type scale
// Mirrors iOS Human Interface Guidelines font ramp

export const typography = {
  // Display / Navigation
  largeTitle: {
    fontSize: 34,
    fontWeight: "700" as const,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  title1: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  title2: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
    lineHeight: 28,
  },
  title3: {
    fontSize: 20,
    fontWeight: "600" as const,
    letterSpacing: 0.38,
    lineHeight: 25,
  },

  // Body copy
  headline: {
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  body: {
    fontSize: 17,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  callout: {
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  footnote: {
    fontSize: 13,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 16,
  },
  caption2: {
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 0.07,
    lineHeight: 13,
  },

  // Labels / UI
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
    letterSpacing: -0.08,
  },

  // Numerals — tabular for data alignment
  numeralLarge: {
    fontSize: 34,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums"] as const,
    letterSpacing: -0.5,
    lineHeight: 41,
  },
  numeral: {
    fontSize: 20,
    fontWeight: "600" as const,
    fontVariant: ["tabular-nums"] as const,
    letterSpacing: -0.3,
  },
  numeralSmall: {
    fontSize: 15,
    fontWeight: "600" as const,
    fontVariant: ["tabular-nums"] as const,
    letterSpacing: -0.2,
  },

  // Legacy aliases for backward compatibility
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: 0.36, lineHeight: 34 },
  h2: { fontSize: 20, fontWeight: "600" as const, letterSpacing: 0.38, lineHeight: 25 },
};
