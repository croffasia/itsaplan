'use client';

import { useTranslations } from 'next-intl';

// Badge text for a planned item in the copy/paste import dialogs (states, issue
// types, labels). A match that differs only in color is applied as an update.
export function useTransferActionLabel() {
  const t = useTranslations('settings.transfer.actions');
  return (action: 'create' | 'update' | 'unchanged') => t(action);
}
