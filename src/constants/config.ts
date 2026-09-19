import { Platform } from "react-native";

// Reads API_BASE_URL from app config / env at build time.
// Falls back to localhost for web, or local LAN IP for mobile dev.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  (Platform.OS === "web" ? "http://localhost:3000" : "http://192.168.1.4:3000");

