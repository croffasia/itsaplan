import { useTranslations } from 'next-intl';
import type { RunnerQueueState } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';

// The states the list narrows to, with how many runs each holds under the other filters.
export default function RunnerQueueStateFilter({
  value,
  active,
  failed,
  onChange,
}: {
  value: RunnerQueueState | undefined;
  active: number | undefined;
  failed: number | undefined;
  onChange: (value: RunnerQueueState | undefined) => void;
}) {
  const t = useTranslations('issue.agentRuns');
  const options = [
    { value: undefined, label: t('filterAll'), count: undefined },
    { value: 'active', label: t('activeSection'), count: active },
    { value: 'failed', label: t('filterFailed'), count: failed },
  ] as const;

  return (
    <div role="group" aria-label={t('facts.status')} className="flex flex-wrap gap-1 px-3 pb-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            option.value === value
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent/50',
          )}
        >
          {option.label}
          {option.count !== undefined && option.count > 0 && (
            <span className="font-normal tabular-nums">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
