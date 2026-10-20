import { BadgeDollarSign, Coins, Info, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWorkspaceSections } from '@/cloud';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { WORKSPACE_SECTION_GROUPS, type WorkspaceSection } from '../types/workspaceSection';
import { useWorkspaceQuery } from '@/services/workspaces.service';

// Grouped in menu order, so the first entry, the page a workspace opens on
// (WorkspaceFirstSection), is the first of the top group.
// Only the workspace's owner and its admins open them (WorkspaceLayout), and both read
// what the agents spent and set the model prices it is costed at.
export function useWorkspaceSettingsSections(workspace: WorkspaceSummary): WorkspaceSection[] {
  const t = useTranslations('teams.workspace');
  const detail = useWorkspaceQuery(workspace.id).data;
  const sections = useWorkspaceSections(workspace, [
    { id: 'agent-usage', label: t('agentUsage.title'), icon: Coins, group: 'overview' },
    { id: 'info', label: t('general'), icon: Info, group: 'settings' },
    {
      id: 'managers',
      label: t('managers.title'),
      icon: ShieldCheck,
      group: 'settings',
      badge: detail && String(detail.managerCount),
    },
    { id: 'model-prices', label: t('modelPrices.title'), icon: BadgeDollarSign, group: 'settings' },
  ]);
  return WORKSPACE_SECTION_GROUPS.flatMap((group) =>
    sections.filter((section) => section.group === group),
  );
}
