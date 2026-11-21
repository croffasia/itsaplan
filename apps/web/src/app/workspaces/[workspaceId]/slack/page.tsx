'use client';

import WorkspaceSlackSection from '@/features/teams/components/workspace/WorkspaceSlackSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceSlackSection workspaceId={workspaceId} />;
}
