import React, { createContext, useContext, useState, ReactNode } from "react";
import type { UserProfile, FitnessProfile, Goal } from "@/types/models";

// Holds in-progress onboarding answers across screens before final submit.
// Nothing here is persisted as if it were a real plan until the user
// completes onboarding and the backend generates one — this is draft state
// only, never rendered as a dashboard value.
interface OnboardingState {
  profile: Partial<UserProfile>;
  fitnessProfile: Partial<FitnessProfile>;
  goal?: Goal;
  setProfile: (p: Partial<UserProfile>) => void;
  setFitnessProfile: (p: Partial<FitnessProfile>) => void;
  setGoal: (g: Goal) => void;
}

const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Partial<UserProfile>>({});
  const [fitnessProfile, setFitnessProfileState] = useState<Partial<FitnessProfile>>({});
  const [goal, setGoalState] = useState<Goal | undefined>(undefined);

  const value: OnboardingState = {
    profile,
    fitnessProfile,
    goal,
    setProfile: (p) => setProfileState((prev) => ({ ...prev, ...p })),
    setFitnessProfile: (p) => setFitnessProfileState((prev) => ({ ...prev, ...p })),
    setGoal: setGoalState,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
