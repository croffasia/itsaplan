'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { workspacePath } from '@/utils/paths';
import { useWorkspaceSettingsSections } from '../../hooks/useWorkspaceSettingsSections';
import { SectionNav, type SectionNavItem } from '@/components/common/page/SectionNav';

export default function WorkspaceSectionNav({ workspace }: { workspace: WorkspaceSummary }) {
  const t = useTranslations('teams.workspace');
  const pathname = usePathname();
  const sections: SectionNavItem[] = useWorkspaceSettingsSections(workspace).map(
    ({ id, label, icon, badge }) => ({
      id,
      label,
      icon,
      badge,
      href: workspacePath(workspace.id, id),
    }),
  );
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
