'use client';

import { useTranslations } from 'next-intl';

// A clipboard parse failure, in words. The parsers throw a code; anything else —
// or a code the messages do not carry — falls back to the section's own message.
export function useTransferErrorMessage() {
  const t = useTranslations('settings.transfer.errors');

  return (error: unknown, fallback: string) => {
    const code = (error instanceof Error ? error.message : '') as Parameters<typeof t.has>[0];
    return t.has(code) ? t(code) : fallback;
  };
}
