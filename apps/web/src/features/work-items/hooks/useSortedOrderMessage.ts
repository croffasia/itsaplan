'use client';

import { useTranslations } from 'next-intl';
import type { SortField } from '@/utils/viewTypes';

// Why an issue cannot be reordered inside its group: the view is sorted by a
// field, so the order is not the user's to set until ordering is back on Manual.
export function useSortedOrderMessage() {
  const t = useTranslations('workItems');
  const tField = useTranslations('display.sortFields');
  return (field: SortField) => t('sortedOrder', { field: tField(field) });
}
