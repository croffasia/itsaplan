import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

// The text search of the run list.
export default function RunnerQueueSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('issue.agentRuns');
  return (
    <div className="px-4 pb-2">
      <label className="flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
        <Search aria-hidden className="size-4 shrink-0" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('searchRuns')}
          aria-label={t('searchRuns')}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </label>
    </div>
  );
}
