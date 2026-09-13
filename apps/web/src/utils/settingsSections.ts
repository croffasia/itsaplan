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
import type { PermissionResource } from '@/lib/api/endpoints/roles';

// The sidebar group a section is listed under: the project-level general settings,
// workflow configuration, automation/integrations, or the AI section. 'ai-team' and
// 'ai' sections are listed in the main sidebar's AI Team group, not in the project
// settings sidebar.
export type SettingsGroup = 'general' | 'configuration' | 'automation' | 'ai' | 'ai-team';

// The project settings sections, each mounted as its own page at
// /project/:projectKey/settings/:section, except the 'ai-team' group, which is
// mounted at /project/:projectKey/ai-team/:section. The slug is the route param; the tab
// components live in features/settings/components and take { project }. `resource`
// is the permission resource that gates the section: read to view it, and the
// create/edit/delete actions gate the controls inside. `group` places it in the
// sidebar (see CONFIGURATION_SECTIONS / AUTOMATION_SECTIONS). The name and the
// blurb of a section are messages under `sections.settings`.
export type SettingsSection = {
  slug: string;
  icon: LucideIcon;
  resource: PermissionResource;
  group: SettingsGroup;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    slug: 'general',
    icon: Info,
    resource: 'danger_zone',
    group: 'general',
  },
  {
    slug: 'states',
    icon: Columns3,
    resource: 'states',
    group: 'configuration',
  },
  {
    slug: 'issue-types',
    icon: Shapes,
    resource: 'issue_types',
    group: 'configuration',
  },
  {
    slug: 'labels',
    icon: Tags,
    resource: 'labels',
    group: 'configuration',
  },
  {
    slug: 'custom-fields',
    icon: ListPlus,
    resource: 'custom_fields',
    group: 'configuration',
  },
  {
    slug: 'issue-templates',
    icon: FileText,
    resource: 'issue_templates',
    group: 'configuration',
  },
  {
    slug: 'configuration',
    icon: SlidersHorizontal,
    resource: 'workflow_config',
    group: 'configuration',
  },
  {
    slug: 'actions',
    icon: Zap,
    resource: 'actions',
    group: 'automation',
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
    resource: 'integrations',
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

// The settings sections split by sidebar group.
export const GENERAL_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.group === 'general');
export const CONFIGURATION_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.group === 'configuration');
export const AUTOMATION_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.group === 'automation');
export const AI_TEAM_SECTIONS = SETTINGS_SECTIONS.filter((s) => s.group === 'ai-team');

const BY_SLUG = new Map(SETTINGS_SECTIONS.map((s) => [s.slug, s]));

// The section config for a known slug. Throws on an unknown slug (a routing or
// typo bug); callers pass a literal slug matching a SETTINGS_SECTIONS entry.
export function settingsSection(slug: string): SettingsSection {
  const section = BY_SLUG.get(slug);
  if (!section) throw new Error(`Unknown settings section: ${slug}`);
  return section;
}
