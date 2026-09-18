import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WelcomeScreen } from "@/screens/onboarding/WelcomeScreen";
import { AccountCreationScreen } from "@/screens/onboarding/AccountCreationScreen";
import { ProfileSetupScreen } from "@/screens/onboarding/ProfileSetupScreen";
import { GoalSelectionScreen } from "@/screens/onboarding/GoalSelectionScreen";
import { QuestionnaireScreen } from "@/screens/onboarding/QuestionnaireScreen";
import { BodyPhotosScreen } from "@/screens/onboarding/BodyPhotosScreen";
import { TargetPhotoScreen } from "@/screens/onboarding/TargetPhotoScreen";
import { ReviewGenerateScreen } from "@/screens/onboarding/ReviewGenerateScreen";
import { OnboardingProvider } from "@/store/OnboardingContext";
import { colors } from "@/theme/colors";

export type OnboardingStackParamList = {
  Welcome: undefined;
  AccountCreation: undefined;
  ProfileSetup: undefined;
  GoalSelection: undefined;
  Questionnaire: undefined;
  BodyPhotos: undefined;
  TargetPhoto: undefined;
  ReviewGenerate: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof OnboardingStackParamList | null>(null);

  useEffect(() => {
    async function determineInitialRoute() {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        if (token) {
          // User already logged in - bypass account registration and jump to profile questions
          setInitialRoute("ProfileSetup");
        } else {
          setInitialRoute("Welcome");
        }
      } catch {
        setInitialRoute("Welcome");
      }
    }
    determineInitialRoute();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <OnboardingProvider>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="AccountCreation" component={AccountCreationScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="GoalSelection" component={GoalSelectionScreen} />
        <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
        <Stack.Screen name="BodyPhotos" component={BodyPhotosScreen} />
        <Stack.Screen name="TargetPhoto" component={TargetPhotoScreen} />
        <Stack.Screen name="ReviewGenerate" component={ReviewGenerateScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
