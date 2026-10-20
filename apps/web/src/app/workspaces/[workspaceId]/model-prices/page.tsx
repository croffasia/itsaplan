'use client';

import WorkspaceModelPricesSection from '@/features/agent-analytics/WorkspaceModelPricesSection';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';

export default function Page() {
  const workspaceId = useRouteWorkspaceId();
  return workspaceId !== null && <WorkspaceModelPricesSection workspaceId={workspaceId} />;
}
