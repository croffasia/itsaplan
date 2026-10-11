'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Settings } from 'lucide-react';
import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import { cn } from '@/lib/utils';
import { workspacePath } from '@/utils/paths';
import { useWorkspaceSettingsSections } from '../../hooks/useWorkspaceSettingsSections';
import type { WorkspaceSectionGroup } from '../../types/workspaceSection';
import {
  SectionNav,
  sectionNavIdleClass,
  sectionNavItemClass,
  type SectionNavItem,
} from '@/components/common/page/SectionNav';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// The overview sections at the top of the menu, then the settings folded into a group,
// as the team menu folds its AI sections. With no overview to sit under there is nothing
// to fold, and the settings are listed as they are.
export default function WorkspaceSectionNav({ workspace }: { workspace: WorkspaceSummary }) {
  const t = useTranslations('teams.workspace');
  const pathname = usePathname();
  const sections = useWorkspaceSettingsSections(workspace);
  const items = (group: WorkspaceSectionGroup): SectionNavItem[] =>
    sections
      .filter((section) => section.group === group)
      .map(({ id, label, icon, badge }) => ({
        id,
        label,
        icon,
        badge,
        href: workspacePath(workspace.id, id),
      }));
  const overview = items('overview');
  const settings = items('settings');
  const activeId = [...overview, ...settings].find((entry) => entry.href === pathname)?.id ?? null;
  // Null until the user opens or closes the group themselves; until then it follows
  // whichever section is open.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const settingsOpen = toggled ?? settings.some((entry) => entry.id === activeId);

  if (overview.length === 0) {
    return <SectionNav sections={settings} activeId={activeId} label={workspace.name} />;
  }

  return (
    <div className="space-y-0.5">
      <SectionNav sections={overview} activeId={activeId} label={workspace.name} />
      {settings.length > 0 && (
        <Collapsible open={settingsOpen} onOpenChange={setToggled}>
          <CollapsibleTrigger className={cn(sectionNavItemClass, sectionNavIdleClass)}>
            <Settings className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{t('settingsGroup')}</span>
            <ChevronRight
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
                settingsOpen && 'rotate-90',
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="ps-4">
            <SectionNav sections={settings} activeId={activeId} label={t('settingsGroup')} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
