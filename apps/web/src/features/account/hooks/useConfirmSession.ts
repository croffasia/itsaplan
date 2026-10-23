'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signIn } from '@/lib/auth-client';
import { useRefusalMessage } from '@/hooks/useRefusalMessage';

export function useConfirmSession(userId: string, email: string, onConfirmed: () => void) {
  const t = useTranslations('account.security');
  const refusalMessage = useRefusalMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  async function run(action: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (err) {
      setError(refusalMessage(err, t('confirmSessionFailed')));
    } finally {
      setPending(false);
    }
  }

  function confirmed(id: string | undefined) {
    if (id !== userId) {
      // A different passkey can switch accounts. Reload to discard the previous user's cached data.
      window.location.assign(new URL('/account/security', window.location.origin).href);
      return;
    }
    onConfirmed();
  }

  return {
    pending,
    error,
    linkSent,
    password: (password: string) =>
      run(async () => {
        const result = await signIn.email({ email, password });
        if (result.error) throw result.error;
        confirmed(result.data?.user.id);
      }),
    passkey: () =>
      run(async () => {
        const result = await signIn.passkey();
        if (result?.error) throw result.error;
        confirmed(result?.data?.user.id);
      }),
    provider: (provider: 'google' | 'oidc') =>
      run(async () => {
        const result = await signIn.social({
          provider,
          callbackURL: `${window.location.origin}/account/security`,
          errorCallbackURL: `${window.location.origin}/login`,
        });
        if (result.error) throw result.error;
      }),
    magicLink: () =>
      run(async () => {
        const result = await signIn.magicLink({
          email,
          callbackURL: `${window.location.origin}/account/security`,
          errorCallbackURL: `${window.location.origin}/login`,
        });
        if (result.error) throw result.error;
        setLinkSent(true);
      }),
  };
}
