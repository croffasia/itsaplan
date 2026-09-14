import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type SocialPostFilter = 'all' | 'published' | 'scheduled';

export default function SocialPostsToolbar({
  filter,
  search,
  counts,
  onFilterChange,
  onSearchChange,
}: {
  filter: SocialPostFilter;
  search: string;
  counts: Record<SocialPostFilter, number>;
  onFilterChange: (value: SocialPostFilter) => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-2">
        {(['all', 'published', 'scheduled'] as const).map((value) => (
          <Button
            key={value}
            variant={filter === value ? 'secondary' : 'ghost'}
            size="sm"
            className="capitalize"
            onClick={() => onFilterChange(value)}
          >
            {value}
            <span className="text-xs text-muted-foreground">{counts[value]}</span>
          </Button>
        ))}
      </div>
      <div className="relative sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search posts"
          className="pl-9"
        />
      </div>
    </div>
  );
}
