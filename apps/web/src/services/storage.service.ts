'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The instance upload limits, read wherever a file can be picked (issue
// attachments, the markdown editor, the account avatar) so the UI can state the
// limit and reject an oversized file before it is sent. They change rarely, so the
// entry is kept fresh for the session rather than refetched per mount.
export function useStorageSettingsQuery() {
  return useQuery({
    queryKey: qk.storageSettings,
    queryFn: () => api.getStorageSettings(),
    staleTime: 5 * 60_000,
  });
}
