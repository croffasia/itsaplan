'use client';

import { usePathname } from 'next/navigation';
import { Info, ShieldCheck, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWorkspaceSections } from '@/cloud';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { workspacePath } from '@/utils/paths';
import { useWorkspaceQuery } from '@/services/workspaces.service';
import { SectionNav, type SectionNavItem } from '@/components/common/page/SectionNav';

export default function WorkspaceSectionNav({ workspace }: { workspace: WorkspaceSummary }) {
  const t = useTranslations('teams.workspace');
  const pathname = usePathname();
  const detail = useWorkspaceQuery(workspace.id).data;
  const extra = useWorkspaceSections(workspace);

  const sections: SectionNavItem[] = [
    { id: 'info', label: t('general'), icon: Info, href: workspacePath(workspace.id) },
    {
      id: 'managers',
      label: t('managers.title'),
      icon: ShieldCheck,
      badge: detail && String(detail.managerCount),
      href: workspacePath(workspace.id, 'managers'),
    },
    ...(workspace.role === 'owner'
      ? [
          {
            id: 'scim',
            label: t('scim.title'),
            icon: UsersRound,
            href: workspacePath(workspace.id, 'scim'),
          },
        ]
      : []),
    ...extra.map(({ id, label, icon }) => ({
      id,
      label,
      icon,
      href: workspacePath(workspace.id, id),
    })),
  ];
  const activeId = sections.find((entry) => entry.href === pathname)?.id ?? null;

  return (
    <div className="space-y-2">
      <h2 className="truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('info.title')}
      </h2>
      <SectionNav sections={sections} activeId={activeId} label={workspace.name} />
    </div>
  );
}
