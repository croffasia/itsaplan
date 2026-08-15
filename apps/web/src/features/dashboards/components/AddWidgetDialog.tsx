import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WidgetType } from '@/utils/dashboardWidgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WIDGET_GROUPS, WIDGET_ICON } from '../utils/widgetCatalog';

// Picks a widget type from the catalog and adds it to the current dashboard. Widgets
// are grouped by subject and filtered by a case-insensitive search over the label and
// description, matching the tool picker and GitHub skill import dialogs.
export default function AddWidgetDialog({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  const t = useTranslations('dashboards');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Each group's types narrowed to the ones matching the query; empty groups are
  // dropped so only relevant sections render.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WIDGET_GROUPS.map((g) => ({
      key: g.key,
      types: q
        ? g.types.filter(
            (type) =>
              t(`widgets.${type}.label`).toLowerCase().includes(q) ||
              t(`widgets.${type}.description`).toLowerCase().includes(q),
          )
        : g.types,
    })).filter((g) => g.types.length > 0);
  }, [query, t]);

  function add(type: WidgetType) {
    onAdd(type);
    setOpen(false);
    setQuery('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" /> {t('addWidget')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addWidgetTitle')}</DialogTitle>
          <DialogDescription>{t('addWidgetDescription')}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchWidgets')}
            className="ps-9 pe-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t('clearSearch')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          {groups.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('noWidgetMatches', { query: query.trim() })}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.key} className="space-y-1.5">
              <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t(`widgetGroups.${group.key}`)}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.types.map((type) => {
                  const Icon = WIDGET_ICON[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => add(type)}
                      className="flex items-start gap-3 rounded-lg border border-transparent bg-muted/20 p-3 text-left transition-colors hover:border-border hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {t(`widgets.${type}.label`)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t(`widgets.${type}.description`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
