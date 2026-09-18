import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { WorkoutTodayScreen } from "@/screens/WorkoutTodayScreen";
import { NutritionTodayScreen } from "@/screens/NutritionTodayScreen";
import { WaterTrackingScreen } from "@/screens/WaterTrackingScreen";
import { ProgressScreen } from "@/screens/ProgressScreen";
import { AICoachScreen } from "@/screens/AICoachScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { endpoints } from "@/api/endpoints";
import { useTheme } from "@/store/ThemeContext";
import {
  TodayTabIcon,
  WorkoutTabIcon,
  NutritionTabIcon,
  CoachTabIcon,
  ProfileTabIcon,
} from "@/components/TabIcons";

export type MainTabParamList = {
  Dashboard: undefined;
  Workout: undefined;
  Nutrition: undefined;
  Coach: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Water: undefined;
  Progress: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { colors, isDark } = useTheme();

  // Frosted glass tab bar background
  const tabBarBg = isDark
    ? "rgba(10,10,12,0.88)"
    : "rgba(249,249,251,0.88)";

  const tabBarBorderColor = isDark
    ? "rgba(255,255,255,0.09)"
    : "rgba(0,0,0,0.08)";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: tabBarBg,
          borderTopColor: tabBarBorderColor,
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 82 : 68,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
          paddingTop: 8,
          // Subtle shadow for elevation
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 20,
          elevation: 20,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: isDark ? "rgba(235,235,245,0.40)" : "rgba(60,60,67,0.40)",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.1,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <TodayTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutTodayScreen}
        options={{
          title: "Workout",
          tabBarIcon: ({ color, focused }) => (
            <WorkoutTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Nutrition"
        component={NutritionTodayScreen}
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color, focused }) => (
            <NutritionTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Coach"
        component={AICoachScreen}
        options={{
          title: "Coach",
          tabBarIcon: ({ color, focused }) => (
            <CoachTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    async function checkStatus() {
      try {
        const localVal = await AsyncStorage.getItem("has_completed_onboarding");
        if (localVal === "true") {
          setHasCompletedOnboarding(true);
          setLoading(false);
          return;
        }
        const status = await endpoints.getUserStatus();
        if (status?.hasPlan || status?.hasCompletedOnboarding) {
          await AsyncStorage.setItem("has_completed_onboarding", "true");
          setHasCompletedOnboarding(true);
        } else {
          setHasCompletedOnboarding(false);
        }
      } catch {
        const localVal = await AsyncStorage.getItem("has_completed_onboarding");
        setHasCompletedOnboarding(localVal === "true");
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const headerBg = colors.isDark ? "rgba(10,10,12,0.92)" : "rgba(249,249,251,0.92)";

  return (
    <RootStack.Navigator
      initialRouteName={hasCompletedOnboarding ? "Main" : "Onboarding"}
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen
        name="Water"
        component={WaterTrackingScreen}
        options={{
          headerShown: true,
          title: "Hydration",
          headerTransparent: true,
          headerBlurEffect: "regular",
          headerStyle: { backgroundColor: colors.surface as string },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "600", fontSize: 17 },
        }}
      />
      <RootStack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          headerShown: true,
          title: "Progress",
          headerTransparent: true,
          headerBlurEffect: "regular",
          headerStyle: { backgroundColor: colors.surface as string },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "600", fontSize: 17 },
        }}
      />
    </RootStack.Navigator>
  );
}
