import { useMemo } from 'react';
import GridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import { Direction } from 'radix-ui';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  COL_GAP,
  GRID_COLS,
  MIN_W,
  ROW_GAP,
  ROW_UNIT,
  STACK_COLS,
  STACK_WIDTH,
  stackLayout,
  WIDGET_DEFAULTS,
} from '@/utils/dashboardWidgets';
import type { DashboardEditor } from '../hooks/useDashboardEditor';
import WidgetFrame from './WidgetFrame';
import WidgetBody from './WidgetBody';
import WidgetSettings, { hasWidgetSettings } from './WidgetSettings';

// The dashboard body: a react-grid-layout board. Widgets are positioned and sized
// by (x, y, w, h); in edit mode they drag by the header handle and resize from the
// corner, with vertical compaction so short widgets stack to fill gaps. Drag and
// resize write back through editor.applyGrid; the layout persists on save.
//
// Below STACK_WIDTH the saved positions are replaced by a two-column layout
// derived from them (stackLayout), and dragging and resizing are off: what is
// stored is the desktop layout, and a drag on the derived one would overwrite it.
export default function WidgetGrid({
  projectKey,
  project,
  editor,
  editing,
}: {
  projectKey: string;
  project: ProjectDetail;
  editor: DashboardEditor;
  editing: boolean;
}) {
  const direction = Direction.useDirection();
  const t = useTranslations('dashboards');
  // useContainerWidth starts at a sane default width and refines it after mount,
  // so the grid can render immediately — child charts always measure a nonzero
  // width instead of flashing empty on the first paint.
  const { width, containerRef } = useContainerWidth();
  const stacked = width < STACK_WIDTH;
  const movable = editing && !stacked;

  const layout = useMemo(
    () => (stacked ? stackLayout(editor.layout) : editor.layout),
    [stacked, editor.layout],
  );

  const rglLayout: Layout = useMemo(
    () =>
      layout.map((w) => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: stacked ? 1 : MIN_W,
        minH: WIDGET_DEFAULTS[w.type]?.minH ?? 2,
      })),
    [layout, stacked],
  );

  if (layout.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        {t('noWidgets')}
      </p>
    );
  }

  return (
    // react-grid-layout places every widget at an absolute `left` and has no
    // right-to-left mode, so the grid itself keeps its direction. Each widget then
    // takes the page's back, since only the placing has to stay left to right.
    <div ref={containerRef} dir="ltr">
      {width > 0 && (
        <GridLayout
          width={width}
          layout={rglLayout}
          gridConfig={{
            cols: stacked ? STACK_COLS : GRID_COLS,
            rowHeight: ROW_UNIT,
            margin: [COL_GAP, ROW_GAP],
            containerPadding: [0, 0],
          }}
          dragConfig={{ enabled: movable, handle: '.widget-drag-handle', threshold: 4 }}
          resizeConfig={{ enabled: movable, handles: ['se'] }}
          compactor={verticalCompactor}
          onDragStop={(l) => editor.applyGrid(l)}
          onResizeStop={(l) => editor.applyGrid(l)}
          className={cn(movable && 'rounded-lg outline-1 outline-border/50 outline-dashed')}
        >
          {layout.map((widget) => (
            <div key={widget.id} dir={direction} className="min-w-0 overflow-hidden">
              <WidgetFrame
                widget={widget}
                editing={editing}
                movable={movable}
                settings={
                  editing && hasWidgetSettings(widget.type) ? (
                    <WidgetSettings
                      widget={widget}
                      onConfigChange={(config) => editor.updateWidget(widget.id, { config })}
                    />
                  ) : undefined
                }
                onRename={(title) => editor.updateWidget(widget.id, { title })}
                onRemove={() => editor.removeWidget(widget.id)}
              >
                <WidgetBody widget={widget} projectKey={projectKey} project={project} />
              </WidgetFrame>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
