'use client';

import WorkspaceAgentAnalyticsSection from '@/features/agent-analytics/WorkspaceAgentAnalyticsSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceAgentAnalyticsSection workspaceId={workspaceId} />;
}
