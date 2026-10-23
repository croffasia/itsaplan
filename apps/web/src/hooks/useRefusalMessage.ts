'use client';

import { useTranslations } from 'next-intl';
import { authRefusalKey } from '@/utils/authRefusals';

// Words a refusal from the auth server for a form, in the visitor's language: by its
// code or status first, then by a text a build names under auth.errors.codes. The
// caller's `fallback` comes before the server's message because the passkey client
// always sends one, "Auth cancelled", in English; without either, the generic text.
export function useRefusalMessage() {
  const t = useTranslations('auth.errors');

  return function refusalMessage(err: unknown, fallback?: string): string {
    const { code, status } = (err ?? {}) as { code?: unknown; status?: number };
    const key = authRefusalKey(code, status);
    if (key) return t(key);
    if (typeof code === 'string') {
      const own = `codes.${code}` as Parameters<typeof t.has>[0];
      if (t.has(own)) return t(own);
    }
    return fallback || (err instanceof Error && err.message) || t('generic');
  };
}
