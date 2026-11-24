import { Check, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WidgetType } from '@/utils/dashboardWidgets';
import WidgetPreview from './WidgetPreview';

// One widget of the add panel, dragged onto the dashboard to add it. Once added it
// says how many times, so a second drag reads as a second copy.
export default function AddWidgetPanelRow({
  type,
  addedCount,
  onDragStart,
  onDragEnd,
}: {
  type: WidgetType;
  addedCount: number;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations('dashboards');
  return (
    <div
      draggable
      onDragStart={(e) => {
        // Firefox starts a drag only when it carries data.
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.effectAllowed = 'copy';
        // The panel hides while a widget is dragged. Hiding it in this handler would
        // hide the row before the browser takes its picture for the drag image.
        window.setTimeout(onDragStart);
      }}
      onDragEnd={onDragEnd}
      className="group flex cursor-grab items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60 active:cursor-grabbing"
    >
      <WidgetPreview type={type} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t(`widgets.${type}.label`)}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {t(`widgets.${type}.description`)}
        </span>
      </span>
      {addedCount > 0 ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          <Check className="size-3.5" />
          {t('addPanel.added', { count: addedCount })}
        </span>
      ) : (
        <GripVertical
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </div>
  );
}
