'use client';

import { notFound } from 'next/navigation';
import { useWorkspaceSections } from '@/cloud';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';

export default function WorkspaceExtraSectionPage({
  workspace,
  sectionId,
}: {
  workspace: WorkspaceSummary;
  sectionId: string;
}) {
  const section = useWorkspaceSections(workspace).find((entry) => entry.id === sectionId);
  if (!section) notFound();
  return <section.Component workspaceId={workspace.id} />;
}
