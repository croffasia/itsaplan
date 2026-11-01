'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useSigningOut } from '@/lib/auth-client';

// Swaps the app for a neutral screen while a sign-out leaves it: left mounted, the app
// would draw empty pages and ask the api for data the gone session can no longer read
// until the next page loads.
export default function SigningOutGate({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const signingOut = useSigningOut();

  if (!signingOut) return children;
  return (
    <main
      aria-live="polite"
      className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground"
    >
      {t('signingOut')}
    </main>
  );
}
