'use client';

import { usePathname } from 'next/navigation';
import { useOnboardingTour } from '@/context/onboardingTour';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';
import OnboardingDialog from './components/OnboardingDialog';

// Pages a signed-in person reaches outside the app: an invite, an MCP client's consent
// screen, a public link.
const OUTSIDE_APP = ['/invite', '/oauth', '/share', '/p/'];

// The tour of the product, shown once to every account over the page it lands on, before
// the what's new screen, and again whenever the product mark in the sidebar is clicked.
// The first time it can only be finished, slide by slide; finishing it marks it seen.
// Opened again, it closes like any dialog.
export default function Onboarding() {
  const pathname = usePathname();
  const tour = useOnboardingTour();
  const { data: prefs } = useAccountPreferencesQuery();
  const update = useUpdateAccountPreferences();

  if (!prefs) return null;
  const firstTime = !prefs.onboardingSeen && !OUTSIDE_APP.some((path) => pathname.startsWith(path));
  if (!firstTime && !tour.replaying) return null;

  const close = () => {
    tour.stop();
    if (!prefs.onboardingSeen) update.mutate({ onboardingSeen: true });
  };
  return <OnboardingDialog closable={prefs.onboardingSeen} onClose={close} />;
}
