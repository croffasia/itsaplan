import { useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type LucideIcon } from 'lucide-react';
import { useProjectSettingsSections } from '@/cloud';
import { ShellCtx } from '@/context/shellContext';
import { settingsPath } from '@/utils/paths';
import { byKey } from '@/utils/messageKey';
import { SETTINGS_MENU_SECTIONS, type SettingsSection } from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';

// The project settings sidebar (the "Project settings" mode) lists the sections
// flat under group labels, the groups in the order their first section comes. This
// hook builds those groups from the sections and the viewer's permissions, and
// reports the first reachable destination so the main sidebar's "Project settings"
// entry knows where to point.

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

// The sections of the settings sidebar, the hosted build's included. `project` is
// only passed by the Shell, which calls this above its own context provider;
// everything else reads the project from the context.
export function useSettingsSections(project?: ProjectDetail | null): SettingsSection[] {
  const ctx = useContext(ShellCtx);
  return useProjectSettingsSections(project ?? ctx?.project ?? null, SETTINGS_MENU_SECTIONS);
}

export function useSettingsNavGroups(
  projectKey: string | null,
  project?: ProjectDetail | null,
): {
  groups: SettingsNavGroup[];
  firstHref: string | null;
} {
  const groupLabel = byKey(useTranslations('nav.groups'));
  const sectionText = useSettingsSectionText();
  const pathname = usePathname();
  const { can } = usePermissions(project);
  const sections = useSettingsSections(project).filter((s) =>
    can(s.resource, s.viewAction ?? 'read'),
  );

  const groups: SettingsNavGroup[] = [...new Set(sections.map((s) => s.group))].map((group) => ({
    key: group,
    label: groupLabel(group),
    items: sections
      .filter((s) => s.group === group)
      .map((s) => ({
        key: s.slug,
        href: projectKey ? settingsPath(projectKey, s.slug) : '#',
        icon: s.icon,
        label: sectionText(s.slug).label,
        active: pathname.endsWith(`/settings/${s.slug}`),
      })),
  }));

  const firstHref = groups[0]?.items[0]?.href ?? null;

  return { groups, firstHref };
}
