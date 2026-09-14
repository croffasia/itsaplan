import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Competitor } from '@/lib/api';
import {
  PLATFORM_META,
  PLATFORM_ORDER,
  countByPlatform,
  needsAttention,
  type CompetitorFilter,
} from '../utils/competitors';

function isActive(filter: CompetitorFilter, candidate: CompetitorFilter): boolean {
  if (filter.type !== candidate.type) return false;
  if (filter.type === 'platform' && candidate.type === 'platform') {
    return filter.platform === candidate.platform;
  }
  return true;
}

export default function CompetitorFilters({
  items,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  items: Competitor[];
  filter: CompetitorFilter;
  onFilterChange: (filter: CompetitorFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
}) {
  const attention = items.filter(needsAttention).length;
  const chips: { key: string; label: string; count: number; value: CompetitorFilter }[] = [
    { key: 'all', label: 'All', count: items.length, value: { type: 'all' } },
    ...PLATFORM_ORDER.map((platform) => ({
      key: platform,
      label: PLATFORM_META[platform].label,
      count: countByPlatform(items, platform),
      value: { type: 'platform', platform } as CompetitorFilter,
    })),
    { key: 'attention', label: 'Needs attention', count: attention, value: { type: 'attention' } },
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
          placeholder="Filter accounts, tags…"
          className="h-8 pl-8 text-xs"
        />
      </div>
    </div>
  );
}
