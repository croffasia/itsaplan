'use client';

import { useMemo } from 'react';
import { useNow } from 'next-intl';
import { useSession } from '@/lib/auth-client';
import { useAccountPreferences } from '@/services/preferences.service';
import { filterToday, type FilterEvaluationContext } from '@/utils/filters';

const UPDATE_INTERVAL_MS = 60_000;

export function useFilterEvaluationContext(): FilterEvaluationContext {
  const { data: session } = useSession();
  const { timezone } = useAccountPreferences();
  const now = useNow({ updateInterval: UPDATE_INTERVAL_MS });
  const today = filterToday(now, timezone);

  return useMemo(
    () => ({ currentUserId: session?.user.id ?? null, today }),
    [session?.user.id, today],
  );
}
