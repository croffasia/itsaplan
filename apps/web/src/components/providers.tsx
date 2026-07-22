'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { HotkeysProvider } from '@/context/useHotkeys';
import { Toaster } from '@/components/ui/sonner';
import PreferencesSync from '@/components/preferences-sync';
import SessionScope from '@/components/session-scope';

// The message shown for a failed mutation: the API's `{ error }` text (carried by
// ApiError) when present, otherwise a generic fallback.
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong';
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Every failed mutation is surfaced as a toast, so no call site has to wire
        // its own error UI. A mutation that owns its error display can opt out with
        // `meta: { suppressErrorToast: true }`. Reads are not toasted — a failed
        // query renders its own empty/loading state in place.
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.meta?.suppressErrorToast) return;
            toast.error(errorMessage(error));
          },
        }),
        defaultOptions: {
          // A short stale time avoids redundant refetches on tab switches while
          // edits still show immediately (mutations invalidate). Window-focus
          // refetch picks up changes made by other clients on return to the tab.
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionScope />
      <PreferencesSync />
      <HotkeysProvider>{children}</HotkeysProvider>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}
