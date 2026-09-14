import { Brain, CheckSquare, FileText, Mic, type LucideIcon } from 'lucide-react';
import type { BraindumpDestination, BraindumpEntry, BraindumpKind } from '@/lib/api';

export const KIND_META: Record<BraindumpKind, { label: string; icon: LucideIcon }> = {
  idea: { label: 'Idea', icon: Brain },
  task: { label: 'Task', icon: CheckSquare },
  note: { label: 'Note', icon: FileText },
  voice: { label: 'Voice memo', icon: Mic },
};

export const DESTINATION_META: Record<
  BraindumpDestination,
  { label: string; target: string; description: string }
> = {
  obsidian: {
    label: 'Save & forget',
    target: 'Obsidian vault',
    description: 'Writes a markdown note and leaves it there.',
  },
  issue: {
    label: 'Save & convert to task',
    target: 'Work items',
    description: 'Opens a work item in the first column of this project.',
  },
  schedule: {
    label: 'Save & schedule',
    target: 'Agent cron',
    description: 'Hands the text to an agent on a repeating schedule.',
  },
};

export function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// The tags across the loaded window, most used first, so the filter row offers the
// ones actually worth clicking rather than every tag ever typed.
export function topTags(entries: BraindumpEntry[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function countByKind(entries: BraindumpEntry[], kind: BraindumpKind): number {
  return entries.filter((entry) => entry.kind === kind).length;
}

export function countByTag(entries: BraindumpEntry[], tag: string): number {
  return entries.filter((entry) => entry.tags.includes(tag)).length;
}

export type StreamFilter =
  { type: 'all' } | { type: 'kind'; kind: BraindumpKind } | { type: 'tag'; tag: string };

export function filterEntries(
  entries: BraindumpEntry[],
  filter: StreamFilter,
  search: string,
): BraindumpEntry[] {
  const needle = search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter.type === 'kind' && entry.kind !== filter.kind) return false;
    if (filter.type === 'tag' && !entry.tags.includes(filter.tag)) return false;
    if (needle.length === 0) return true;
    return (
      entry.title.toLowerCase().includes(needle) ||
      entry.body.toLowerCase().includes(needle) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });
}

export interface DayGroup {
  key: string;
  label: string;
  entries: BraindumpEntry[];
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Groups the stream by calendar day in the reader's own timezone, newest day first.
// The two most recent days are named rather than dated, matching how the header
// reads the current day.
export function groupByDay(entries: BraindumpEntry[]): DayGroup[] {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const groups = new Map<string, DayGroup>();

  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = dayKey(date);
    let group = groups.get(key);
    if (!group) {
      const label =
        key === today
          ? 'Today'
          : key === yesterday
            ? 'Yesterday'
            : date.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
      group = { key, label, entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

// Splits a capture box's text into the body and the #tags typed inside it, so tags
// are captured in the same keystrokes as the thought.
export function extractTags(text: string): { body: string; tags: string[] } {
  const tags: string[] = [];
  const body = text
    .replace(/(^|\s)#([\p{L}\p{N}_-]{1,40})/gu, (_match, lead: string, tag: string) => {
      const normalized = tag.toLowerCase();
      if (!tags.includes(normalized)) tags.push(normalized);
      return lead;
    })
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return { body, tags };
}
