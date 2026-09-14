import {
  Archive,
  Boxes,
  Briefcase,
  BookOpen,
  CalendarDays,
  Server,
  Target,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { MindCategory, MindFact, MindStatus } from '@/lib/api';

export const CATEGORY_META: Record<MindCategory, { label: string; icon: LucideIcon }> = {
  goals: { label: 'Goals & targets', icon: Target },
  routines: { label: 'Routines & cadence', icon: Timer },
  people: { label: 'People', icon: Users },
  clients: { label: 'Clients', icon: Briefcase },
  infra: { label: 'Infra', icon: Server },
  business: { label: 'Business', icon: Boxes },
  knowledge: { label: 'Knowledge', icon: BookOpen },
  daily_notes: { label: 'Daily notes', icon: CalendarDays },
  archive: { label: 'Archive', icon: Archive },
};

// The order the sections read in: what the operation is aiming at first, the
// day-to-day after it, and the raw capture inbox last.
export const CATEGORY_ORDER: MindCategory[] = [
  'goals',
  'routines',
  'people',
  'clients',
  'infra',
  'business',
  'knowledge',
  'daily_notes',
  'archive',
];

export const STATUS_LABEL: Record<MindStatus, string> = {
  unverified: 'Unverified',
  verified: 'Verified',
  flagged: 'Flagged',
  conflicted: 'Conflict',
};

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function countByCategory(facts: MindFact[], category: MindCategory): number {
  return facts.filter((fact) => fact.category === category).length;
}

export function topTags(facts: MindFact[], limit: number): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const fact of facts) {
    for (const tag of fact.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export type MindFilter = { type: 'all' } | { type: 'category'; category: MindCategory };

export function filterFacts(facts: MindFact[], filter: MindFilter, search: string): MindFact[] {
  const needle = search.trim().toLowerCase();
  return facts.filter((fact) => {
    if (filter.type === 'category' && fact.category !== filter.category) return false;
    if (needle.length === 0) return true;
    return (
      fact.title.toLowerCase().includes(needle) ||
      fact.body.toLowerCase().includes(needle) ||
      fact.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });
}

export interface CategoryGroup {
  category: MindCategory;
  facts: MindFact[];
}

// Groups the visible facts into the reading order above, dropping the categories
// that hold nothing.
export function groupByCategory(facts: MindFact[]): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    facts: facts.filter((fact) => fact.category === category),
  })).filter((group) => group.facts.length > 0);
}
