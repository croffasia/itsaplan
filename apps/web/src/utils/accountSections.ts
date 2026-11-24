import {
  Bell,
  KeyRound,
  Link2,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

// The account pages, in the order the user menu lists them. Every signed-in user
// reaches all of them, so there is no permission gate. Each slug is a page under
// /account/<slug>. Used by the user menu and the command palette's section search.
// The name of a page is a message under `sections.account`. `keywords` are further words
// the palette finds it by.
export type AccountSection = { slug: string; icon: LucideIcon; keywords?: string };

export const ACCOUNT_SECTIONS: AccountSection[] = [
  { slug: 'profile', icon: UserRound },
  { slug: 'preferences', icon: SlidersHorizontal },
  { slug: 'notifications', icon: Bell, keywords: 'email telegram slack push' },
  { slug: 'accounts', icon: Link2 },
  { slug: 'invitations', icon: Mail },
  { slug: 'security', icon: ShieldCheck },
  { slug: 'api-keys', icon: KeyRound },
];

export const accountPath = (slug: string) => `/account/${slug}`;
