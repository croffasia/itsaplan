'use client';

import { useParams } from 'next/navigation';
import WorkspaceExtraSectionPage from '@/features/teams/components/workspace/WorkspaceExtraSectionPage';
import { useRouteWorkspaceId } from '@/features/teams/hooks/useRouteWorkspaceId';
import { useWorkspacesQuery } from '@/services/workspaces.service';

export default function Page() {
  const { section } = useParams<{ section: string }>();
  const workspaceId = useRouteWorkspaceId();
  const workspace = useWorkspacesQuery().data?.find((entry) => entry.id === workspaceId);
  return workspace && <WorkspaceExtraSectionPage workspace={workspace} sectionId={section} />;
}
