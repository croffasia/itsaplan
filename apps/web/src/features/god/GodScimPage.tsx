'use client';

import { useWorkspaceScimQuery } from '@/services/workspaces.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import WorkspaceScimSettings from '@/features/teams/components/workspace/scim/WorkspaceScimSettings';
import GodSectionPage from './components/GodSectionPage';

// The instance's SCIM provisioning: it reaches past every workspace to the whole
// instance, so only the instance owner sets it up (the API holds the same rule). The
// switch and the token act on their own, so there is no page-level Save.
export default function GodScimPage() {
  const settings = useWorkspaceScimQuery(null).data;

  return (
    <GodSectionPage slug="scim">
      {settings ? (
        <WorkspaceScimSettings workspaceId={null} settings={settings} />
      ) : (
        <ListSkeleton rows={5} rowClassName="h-12" />
      )}
    </GodSectionPage>
  );
}
