'use client';

import { useWorkspaceScimQuery, useWorkspacesQuery } from '@/services/workspaces.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import WorkspaceScimSettings from '@/features/teams/components/workspace/scim/WorkspaceScimSettings';
import GodSectionPage from './components/GodSectionPage';

// SCIM provisioning reaches past a workspace to the whole instance, so only the instance
// owner sets it up, for the instance workspace (the API holds the same rule). That is the
// first workspace, as `instanceWorkspaceId` in @repo/db has it, and the owner sees it
// among theirs. The switch and the token act on their own, so there is no page-level Save.
export default function GodScimPage() {
  const workspaces = useWorkspacesQuery().data;

  return (
    <GodSectionPage slug="scim">
      {workspaces?.length ? (
        <InstanceScim workspaceId={Math.min(...workspaces.map((entry) => entry.id))} />
      ) : (
        <ListSkeleton rows={5} rowClassName="h-12" />
      )}
    </GodSectionPage>
  );
}

function InstanceScim({ workspaceId }: { workspaceId: number }) {
  const settings = useWorkspaceScimQuery(workspaceId).data;
  return settings ? (
    <WorkspaceScimSettings workspaceId={workspaceId} settings={settings} instance />
  ) : (
    <ListSkeleton rows={5} rowClassName="h-12" />
  );
}
