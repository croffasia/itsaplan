import { useMemo } from 'react';
import GridLayout, { useContainerWidth, verticalCompactor, type Layout } from 'react-grid-layout';
import type { ProjectDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  COL_GAP,
  GRID_COLS,
  MIN_W,
  ROW_GAP,
  ROW_UNIT,
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
  const { layout } = editor;
  // useContainerWidth starts at a sane default width and refines it after mount,
  // so the grid can render immediately — child charts always measure a nonzero
  // width instead of flashing empty on the first paint.
  const { width, containerRef } = useContainerWidth();

  const rglLayout: Layout = useMemo(
    () =>
      layout.map((w) => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: MIN_W,
        minH: WIDGET_DEFAULTS[w.type]?.minH ?? 2,
      })),
    [layout],
  );

  if (layout.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No widgets yet. Add one to build this dashboard.
      </p>
    );
  }

  return (
    <div ref={containerRef}>
      {width > 0 && (
        <GridLayout
          width={width}
          layout={rglLayout}
          gridConfig={{
            cols: GRID_COLS,
            rowHeight: ROW_UNIT,
            margin: [COL_GAP, ROW_GAP],
            containerPadding: [0, 0],
          }}
          dragConfig={{ enabled: editing, handle: '.widget-drag-handle', threshold: 4 }}
          resizeConfig={{ enabled: editing, handles: ['se'] }}
          compactor={verticalCompactor}
          onDragStop={(l) => editor.applyGrid(l)}
          onResizeStop={(l) => editor.applyGrid(l)}
          className={cn(editing && 'rounded-lg outline-1 outline-border/50 outline-dashed')}
        >
          {layout.map((widget) => (
            <div key={widget.id} className="min-w-0 overflow-hidden">
              <WidgetFrame
                widget={widget}
                editing={editing}
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
