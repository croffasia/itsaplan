'use client';

import { useTranslations } from 'next-intl';
import { PRIORITY_ORDER, type Priority } from '@/utils/fieldOptions';

// The label of a priority value, with '' (and null) the explicit "no priority"
// choice. The API types priority as a plain string, so a value outside the fixed
// list is shown as it came instead of rendering a key path.
export function usePriorityLabel() {
  const t = useTranslations('common.priority');
  return (value: string | null) => {
    if (!value) return t('none');
    return PRIORITY_ORDER.includes(value as Priority) ? t(value as Priority) : value;
  };
}
