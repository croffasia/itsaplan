'use client';

import { useState, type ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';
import { usePaging } from '@/hooks/usePaging';
import { useReceivedInvitesQuery } from '@/services/invites.service';
import InviteStartList from './InviteStartList';

export default function InviteStart({ children }: { children: ReactNode }) {
  const session = useSession();
  const user = session.data?.user;
  const paging = usePaging();
  const query = useReceivedInvitesQuery(user, paging.params);
  const [continued, setContinued] = useState(false);

  if (continued) return children;
  const loading = session.isPending || (!!user?.emailVerified && query.isPending);
  if (!loading && (!user?.emailVerified || (!query.isError && query.data?.total === 0)))
    return children;

  return (
    <InviteStartList
      items={query.data?.items ?? []}
      total={query.data?.total ?? 0}
      paging={paging}
      loading={loading}
      failed={query.isError}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
      onContinue={() => setContinued(true)}
    />
  );
}
