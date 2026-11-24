'use client';

import WorkspaceTemplatesSection from '@/features/teams/components/workspace/WorkspaceTemplatesSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceTemplatesSection workspaceId={workspaceId} />;
}
