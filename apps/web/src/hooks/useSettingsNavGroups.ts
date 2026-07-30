import { usePathname } from 'next/navigation';
import { Shield, type LucideIcon } from 'lucide-react';
import { rolesPath, settingsPath } from '@/utils/paths';
import {
  AUTOMATION_SECTIONS,
  CONFIGURATION_SECTIONS,
  GENERAL_SECTIONS,
  type SettingsSection,
} from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import type { ProjectDetail } from '@/lib/api';

// The project settings sidebar (the "Project settings" mode) lists the
// Configuration sections flat under group labels. This hook builds those groups
// from the section config and the viewer's permissions, and reports the first
// reachable destination so the main sidebar's "Project settings" entry knows
// where to point.

export type SettingsNavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
};

export type SettingsNavGroup = {
  key: string;
  label: string;
  items: SettingsNavItem[];
};

// `project` is only passed by the Shell, which calls this above its own context
// provider; everything else reads the project from the context.
export function useSettingsNavGroups(
  projectKey: string | null,
  project?: ProjectDetail | null,
): {
  groups: SettingsNavGroup[];
  firstHref: string | null;
} {
  const pathname = usePathname();
  const { can, isOwner } = usePermissions(project);

  // The readable sections of one group as nav items.
  const toItems = (sections: SettingsSection[]): SettingsNavItem[] =>
    sections
      .filter((s) => can(s.resource, 'read'))
      .map((s) => ({
        key: s.slug,
        href: projectKey ? settingsPath(projectKey, s.slug) : '#',
        icon: s.icon,
        label: s.label,
        active: pathname.endsWith(`/settings/${s.slug}`),
      }));

  const generalItems = toItems(GENERAL_SECTIONS);
  const workflowItems = toItems(CONFIGURATION_SECTIONS);
  const automationItems = toItems(AUTOMATION_SECTIONS);

  // Roles is owner-only and sits in the Project group; Members lives in the main
  // sidebar, not here.
  const rolesItems: SettingsNavItem[] = isOwner
    ? [
        {
          key: 'roles',
          href: projectKey ? rolesPath(projectKey) : '#',
          icon: Shield,
          label: 'Roles',
          active: pathname.endsWith('/members/roles'),
        },
      ]
    : [];

  const groups: SettingsNavGroup[] = [
    { key: 'general', label: 'Project', items: [...generalItems, ...rolesItems] },
    { key: 'workflow', label: 'Workflow', items: workflowItems },
    { key: 'automation', label: 'Automation', items: automationItems },
  ].filter((g) => g.items.length > 0);

  const firstHref = groups[0]?.items[0]?.href ?? null;

  return { groups, firstHref };
}
