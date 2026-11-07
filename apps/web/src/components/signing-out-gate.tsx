'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import AppLogo from '@/components/common/AppLogo';
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
      className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted p-6"
    >
      <AppLogo className="size-10" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        {t('signingOut')}
      </p>
    </main>
  );
}
