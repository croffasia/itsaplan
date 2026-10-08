'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { manageTeamsPath } from '@/utils/paths';
import { useWorkspacesQuery } from '@/services/workspaces.service';
import { useRouteWorkspaceId } from './hooks/useRouteWorkspaceId';

// One workspace the caller manages, as the section open beside the rails. A workspace
// they do not manage falls back to the teams.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const workspaceId = useRouteWorkspaceId();
  const { data } = useWorkspacesQuery();
  const workspace = data?.find((entry) => entry.id === workspaceId && entry.role !== null);

  useEffect(() => {
    if (data && !workspace) router.replace(manageTeamsPath());
  }, [data, workspace, router]);

  return <div className="flex min-w-0 flex-1 flex-col">{workspace && children}</div>;
}
