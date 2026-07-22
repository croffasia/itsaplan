import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

// One selectable capability row (a skill or a configured tool), normalized so the
// list renders skills and tools the same way. `search` is the lowercased haystack the
// filter matches against.
export interface CapabilityItem {
  id: number;
  checked: boolean;
  title: string;
  subtitle: string;
  search: string;
}

// A searchable, height-capped checklist of an agent's capabilities. The search box
// appears once the list is long enough to warrant it; the list scrolls past a fixed
// height so a big library does not push the rest of the form off screen. Shared by the
// Skills and Tools sections of the agent form.
export function AgentCapabilityList({
  items,
  onToggle,
  searchPlaceholder,
}: {
  items: CapabilityItem[];
  onToggle: (id: number, on: boolean) => void;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.search.includes(q));
  }, [items, query]);

  const showSearch = items.length > 5;

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pr-9 pl-9 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {matches.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No match for &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          matches.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-2">
              <Checkbox
                className="mt-0.5"
                checked={item.checked}
                onCheckedChange={(v) => onToggle(item.id, v === true)}
              />
              <span>
                <span className="text-sm">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.subtitle}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
