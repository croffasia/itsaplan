'use client';

import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import type { DueDatePreset } from '../utils/dueDatePresets';

// The name of a due-date quick preset ("Tomorrow", "End of this week").
export function useDueDatePresetLabel() {
  const t = useTranslations('issue.dueDatePresets');
  return (preset: DueDatePreset) => byKey(t)(preset);
}
