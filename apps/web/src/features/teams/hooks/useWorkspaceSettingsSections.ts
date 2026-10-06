import { Info, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWorkspaceSections } from '@/cloud';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import type { WorkspaceSection } from '../types/workspaceSection';
import { useWorkspaceQuery } from '@/services/workspaces.service';

export function useWorkspaceSettingsSections(workspace: WorkspaceSummary): WorkspaceSection[] {
  const t = useTranslations('teams.workspace');
  const detail = useWorkspaceQuery(workspace.id).data;
  return useWorkspaceSections(workspace, [
    { id: 'info', label: t('general'), icon: Info },
    {
      id: 'managers',
      label: t('managers.title'),
      icon: ShieldCheck,
      badge: detail && String(detail.managerCount),
    },
  ]);
}
