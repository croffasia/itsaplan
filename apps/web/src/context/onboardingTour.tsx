'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// The tour of the product opened again by hand, from the product mark in the sidebar. It
// is shared because the mark is in the shell and the tour is mounted beside every page.
interface OnboardingTour {
  replaying: boolean;
  replay: () => void;
  stop: () => void;
}

const OnboardingTourCtx = createContext<OnboardingTour>({
  replaying: false,
  replay: () => {},
  stop: () => {},
});

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const [replaying, setReplaying] = useState(false);
  const value = useMemo(
    () => ({ replaying, replay: () => setReplaying(true), stop: () => setReplaying(false) }),
    [replaying],
  );
  return <OnboardingTourCtx.Provider value={value}>{children}</OnboardingTourCtx.Provider>;
}

export function useOnboardingTour() {
  return useContext(OnboardingTourCtx);
}
