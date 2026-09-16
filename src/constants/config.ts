// Reads API_BASE_URL from app config / env at build time.
// Falls back to localhost for local dev against the backend in /apps/api.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://192.168.1.4:3000";
