'use client';

import { notFound } from 'next/navigation';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { useWorkspaceSettingsSections } from '../../hooks/useWorkspaceSettingsSections';

export default function WorkspaceExtraSectionPage({
  workspace,
  sectionId,
}: {
  workspace: WorkspaceSummary;
  sectionId: string;
}) {
  const sections = useWorkspaceSettingsSections(workspace);
  const Component = sections.find((entry) => entry.id === sectionId)?.Component;
  if (!Component) notFound();
  return <Component workspaceId={workspace.id} />;
}
