import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BraindumpEntry, BraindumpKind } from '@/lib/api';
import { KIND_META, countByKind, countByTag, topTags, type StreamFilter } from '../utils/braindump';

const KINDS: BraindumpKind[] = ['idea', 'task', 'note', 'voice'];
const MAX_TAG_CHIPS = 4;

function isActive(filter: StreamFilter, candidate: StreamFilter): boolean {
  if (filter.type !== candidate.type) return false;
  if (filter.type === 'kind' && candidate.type === 'kind') return filter.kind === candidate.kind;
  if (filter.type === 'tag' && candidate.type === 'tag') return filter.tag === candidate.tag;
  return true;
}

export default function BraindumpStreamFilters({
  entries,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  entries: BraindumpEntry[];
  filter: StreamFilter;
  onFilterChange: (filter: StreamFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
}) {
  const chips: { key: string; label: string; count: number; value: StreamFilter }[] = [
    { key: 'all', label: 'All', count: entries.length, value: { type: 'all' } },
    ...KINDS.map((kind) => ({
      key: kind,
      label: `${KIND_META[kind].label}s`,
      count: countByKind(entries, kind),
      value: { type: 'kind', kind } as StreamFilter,
    })),
    ...topTags(entries, MAX_TAG_CHIPS).map((tag) => ({
      key: `tag:${tag}`,
      label: `#${tag}`,
      count: countByTag(entries, tag),
      value: { type: 'tag', tag } as StreamFilter,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips
          .filter((chip) => chip.count > 0 || chip.key === 'all')
          .map((chip) => (
            <Button
              key={chip.key}
              type="button"
              size="sm"
              variant={isActive(filter, chip.value) ? 'secondary' : 'ghost'}
              aria-pressed={isActive(filter, chip.value)}
              className="h-7 rounded-full px-3 text-xs font-normal"
              onClick={() => onFilterChange(chip.value)}
            >
              {chip.label}
              <span className="text-muted-foreground tabular-nums">{chip.count}</span>
            </Button>
          ))}
      </div>
      <div className="relative w-full sm:w-64">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter dumps…"
          className="h-8 pl-8 text-xs"
        />
      </div>
    </div>
  );
}
