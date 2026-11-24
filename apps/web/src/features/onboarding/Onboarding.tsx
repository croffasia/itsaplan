'use client';

import type { ReactNode } from 'react';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';
import OnboardingDialog from './components/OnboardingDialog';

// The tour of the product, a startup screen shown once to every account. Closing it
// marks it seen.
export default function Onboarding({ next }: { next: ReactNode }) {
  const { data: prefs, isError } = useAccountPreferencesQuery();
  const update = useUpdateAccountPreferences();

  if (!prefs) return isError ? next : null;
  if (prefs.onboardingSeen) return next;
  return <OnboardingDialog onClose={() => update.mutate({ onboardingSeen: true })} />;
}
