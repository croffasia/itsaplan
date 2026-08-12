// Icon choices for a saved view. kanban_views.icon stores one of these keys (or
// null for the default). Kept to a small curated set so the picker fits in a
// popover and every stored name resolves to a component.

import {
  Bot,
  Bug,
  Calendar,
  CheckCircle,
  Clock,
  Flag,
  Inbox,
  Layers,
  List,
  BookOpen,
  Star,
  Tag,
  User,
  type LucideIcon,
} from 'lucide-react';

export const VIEW_ICONS: Record<string, LucideIcon> = {
  list: List,
  bug: Bug,
  post: BookOpen,
  user: User,
  bot: Bot,
  star: Star,
  flag: Flag,
  inbox: Inbox,
  check: CheckCircle,
  clock: Clock,
  layers: Layers,
  tag: Tag,
  calendar: Calendar,
};

export const VIEW_ICON_NAMES = Object.keys(VIEW_ICONS);

// A view's icon component, falling back to the generic list icon for an unknown or
// null name.
export function viewIcon(name: string | null): LucideIcon {
  return (name && VIEW_ICONS[name]) || List;
}

export function ViewIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = viewIcon(name);
  return <Icon className={className} />;
}
