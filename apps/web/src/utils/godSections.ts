import {
  FolderKanban,
  HardDrive,
  Keyboard,
  KeyRound,
  Mail,
  Send,
  SlidersHorizontal,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

// The god mode sections, in sidebar order. God mode is instance administration,
// open only to the owner account; the sections mirror the project settings pattern
// (one slug per page under /god/<slug>), so adding one is an entry here plus a page.
// `group` is the sidebar heading a section sits under; GOD_GROUPS gives the order.
// A section with `integration: true` is not listed under its group directly: it sits
// inside the "Integrations" item at the end of the group. The name and the blurb of
// a section, and the name of a group, are messages under `sections.god`.

export const GOD_GROUPS = ['management', 'instance'] as const;
export type GodGroup = (typeof GOD_GROUPS)[number];

export interface GodSection {
  slug: string;
  group: GodGroup;
  icon: LucideIcon;
  integration?: true;
}

export const GOD_SECTIONS: GodSection[] = [
  {
    slug: 'users',
    group: 'management',
    icon: Users,
  },
  {
    slug: 'projects',
    group: 'management',
    icon: FolderKanban,
  },
  {
    slug: 'general',
    group: 'instance',
    icon: SlidersHorizontal,
  },
  {
    slug: 'authentication',
    group: 'instance',
    icon: KeyRound,
  },
  {
    slug: 'hotkeys',
    group: 'instance',
    icon: Keyboard,
  },
  {
    slug: 'storage',
    group: 'instance',
    icon: HardDrive,
  },
  {
    slug: 'telegram',
    group: 'instance',
    icon: Send,
    integration: true,
  },
  {
    slug: 'email',
    group: 'instance',
    icon: Mail,
    integration: true,
  },
  {
    slug: 'auth-provider',
    group: 'instance',
    icon: KeyRound,
    integration: true,
  },
  {
    slug: 'scim',
    group: 'instance',
    icon: UsersRound,
    integration: true,
  },
];

// The content column a god page occupies. Shared with the skeletons that stand in
// for a page, so a loading section is the width of the section that replaces it.
export const GOD_COLUMN_CLASS = 'min-w-[600px] max-w-[60%]';

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
