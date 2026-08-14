'use client';

import { useTranslations } from 'next-intl';

// Why a card cannot enter a column: it is at the work-in-progress limit its
// settings enforce. Names the column and the limit, so the reader knows what to
// change without leaving the board.
export function useWipLimitMessage() {
  const t = useTranslations('workItems');
  return (column: string, limit: number) => t('wip.reached', { column, limit });
}
