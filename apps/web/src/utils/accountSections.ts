import {
  KeyRound,
  Link2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

// The account pages, in the order the user menu lists them. Every signed-in user
// reaches all of them, so there is no permission gate. Each slug is a page under
// /account/<slug>. Used by the user menu and the command palette's section search.
// The name of a page is a message under `sections.account`.
export type AccountSection = { slug: string; icon: LucideIcon };

export const ACCOUNT_SECTIONS: AccountSection[] = [
  { slug: 'profile', icon: UserRound },
  { slug: 'preferences', icon: SlidersHorizontal },
  { slug: 'accounts', icon: Link2 },
  { slug: 'security', icon: ShieldCheck },
  { slug: 'api-keys', icon: KeyRound },
];

export const accountPath = (slug: string) => `/account/${slug}`;
