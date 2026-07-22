'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type PublicAuthConfig } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The instance sign-in policy: whether registration is open, invite-only or closed,
// and which sign-in methods the instance offers. Shared rather than feature-local:
// the sign-in and sign-up screens read it before there is a session, and the account
// page reads it to decide which providers to list.

export function useAuthConfigQuery() {
  return useQuery({
    queryKey: qk.authConfig,
    queryFn: () => api.getAuthConfig(),
    // Set by an administrator and read on several screens, so keep it out of the
    // refetch path.
    staleTime: 5 * 60_000,
  });
}

// The config to render with, or null while the request is in flight or after it
// failed — the API is the real gate, so the screens stay usable meanwhile.
export function useAuthConfig(): PublicAuthConfig | null {
  return useAuthConfigQuery().data ?? null;
}
