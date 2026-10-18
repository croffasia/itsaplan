import type { ComponentType } from 'react';
import {
  Building2,
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
import { godSections } from '@/cloud';

// The god mode sections, in sidebar order. God mode is instance administration,
// open only to the owner account; the sections mirror the project settings pattern
// (one slug per page under /god/<slug>), so adding one is an entry here plus a page.
// `group` is the sidebar heading a section sits under; the groups come in the order
// their first section has in the list.
// A section with `integration: true` is not listed under its group directly: it sits
// inside the "Integrations" item at the end of the group. The name and the blurb of
// a section are messages under `sections.god`, the name of a group under
// `sections.godGroups`. The hosted build gets the list through `godSections` in `@/cloud`
// and may add, replace or drop sections; one it adds carries its page in `Component`,
// opened at /god/<slug>, may open a group of its own, and its messages come with the
// hosted build's.

export interface GodSection {
  slug: string;
  group: string;
  icon: LucideIcon;
  integration?: true;
  Component?: ComponentType;
}

export const GOD_SECTIONS: GodSection[] = godSections([
  {
    slug: 'users',
    group: 'management',
    icon: Users,
  },
  {
    slug: 'teams',
    group: 'management',
    icon: Building2,
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
]);

export const GOD_GROUPS = [...new Set(GOD_SECTIONS.map((s) => s.group))];

export function godSection(slug: string): GodSection {
  const section = GOD_SECTIONS.find((s) => s.slug === slug);
  if (!section) throw new Error(`Unknown god section: ${slug}`);
  return section;
}

export function godSectionsIn(group: string): GodSection[] {
  return GOD_SECTIONS.filter((s) => s.group === group && !s.integration);
}

export function godIntegrationsIn(group: string): GodSection[] {
  return GOD_SECTIONS.filter((s) => s.group === group && s.integration);
}
