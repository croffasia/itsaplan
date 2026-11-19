import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueState } from '@/lib/api/endpoints/runnerQueue';

// The filter by how runs stand, each with how many runs it holds, and the text search.
export default function RunnerQueueFilters({
  state,
  onStateChange,
  search,
  onSearchChange,
  failed,
  active,
}: {
  state: RunnerQueueState | undefined;
  onStateChange: (state: RunnerQueueState | undefined) => void;
  search: string;
  onSearchChange: (search: string) => void;
  failed: number;
  active: number;
}) {
  const t = useTranslations('issue.agentRuns');
  const chips: [RunnerQueueState | undefined, string, number][] = [
    [undefined, t('filterAll'), 0],
    ['failed', t('filterFailed'), failed],
    ['active', t('activeSection'), active],
  ];
  return (
    <div className="space-y-2 px-4 pb-2">
      <div role="group" aria-label={t('filterRuns')} className="flex flex-wrap gap-1">
        {chips.map(([value, label, count]) => (
          <button
            key={label}
            type="button"
            aria-pressed={state === value}
            onClick={() => onStateChange(value)}
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border transition-colors outline-none ring-inset hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:ring-transparent"
          >
            {label}
            {count > 0 && <span className="ms-1 tabular-nums opacity-70">{count}</span>}
          </button>
        ))}
      </div>
      <label className="flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
        <Search aria-hidden className="size-4 shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('searchRuns')}
          aria-label={t('searchRuns')}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </label>
    </div>
  );
}
