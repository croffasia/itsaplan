import { usePathname } from 'next/navigation';
import { Shield, type LucideIcon } from 'lucide-react';
import {
  aiAgentsPath,
  agentSkillsPath,
  agentToolsPath,
  integrationsPath,
  rolesPath,
  settingsPath,
} from '@/utils/paths';
import {
  AI_SECTIONS,
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

// The route each AI section slug navigates to (AI items are their own nav routes,
// not /settings/:slug pages).
const AI_SECTION_PATH: Record<string, (key: string) => string> = {
  'ai-agents': aiAgentsPath,
  integrations: integrationsPath,
  'agent-skills': agentSkillsPath,
  'agent-tools': agentToolsPath,
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

  // The readable sections of one group as nav items. `activeBase` is the path
  // segment the slug is appended to when matching the current route.
  const toItems = (
    sections: SettingsSection[],
    hrefFor: (key: string, slug: string) => string,
    activeBase: string,
  ): SettingsNavItem[] =>
    sections
      .filter((s) => can(s.resource, 'read'))
      .map((s) => ({
        key: s.slug,
        href: projectKey ? hrefFor(projectKey, s.slug) : '#',
        icon: s.icon,
        label: s.label,
        active: pathname.endsWith(`${activeBase}/${s.slug}`),
      }));

  const aiItems = toItems(AI_SECTIONS, (key, slug) => AI_SECTION_PATH[slug](key), '');
  const generalItems = toItems(GENERAL_SECTIONS, settingsPath, '/settings');
  const workflowItems = toItems(CONFIGURATION_SECTIONS, settingsPath, '/settings');
  const automationItems = toItems(AUTOMATION_SECTIONS, settingsPath, '/settings');

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
    { key: 'ai', label: 'AI Team', items: aiItems },
    { key: 'workflow', label: 'Workflow', items: workflowItems },
    { key: 'automation', label: 'Automation', items: automationItems },
  ].filter((g) => g.items.length > 0);

  const firstHref = groups[0]?.items[0]?.href ?? null;

  return { groups, firstHref };
}
