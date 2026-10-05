'use client';

import WorkspaceManagersSection from '@/features/teams/components/workspace/WorkspaceManagersSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceManagersSection workspaceId={workspaceId} />;
}
