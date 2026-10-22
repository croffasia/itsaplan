'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRefusalMessage } from '@/hooks/useRefusalMessage';

// Runs an auth action while tracking pending + error, and redirects into the
// planner on success. `setError` is exposed so a form can report client-side
// validation before calling `run`.
//
// Actions that only send an email (reset link, sign-in link, confirmation) end on
// the same screen with a "check your inbox" message instead, so they pass
// `redirect: false` and keep `pending` cleared.
//
// A failure is worded by useRefusalMessage; `fallback` is the text for a refusal it
// cannot name, shown instead of the server's English message.
export function useAuthAction() {
  const router = useRouter();
  const refusalMessage = useRefusalMessage();
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
      setError(refusalMessage(err, options?.fallback));
      setPending(false);
    }
  }

  return { error, pending, setError, run };
}
