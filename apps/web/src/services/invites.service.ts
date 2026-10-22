import { useQuery } from '@tanstack/react-query';
import { listReceivedInvites } from '@/lib/api/endpoints/invites';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';

export function useReceivedInvitesQuery(
  user: { id: string; email: string; emailVerified: boolean } | undefined,
  params: PageParams,
) {
  return useQuery({
    queryKey: qk.receivedInvitesPage(user?.id ?? '', user?.email ?? '', params),
    queryFn: () => listReceivedInvites(params),
    enabled: user?.emailVerified === true,
    retry: false,
  });
}
