'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { manageTeamsPath, teamPath } from '@/utils/paths';
import { useTeamsQuery } from '@/services/teams.service';
import { useWorkspacesQuery } from '@/services/workspaces.service';
import { useRouteWorkspaceId } from './hooks/useRouteWorkspaceId';

// One workspace the caller manages, as the section open beside the rails. A workspace
// they do not manage opens their first team in it, or the teams when they have none.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const workspaceId = useRouteWorkspaceId();
  const { data } = useWorkspacesQuery();
  const teams = useTeamsQuery().data;
  const workspace = data?.find((entry) => entry.id === workspaceId && entry.role !== null);

  useEffect(() => {
    if (!data || workspace || !teams) return;
    const first = teams.find((team) => team.workspaceId === workspaceId);
    router.replace(first ? teamPath(first.ref) : manageTeamsPath());
  }, [data, workspace, teams, workspaceId, router]);

  return <div className="flex min-w-0 flex-1 flex-col">{workspace && children}</div>;
}
