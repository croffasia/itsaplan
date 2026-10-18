'use client';

import {
  AtSign,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import type { WorkspaceSection } from '@/features/teams/types/workspaceSection';
import WorkspaceAgentBudgetsPreview from '@/features/teams/components/workspace/preview/WorkspaceAgentBudgetsPreview';
import WorkspaceAuditLogPreview from '@/features/teams/components/workspace/preview/WorkspaceAuditLogPreview';
import WorkspaceDashboardPreview from '@/features/teams/components/workspace/preview/WorkspaceDashboardPreview';
import WorkspaceEmailDomainsPreview from '@/features/teams/components/workspace/preview/WorkspaceEmailDomainsPreview';
import WorkspaceScimPreview from '@/features/teams/components/workspace/preview/WorkspaceScimPreview';
import WorkspaceSsoPreview from '@/features/teams/components/workspace/preview/WorkspaceSsoPreview';

// A self-hosted instance lists the core's workspace settings sections, then previews of
// the sections the hosted build and Pro add; they come after the core's, so a workspace
// opens on a section it has. Those of the settings are the owner's, as they are there.
// The hosted build returns the core's with its own added at any position, such as
// single sign-on and billing, or with one left out.
export default function useWorkspaceSections(
  workspace: WorkspaceSummary,
  core: WorkspaceSection[],
): WorkspaceSection[] {
  const t = useTranslations('sections.previews');
  const tTeams = useTranslations('teams.workspace');
  const sections: WorkspaceSection[] = [
    ...core,
    {
      id: 'dashboard',
      label: t('dashboard.title'),
      icon: LayoutDashboard,
      group: 'overview',
      Component: WorkspaceDashboardPreview,
    },
    {
      id: 'agent-budgets',
      label: t('agentBudgets.title'),
      icon: WalletCards,
      group: 'overview',
      Component: WorkspaceAgentBudgetsPreview,
    },
    {
      id: 'audit-log',
      label: t('auditLog.title'),
      icon: ScrollText,
      group: 'overview',
      Component: WorkspaceAuditLogPreview,
    },
  ];
  if (workspace.role !== 'owner') return sections;
  return [
    ...sections,
    {
      id: 'email-domains',
      label: t('emailDomains.title'),
      icon: AtSign,
      group: 'settings',
      Component: WorkspaceEmailDomainsPreview,
    },
    {
      id: 'sso',
      label: t('sso.title'),
      icon: KeyRound,
      group: 'settings',
      Component: WorkspaceSsoPreview,
    },
    {
      id: 'scim',
      label: tTeams('scim.title'),
      icon: UsersRound,
      group: 'settings',
      Component: WorkspaceScimPreview,
    },
  ];
}
