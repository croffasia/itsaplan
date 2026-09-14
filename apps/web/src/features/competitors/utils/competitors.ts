import { Facebook, Instagram, Music2, type LucideIcon } from 'lucide-react';
import type { Competitor, CompetitorPlatform } from '@/lib/api';

export const PLATFORM_META: Record<
  CompetitorPlatform,
  { label: string; icon: LucideIcon; profileUrl: (handle: string) => string }
> = {
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    profileUrl: (handle) => `https://www.instagram.com/${handle}`,
  },
  // Lucide has no TikTok glyph; Music2 is the closest thing that reads as short
  // video without shipping a second icon set.
  tiktok: {
    label: 'TikTok',
    icon: Music2,
    profileUrl: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    profileUrl: (handle) => `https://www.facebook.com/${handle}`,
  },
};

export const PLATFORM_ORDER: CompetitorPlatform[] = ['instagram', 'tiktok', 'facebook'];

export const EVENT_LABEL: Record<string, string> = {
  new_post: 'New post',
  followers_jump: 'Followers up',
  followers_drop: 'Followers down',
  profile_changed: 'Profile changed',
  went_quiet: 'Went quiet',
  check_failed: 'Check failed',
};

export function compactNumber(value: number | null): string {
  if (value == null) return '—';
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// "4h ago" style, for a column that has to stay narrow. Anything past a week falls
// back to a date, which is more useful than "23d ago".
export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export type CompetitorFilter =
  { type: 'all' } | { type: 'platform'; platform: CompetitorPlatform } | { type: 'attention' };

// An account needs attention when its last check failed, or when it has never
// produced a reading — both mean the numbers on screen are not to be trusted.
export function needsAttention(item: Competitor): boolean {
  return item.consecutiveFailures > 0 || item.latest == null;
}

export function countByPlatform(items: Competitor[], platform: CompetitorPlatform): number {
  return items.filter((item) => item.platform === platform).length;
}

export function filterCompetitors(
  items: Competitor[],
  filter: CompetitorFilter,
  search: string,
): Competitor[] {
  const needle = search.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.type === 'platform' && item.platform !== filter.platform) return false;
    if (filter.type === 'attention' && !needsAttention(item)) return false;
    if (needle.length === 0) return true;
    return (
      item.handle.toLowerCase().includes(needle) ||
      (item.label ?? '').toLowerCase().includes(needle) ||
      item.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });
}
