'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

// Everything cached in this tab belongs to one account. Signing in as somebody else
// without a full page load (sign out and back in, a magic link opened in the same
// tab) keeps the previous account's queries in memory, so the app would show
// projects the new account cannot even read — the API already answers correctly, it
// is the client cache that is stale.
//
// Clearing on a changed user id fixes that. The remembered "last project" needs no
// cleanup: it is stored on the account, so the new session reads its own value.
export default function SessionScope() {
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const userId = session?.user.id ?? null;
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Wait for the first resolved session; an undefined-to-null transition while it
    // loads is not a user change.
    if (isPending) return;
    const before = previous.current;
    previous.current = userId;
    if (before === undefined || before === userId) return;
    queryClient.clear();
  }, [userId, isPending, queryClient]);

  return null;
}
