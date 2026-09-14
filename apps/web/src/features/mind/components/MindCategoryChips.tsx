import { Button } from '@/components/ui/button';
import type { MindFact } from '@/lib/api';
import { CATEGORY_META, CATEGORY_ORDER, countByCategory, type MindFilter } from '../utils/mind';

export default function MindCategoryChips({
  facts,
  filter,
  onChange,
}: {
  facts: MindFact[];
  filter: MindFilter;
  onChange: (filter: MindFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={filter.type === 'all' ? 'secondary' : 'ghost'}
        aria-pressed={filter.type === 'all'}
        className="h-7 rounded-full px-3 text-xs font-normal"
        onClick={() => onChange({ type: 'all' })}
      >
        All
        <span className="text-muted-foreground tabular-nums">{facts.length}</span>
      </Button>
      {CATEGORY_ORDER.map((category) => {
        const count = countByCategory(facts, category);
        if (count === 0) return null;
        const active = filter.type === 'category' && filter.category === category;
        const meta = CATEGORY_META[category];
        return (
          <Button
            key={category}
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            aria-pressed={active}
            className="h-7 rounded-full px-3 text-xs font-normal"
            onClick={() => onChange({ type: 'category', category })}
          >
            <meta.icon className="size-3.5" />
            {meta.label}
            <span className="text-muted-foreground tabular-nums">{count}</span>
          </Button>
        );
      })}
    </div>
  );
}
