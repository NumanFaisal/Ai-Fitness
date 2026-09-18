// Apple-inspired dual-mode color system
// Dark: pure iOS-true blacks with glass surfaces
// Light: iOS system background with white cards

export const darkColors = {
  // Base
  background: "#000000",         // iOS true black
  backgroundSecondary: "#0C0C0E", // subtle depth
  surface: "rgba(28,28,30,0.92)",  // iOS system gray 6
  surfaceElevated: "rgba(44,44,46,0.95)", // iOS system gray 5
  surfaceAlt: "rgba(58,58,60,0.6)",

  // Glass / Frosted
  glassBackground: "rgba(28,28,30,0.75)",
  glassBackgroundLight: "rgba(44,44,46,0.55)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassBorderStrong: "rgba(255,255,255,0.16)",
  glassHighlight: "rgba(255,255,255,0.05)",  // inner top-edge shimmer

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(235,235,245,0.60)",   // iOS label secondary
  textTertiary: "rgba(235,235,245,0.30)",
  textMuted: "rgba(235,235,245,0.18)",
  textOnAccent: "#FFFFFF",

  // Accent — Apple System Blue
  accent: "#0A84FF",             // iOS blue dark
  accentMuted: "rgba(10,132,255,0.18)",
  accentHover: "#0070E0",

  // Semantic
  success: "#30D158",            // iOS green dark
  successMuted: "rgba(48,209,88,0.15)",
  danger: "#FF453A",             // iOS red dark
  dangerMuted: "rgba(255,69,58,0.15)",
  warning: "#FFD60A",            // iOS yellow dark
  warningMuted: "rgba(255,214,10,0.15)",
  water: "#0A84FF",              // blue for water/hydration

  // Dividers & Borders
  divider: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",

  // Legacy aliases (keep for backward compat during migration)
  ink: "#000000",
  bone: "#FFFFFF",
  ash: "rgba(235,235,245,0.60)",
  ashMuted: "rgba(235,235,245,0.30)",
  brass: "#0A84FF",
  moss: "#30D158",
  rust: "#FF453A",
  primary: "#0A84FF",
  primaryHover: "#0070E0",
  primaryMuted: "rgba(10,132,255,0.18)",
  primaryTextOnAccent: "#FFFFFF",
  surfaceGlass: "rgba(28,28,30,0.75)",
  estimated: "rgba(235,235,245,0.40)",
  accentCyan: "#64D2FF",
};

export const lightColors = {
  // Base
  background: "#F2F2F7",         // iOS system background
  backgroundSecondary: "#E5E5EA",
  surface: "rgba(255,255,255,0.95)",
  surfaceElevated: "rgba(255,255,255,1.0)",
  surfaceAlt: "rgba(242,242,247,0.90)",

  // Glass / Frosted
  glassBackground: "rgba(255,255,255,0.72)",
  glassBackgroundLight: "rgba(255,255,255,0.55)",
  glassBorder: "rgba(0,0,0,0.08)",
  glassBorderStrong: "rgba(0,0,0,0.14)",
  glassHighlight: "rgba(255,255,255,0.6)",

  // Text
  textPrimary: "#000000",
  textSecondary: "rgba(60,60,67,0.60)",     // iOS secondary label
  textTertiary: "rgba(60,60,67,0.30)",
  textMuted: "rgba(60,60,67,0.18)",
  textOnAccent: "#FFFFFF",

  // Accent — Apple System Blue
  accent: "#007AFF",             // iOS blue light
  accentMuted: "rgba(0,122,255,0.12)",
  accentHover: "#0062CC",

  // Semantic
  success: "#34C759",            // iOS green light
  successMuted: "rgba(52,199,89,0.12)",
  danger: "#FF3B30",             // iOS red light
  dangerMuted: "rgba(255,59,48,0.12)",
  warning: "#FF9500",            // iOS orange light
  warningMuted: "rgba(255,149,0,0.12)",
  water: "#007AFF",

  // Dividers & Borders
  divider: "rgba(60,60,67,0.12)",
  border: "rgba(60,60,67,0.10)",
  borderStrong: "rgba(60,60,67,0.20)",

  // Legacy aliases
  ink: "#F2F2F7",
  bone: "#000000",
  ash: "rgba(60,60,67,0.60)",
  ashMuted: "rgba(60,60,67,0.30)",
  brass: "#007AFF",
  moss: "#34C759",
  rust: "#FF3B30",
  primary: "#007AFF",
  primaryHover: "#0062CC",
  primaryMuted: "rgba(0,122,255,0.12)",
  primaryTextOnAccent: "#FFFFFF",
  surfaceGlass: "rgba(255,255,255,0.72)",
  estimated: "rgba(60,60,67,0.40)",
  accentCyan: "#32ADE6",
};

export type AppColors = typeof darkColors;

// Default export keeps legacy imports working during migration
export const colors = darkColors;
