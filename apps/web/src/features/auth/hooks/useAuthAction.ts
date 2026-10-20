'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { registrationRefusalKey } from '@/utils/registrationRefusals';

// Runs an auth action while tracking pending + error, and redirects into the
// planner on success. `setError` is exposed so a form can report client-side
// validation before calling `run`.
//
// Actions that only send an email (reset link, sign-in link, confirmation) end on
// the same screen with a "check your inbox" message instead, so they pass
// `redirect: false` and keep `pending` cleared.
//
// A failure carries the message the auth server sent, except a refusal of the
// registration gate, which is shown by its code in the visitor's language; `fallback`
// covers the ones that arrive without a message and where the generic wording is too
// vague.
export function useAuthAction() {
  const router = useRouter();
  const t = useTranslations('auth.errors');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(
    action: () => Promise<void>,
    options?: { redirect?: boolean; fallback?: string },
  ) {
    setError(null);
    setPending(true);
    try {
      await action();
      if (options?.redirect === false) {
        setPending(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const refusal = registrationRefusalKey((err as { code?: unknown } | null)?.code);
      setError(refusal ? t(refusal) : message || options?.fallback || t('generic'));
      setPending(false);
    }
  }

  return { error, pending, setError, run };
}
