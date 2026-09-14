import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { AgentFilter } from '../utils/agents';

const filters: { value: AgentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
];

export default function AgentsFilterBar({
  filter,
  search,
  counts,
  onFilterChange,
  onSearchChange,
}: {
  filter: AgentFilter;
  search: string;
  counts: Record<AgentFilter, number>;
  onFilterChange: (filter: AgentFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
              filter === item.value
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {item.label}
            <span className="tabular-nums opacity-70">{counts[item.value]}</span>
          </button>
        ))}
      </div>
      <label className="relative block w-full sm:w-72">
        <span className="sr-only">Search agents</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search agents..."
          className="pl-9"
        />
      </label>
    </div>
  );
}
