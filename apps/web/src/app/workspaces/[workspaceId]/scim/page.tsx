'use client';

import WorkspaceScimSection from '@/features/teams/components/workspace/scim/WorkspaceScimSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceScimSection workspaceId={workspaceId} />;
}
