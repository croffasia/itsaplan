import {
  FolderKanban,
  HardDrive,
  Keyboard,
  KeyRound,
  Mail,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react';

// The god mode sections, in sidebar order. God mode is instance administration,
// open only to the owner account; the sections mirror the project settings pattern
// (one slug per page under /god/<slug>), so adding one is an entry here plus a page.
// `group` is the sidebar heading a section sits under; GOD_GROUPS gives the order.
// A section with `integration: true` is not listed under its group directly: it sits
// inside the collapsible "Integrations" item at the end of the group.

export const GOD_GROUPS = ['Management', 'Instance'] as const;
export type GodGroup = (typeof GOD_GROUPS)[number];

export interface GodSection {
  slug: string;
  label: string;
  description: string;
  group: GodGroup;
  icon: LucideIcon;
  integration?: true;
}

export const GOD_SECTIONS: GodSection[] = [
  {
    slug: 'users',
    label: 'Users',
    description:
      'Every account on this instance: the global role, whether the address is confirmed, and the projects each user can reach.',
    group: 'Management',
    icon: Users,
  },
  {
    slug: 'projects',
    label: 'Projects',
    description:
      'Every project on this instance: what each one holds, when it was last active, and who can reach it.',
    group: 'Management',
    icon: FolderKanban,
  },
  {
    slug: 'authentication',
    label: 'Authentication',
    description:
      'Who may register on this instance, how accounts are confirmed, and the providers people sign in with.',
    group: 'Instance',
    icon: KeyRound,
  },
  {
    slug: 'hotkeys',
    label: 'Keyboard shortcuts',
    description:
      'The key each command is bound to for everyone on this instance. Each person can rebind a shortcut for their own account in their preferences.',
    group: 'Instance',
    icon: Keyboard,
  },
  {
    slug: 'storage',
    label: 'Storage',
    description:
      'How much people may upload: the size of a single file, the attachment types accepted, and the storage each project gets.',
    group: 'Instance',
    icon: HardDrive,
  },
  {
    slug: 'telegram',
    label: 'Telegram',
    description:
      'The bot people connect their Telegram account to, and the one that delivers Telegram notifications for projects that set no bot of their own.',
    group: 'Instance',
    icon: Send,
    integration: true,
  },
  {
    slug: 'email',
    label: 'Email provider',
    description:
      'The mail provider the instance sends through: password resets, address confirmation, and sign-in links.',
    group: 'Instance',
    icon: Mail,
    integration: true,
  },
  {
    slug: 'auth-provider',
    label: 'Auth provider',
    description: 'The external accounts people may sign in with.',
    group: 'Instance',
    icon: KeyRound,
    integration: true,
  },
];

export function godSection(slug: string): GodSection {
  const section = GOD_SECTIONS.find((s) => s.slug === slug);
  if (!section) throw new Error(`Unknown god section: ${slug}`);
  return section;
}

export function godSectionsIn(group: GodGroup): GodSection[] {
  return GOD_SECTIONS.filter((s) => s.group === group && !s.integration);
}

export function godIntegrationsIn(group: GodGroup): GodSection[] {
  return GOD_SECTIONS.filter((s) => s.group === group && s.integration);
}
