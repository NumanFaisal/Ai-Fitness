import { Platform } from "react-native";

// Live Production Backend URL on Render
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "https://ai-fitness-56uz.onrender.com";

