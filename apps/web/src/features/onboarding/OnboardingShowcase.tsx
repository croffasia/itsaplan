'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';
import OnboardingShowcaseDialog from './components/OnboardingShowcaseDialog';

// The request to list the company on itsaplan.dev, a startup screen after the tour, shown
// once and only to the instance owner: the person who installed the product usually
// speaks for the company. Closing it marks it seen.
export default function OnboardingShowcase({ next }: { next: ReactNode }) {
  const { data: session } = useSession();
  const { data: prefs, isError } = useAccountPreferencesQuery();
  const update = useUpdateAccountPreferences();

  if (!prefs) return isError ? next : null;
  if (prefs.showcaseSeen || session?.user.role !== 'god') return next;
  return <OnboardingShowcaseDialog onClose={() => update.mutate({ showcaseSeen: true })} />;
}
