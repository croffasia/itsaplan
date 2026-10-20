'use client';

import { useIsFetching } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { useWorkspaceQuery } from '@/services/workspaces.service';
import { useWorkspaceSettingsSections } from '../../hooks/useWorkspaceSettingsSections';

// A build's sections can depend on the workspace and on queries of their own, so a link
// straight to one waits for those to load before it calls the section unknown.
export default function WorkspaceExtraSectionPage({
  workspace,
  sectionId,
}: {
  workspace: WorkspaceSummary;
  sectionId: string;
}) {
  const sections = useWorkspaceSettingsSections(workspace);
  const pending = useWorkspaceQuery(workspace.id).isPending;
  const loading = useIsFetching() > 0;
  const Component = sections.find((entry) => entry.id === sectionId)?.Component;
  if (!Component) {
    if (pending || loading) return null;
    notFound();
  }
  return <Component workspaceId={workspace.id} />;
}
