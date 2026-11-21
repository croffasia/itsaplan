'use client';

import { useWorkspaceSlackSettingsQuery } from '@/services/workspaces.service';
import SectionPageSkeleton from '@/components/common/skeleton/SectionPageSkeleton';
import WorkspaceSlackForm from './WorkspaceSlackForm';

// Where the workspace's projects send Slack notifications: through the instance app set
// up in god mode, or through an app of the workspace's own.
export default function WorkspaceSlackSection({ workspaceId }: { workspaceId: number }) {
  const settings = useWorkspaceSlackSettingsQuery(workspaceId).data;
  if (!settings) return <SectionPageSkeleton rows={2} />;
  return <WorkspaceSlackForm workspaceId={workspaceId} settings={settings} />;
}
