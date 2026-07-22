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
export type AccountSection = { slug: string; label: string; icon: LucideIcon };

export const ACCOUNT_SECTIONS: AccountSection[] = [
  { slug: 'profile', label: 'Profile', icon: UserRound },
  { slug: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { slug: 'accounts', label: 'Accounts', icon: Link2 },
  { slug: 'security', label: 'Security', icon: ShieldCheck },
  { slug: 'api-keys', label: 'API keys', icon: KeyRound },
];

export const accountPath = (slug: string) => `/account/${slug}`;
