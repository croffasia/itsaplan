import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { WIDGET_GROUPS, type WidgetGroupKey } from '../utils/widgetCatalog';

const CHOICES: (WidgetGroupKey | null)[] = [null, ...WIDGET_GROUPS.map((g) => g.key)];

// The search and the group switch over the add panel's list. A null group shows all.
export default function AddWidgetPanelFilters({
  query,
  onQueryChange,
  group,
  onGroupChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  group: WidgetGroupKey | null;
  onGroupChange: (group: WidgetGroupKey | null) => void;
}) {
  const t = useTranslations('dashboards');
  return (
    <div className="space-y-2.5 px-5 pb-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          aria-label={t('searchWidgets')}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('searchWidgets')}
          className="ps-9 pe-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t('clearSearch')}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div role="group" aria-label={t('addPanel.groupFilter')} className="flex flex-wrap gap-1">
        {CHOICES.map((key) => (
          <button
            key={key ?? 'all'}
            type="button"
            aria-pressed={group === key}
            onClick={() => onGroupChange(key)}
            className={cn(
              'h-7 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              group === key
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {key ? t(`widgetGroups.${key}`) : t('addPanel.all')}
          </button>
        ))}
      </div>
    </div>
  );
}
