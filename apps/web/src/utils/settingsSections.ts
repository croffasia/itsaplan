import {
  Bell,
  Bot,
  BookText,
  Clock3,
  Columns3,
  GitPullRequest,
  Info,
  KeyRound,
  ListPlus,
  type LucideIcon,
  Shapes,
  SlidersHorizontal,
  Tags,
  Webhook,
  Wrench,
  Zap,
} from 'lucide-react';
import type { PermissionResource } from '@/lib/api';

// The sidebar group a section is listed under: the project-level general
// settings, workflow configuration, automation/integrations, or the AI section
// (agents, providers, skills). 'ai-team' and 'ai' sections are listed in the main
// sidebar's AI Team group — 'ai-team' at its top level, 'ai' inside the
// "Configure" item — not in the project settings sidebar.
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
    slug: 'notifications',
    icon: Bell,
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
];

// The AI configuration items are their own nav routes (not /settings/:section
// pages), but reuse the SettingsSection shape for their page header and permission
// resource. They sit in the "Configure" item of the main sidebar's AI Team group.
export const AI_AGENTS_SECTION: SettingsSection = {
  slug: 'ai-agents',
  icon: Bot,
  resource: 'ai_agents',
  group: 'ai',
};

export const INTEGRATIONS_SECTION: SettingsSection = {
  slug: 'integrations',
  icon: KeyRound,
  resource: 'integrations',
  group: 'ai',
};

export const AGENT_SKILLS_SECTION: SettingsSection = {
  slug: 'agent-skills',
  icon: BookText,
  resource: 'agent_skills',
  group: 'ai',
};

export const AGENT_TOOLS_SECTION: SettingsSection = {
  slug: 'agent-tools',
  icon: Wrench,
  resource: 'agent_tools',
  group: 'ai',
};

// The "Configure" nav items, in sidebar order.
export const AI_SECTIONS: SettingsSection[] = [
  INTEGRATIONS_SECTION,
  AI_AGENTS_SECTION,
  AGENT_SKILLS_SECTION,
  AGENT_TOOLS_SECTION,
];

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
