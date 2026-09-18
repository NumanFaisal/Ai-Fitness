import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, AppColors } from "@/theme/colors";

const THEME_STORAGE_KEY = "app_theme_preference";

interface ThemeContextValue {
  theme: "dark" | "light";
  isDark: boolean;
  colors: AppColors;
  toggleTheme: () => void;
  setTheme: (t: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

interface Props {
  children: ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<"dark" | "light">(
    systemScheme === "light" ? "light" : "dark"
  );
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === "dark" || stored === "light") {
          setThemeState(stored);
        } else if (systemScheme === "light") {
          setThemeState("light");
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [systemScheme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  };

  const setTheme = (t: "dark" | "light") => {
    setThemeState(t);
    AsyncStorage.setItem(THEME_STORAGE_KEY, t).catch(() => {});
  };

  const isDark = theme === "dark";
  const colors = isDark ? darkColors : lightColors;

  // Don't render until theme is loaded (avoids flash)
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
