import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WidgetType } from '@/utils/dashboardWidgets';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WIDGET_GROUPS, type WidgetGroupKey } from '../utils/widgetCatalog';
import AddWidgetPanelFilters from './AddWidgetPanelFilters';
import AddWidgetPanelFooter from './AddWidgetPanelFooter';
import AddWidgetPanelRow from './AddWidgetPanelRow';

// The widget catalog in a panel over the end side of the dashboard. A widget is
// dragged out of it onto the grid; while one is dragged (`dragging`) the panel fades
// out and lets the drag through, so the whole grid takes the drop. It lies over the
// grid rather than beside it: beside it, the grid would get narrow enough to switch
// to its two-column layout, which takes no drops.
// `addedTypes` lists the types added since the panel opened and still on the
// dashboard, oldest first; Undo removes the last one. Below md the panel covers the
// screen.
export default function AddWidgetPanel({
  addedTypes,
  dragging,
  onDragStart,
  onDragEnd,
  onUndo,
  onClose,
}: {
  addedTypes: WidgetType[];
  dragging: boolean;
  onDragStart: (type: WidgetType) => void;
  onDragEnd: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('dashboards');
  const tCommon = useTranslations('common');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<WidgetGroupKey | null>(null);
  useExitOnEscape(onClose);

  const q = query.trim().toLowerCase();
  const groups = WIDGET_GROUPS.filter((g) => group == null || g.key === group)
    .map((g) => ({
      key: g.key,
      types: g.types.filter(
        (type) =>
          !q ||
          t(`widgets.${type}.label`).toLowerCase().includes(q) ||
          t(`widgets.${type}.description`).toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.types.length > 0);

  return (
    <aside
      aria-labelledby="add-widgets-title"
      className={cn(
        'fixed start-0 end-0 top-0 bottom-0 z-40 flex flex-col bg-card transition-opacity motion-reduce:transition-none md:absolute md:start-auto md:z-30 md:w-96 md:border-s md:shadow-xl',
        dragging && 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="add-widgets-title" className="text-base font-semibold">
            {t('addPanel.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('addPanel.description')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label={tCommon('close')}
          title={tCommon('close')}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <AddWidgetPanelFilters
        query={query}
        onQueryChange={setQuery}
        group={group}
        onGroupChange={setGroup}
      />

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto border-t px-3 pt-1 pb-3">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            {t(group ? 'noWidgetMatchesInGroup' : 'noWidgetMatches', { query: query.trim() })}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="flex h-8 items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t(`widgetGroups.${g.key}`)}
              <span className="font-normal tabular-nums">{g.types.length}</span>
            </h3>
            <div className="space-y-0.5">
              {g.types.map((type) => (
                <AddWidgetPanelRow
                  key={type}
                  type={type}
                  addedCount={addedTypes.filter((a) => a === type).length}
                  onDragStart={() => onDragStart(type)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <AddWidgetPanelFooter count={addedTypes.length} onUndo={onUndo} onClose={onClose} />
    </aside>
  );
}
