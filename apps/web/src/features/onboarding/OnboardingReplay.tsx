'use client';

import { useOnboardingTour } from '@/context/onboardingTour';
import { useAccountPreferences, useUpdateAccountPreferences } from '@/services/preferences.service';
import OnboardingDialog from './components/OnboardingDialog';

// The tour opened by hand from the product mark in the sidebar. It is not a startup
// screen, so nothing holds it back, and an account without a project can open it too.
export default function OnboardingReplay() {
  const tour = useOnboardingTour();
  const prefs = useAccountPreferences();
  const update = useUpdateAccountPreferences();

  if (!tour.replaying) return null;
  const close = () => {
    tour.stop();
    if (!prefs.onboardingSeen) update.mutate({ onboardingSeen: true });
  };
  return <OnboardingDialog onClose={close} />;
}
