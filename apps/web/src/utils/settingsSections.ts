import type { ComponentType } from 'react';
import {
  Bot,
  Clock3,
  Columns3,
  FileText,
  GitPullRequest,
  Import,
  Info,
  ListPlus,
  type LucideIcon,
  Shapes,
  SlidersHorizontal,
  Tags,
  Webhook,
  Zap,
} from 'lucide-react';
import type { PermissionAction, PermissionResource } from '@/lib/api/endpoints/roles';

// The project settings sections, each mounted as its own page at
// /:team/:projectKey/settings/:section, except the 'ai-team' group, which is
// mounted at /:team/:projectKey/agents/:section. The slug is the route param; the tab
// components live in features/settings/components and take { project }. `resource`
// is the permission resource that gates the section: `viewAction` (read unless set)
// to view it, and the create/edit/delete actions gate the controls inside. `group` is
// the heading the settings sidebar lists it under, named in `nav.groups`; the 'ai-team'
// and 'ai' sections are listed in the main sidebar's AI Team group instead. The name and
// the blurb of a section are messages under `sections.settings`. A section the hosted
// build adds (`useProjectSettingsSections` in `@/cloud`) carries its page in `Component`.
export type SettingsSection = {
  slug: string;
  icon: LucideIcon;
  resource: PermissionResource;
  viewAction?: PermissionAction;
  group: string;
  Component?: ComponentType;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    slug: 'general',
    icon: Info,
    resource: 'danger_zone',
    group: 'project',
  },
  {
    slug: 'states',
    icon: Columns3,
    resource: 'states',
    group: 'workflow',
  },
  {
    slug: 'issue-types',
    icon: Shapes,
    resource: 'issue_types',
    group: 'workflow',
  },
  {
    slug: 'labels',
    icon: Tags,
    resource: 'labels',
    group: 'workflow',
  },
  {
    slug: 'custom-fields',
    icon: ListPlus,
    resource: 'custom_fields',
    group: 'workflow',
  },
  {
    slug: 'issue-templates',
    icon: FileText,
    resource: 'issue_templates',
    group: 'workflow',
  },
  {
    slug: 'configuration',
    icon: SlidersHorizontal,
    resource: 'workflow_config',
    group: 'workflow',
  },
  {
    slug: 'actions',
    icon: Zap,
    resource: 'actions',
    group: 'automation',
  },
  {
    slug: 'queue',
    icon: Clock3,
    resource: 'ai_agents',
    group: 'ai-team',
  },
  {
    slug: 'schedules',
    icon: Clock3,
    resource: 'ai_agents',
    group: 'ai-team',
  },
  {
    slug: 'webhooks',
    icon: Webhook,
    resource: 'webhooks',
    group: 'automation',
  },
  {
    slug: 'git',
    icon: GitPullRequest,
    resource: 'repositories',
    viewAction: 'edit',
    group: 'automation',
  },
  {
    slug: 'import-export',
    icon: Import,
    resource: 'import_export',
    group: 'automation',
  },
];

// The agents section is its own nav route (not a /settings/:section page), but
// reuses the SettingsSection shape for its page header and permission resource. It
// is listed in the main sidebar's AI Team group.
export const AI_AGENTS_SECTION: SettingsSection = {
  slug: 'ai-agents',
  icon: Bot,
  resource: 'ai_agents',
  group: 'ai',
};

// The sections the project settings sidebar lists.
export const SETTINGS_MENU_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.group !== 'ai-team');
export const AI_TEAM_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.group === 'ai-team');

const BY_SLUG = new Map(SETTINGS_SECTIONS.map((s) => [s.slug, s]));

// The section config for a known slug. Throws on an unknown slug (a routing or
// typo bug); callers pass a literal slug matching a SETTINGS_SECTIONS entry.
export function settingsSection(slug: string): SettingsSection {
  const section = BY_SLUG.get(slug);
  if (!section) throw new Error(`Unknown settings section: ${slug}`);
  return section;
}
