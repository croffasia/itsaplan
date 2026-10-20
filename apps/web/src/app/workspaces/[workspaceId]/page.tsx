'use client';

import WorkspaceFirstSection from '@/features/teams/components/workspace/WorkspaceFirstSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';
import { useWorkspacesQuery } from '@/services/workspaces.service';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  const workspace = useWorkspacesQuery().data?.find((entry) => entry.id === workspaceId);
  return workspace && <WorkspaceFirstSection workspace={workspace} />;
}
