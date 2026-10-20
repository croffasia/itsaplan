'use client';

import WorkspaceInfoSection from '@/features/teams/components/workspace/WorkspaceInfoSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceInfoSection workspaceId={workspaceId} />;
}
