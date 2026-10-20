'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageSkeleton from '@/components/common/skeleton/PageSkeleton';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { workspacePath } from '@/utils/paths';
import { useWorkspaceSettingsSections } from '../../hooks/useWorkspaceSettingsSections';

// A workspace opened without a section goes to the first entry of its settings menu.
export default function WorkspaceFirstSection({ workspace }: { workspace: WorkspaceSummary }) {
  const router = useRouter();
  const firstId = useWorkspaceSettingsSections(workspace)[0]?.id;

  useEffect(() => {
    if (firstId) router.replace(workspacePath(workspace.id, firstId));
  }, [firstId, workspace.id, router]);

  return <PageSkeleton />;
}
