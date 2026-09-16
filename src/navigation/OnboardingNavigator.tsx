import React from "react";
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
  return (
    <OnboardingProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
