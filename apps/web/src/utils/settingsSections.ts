import {
  Archive,
  Bell,
  Bot,
  BookText,
  Clock3,
  Columns3,
  Info,
  KeyRound,
  ListPlus,
  type LucideIcon,
  Shapes,
  Tags,
  Webhook,
  Wrench,
  Zap,
} from 'lucide-react';
import type { PermissionResource } from '@/lib/api';

// The sidebar group a section is listed under: the project-level general
// settings, workflow configuration, automation/integrations, or the AI section
// (agents, providers, skills). 'ai-team' sections are listed in the main sidebar's
// AI Team group next to the chat, not in the project settings sidebar.
export type SettingsGroup = 'general' | 'configuration' | 'automation' | 'ai' | 'ai-team';

// The project settings sections, each mounted as its own page at
// /project/:projectKey/settings/:section, except the 'ai-team' group, which is
// mounted at /project/:projectKey/ai-team/:section. The slug is the route param; the tab
// components live in features/settings/components and take { project }. `resource`
// is the permission resource that gates the section: read to view it, and the
// create/edit/delete actions gate the controls inside. `group` places it in the
// sidebar (see CONFIGURATION_SECTIONS / AUTOMATION_SECTIONS).
export type SettingsSection = {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  resource: PermissionResource;
  group: SettingsGroup;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    slug: 'general',
    label: 'General',
    description: "The project's name and description. The key is fixed and prefixes every issue.",
    icon: Info,
    resource: 'danger_zone',
    group: 'general',
  },
  {
    slug: 'notifications',
    label: 'Notification providers',
    description:
      'The email (SMTP or Resend) and Telegram bot credentials this project delivers notifications through.',
    icon: Bell,
    resource: 'danger_zone',
    group: 'general',
  },
  {
    slug: 'states',
    label: 'States',
    description: 'The workflow states issues move through, each shown as a column.',
    icon: Columns3,
    resource: 'states',
    group: 'configuration',
  },
  {
    slug: 'issue-types',
    label: 'Issue types',
    description: 'The kinds of issues this project can hold, each with its own fields.',
    icon: Shapes,
    resource: 'issue_types',
    group: 'configuration',
  },
  {
    slug: 'labels',
    label: 'Labels',
    description: 'Tags for organizing and filtering issues across the project.',
    icon: Tags,
    resource: 'labels',
    group: 'configuration',
  },
  {
    slug: 'custom-fields',
    label: 'Custom fields',
    description: 'Extra fields shown on issues, global or scoped to an issue type.',
    icon: ListPlus,
    resource: 'custom_fields',
    group: 'configuration',
  },
  {
    slug: 'archive',
    label: 'Archive',
    description: 'Auto-archive stale completed and canceled issues so the board stays clear.',
    icon: Archive,
    resource: 'work_items',
    group: 'configuration',
  },
  {
    slug: 'actions',
    label: 'Actions',
    description:
      'One-click actions on an issue that apply field changes when its conditions match.',
    icon: Zap,
    resource: 'actions',
    group: 'automation',
  },
  {
    slug: 'schedules',
    label: 'Schedules',
    description: 'Run recurring agent tasks automatically. Schedule times use UTC.',
    icon: Clock3,
    resource: 'ai_agents',
    group: 'ai-team',
  },
  {
    slug: 'webhooks',
    label: 'Webhooks',
    description: 'Send project events to external URLs, signed with a per-webhook secret.',
    icon: Webhook,
    resource: 'webhooks',
    group: 'automation',
  },
];

// The AI section items are their own nav routes (not /settings/:section pages), but
// reuse the SettingsSection shape for their page header and permission resource.
// They sit in the AI sidebar group and are all gated by the ai_agents resource.
export const AI_AGENTS_SECTION: SettingsSection = {
  slug: 'ai-agents',
  label: 'Agents',
  description:
    'Bot users you can delegate issues to, driven through the API or by the built-in runtime.',
  icon: Bot,
  resource: 'ai_agents',
  group: 'ai',
};

export const INTEGRATIONS_SECTION: SettingsSection = {
  slug: 'integrations',
  label: 'Integrations',
  description:
    'Credentials for the services agents use: AI provider keys and tool integrations (Jina, Firecrawl, Telegram). Stored encrypted and never shown again.',
  icon: KeyRound,
  resource: 'integrations',
  group: 'ai',
};

export const AGENT_SKILLS_SECTION: SettingsSection = {
  slug: 'agent-skills',
  label: 'Skills',
  description:
    'Reusable instructions given to internal agents, loaded on demand. Write markdown, upload a file, or import from GitHub.',
  icon: BookText,
  resource: 'agent_skills',
  group: 'ai',
};

export const AGENT_TOOLS_SECTION: SettingsSection = {
  slug: 'agent-tools',
  label: 'Tools',
  description:
    'Tools agents can call, each connected to an integration credential. Configure a tool once, then enable it on an agent.',
  icon: Wrench,
  resource: 'agent_tools',
  group: 'ai',
};

// The AI section's nav items, in sidebar order.
export const AI_SECTIONS: SettingsSection[] = [
  AI_AGENTS_SECTION,
  INTEGRATIONS_SECTION,
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
