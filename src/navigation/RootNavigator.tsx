import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
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
import { colors } from "@/theme/colors";
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.2,
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

  useEffect(() => {
    async function checkStatus() {
      try {
        // 1. Check local storage
        const localVal = await AsyncStorage.getItem("has_completed_onboarding");
        if (localVal === "true") {
          setHasCompletedOnboarding(true);
          setLoading(false);
          return;
        }

        // 2. Check the real persistent database on the server
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
        options={{ headerShown: true, title: "Hydration", headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }}
      />
      <RootStack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ headerShown: true, title: "Progress Timeline", headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }}
      />
    </RootStack.Navigator>
  );
}
