import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { PulseUnit } from '@/lib/api';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { usePulseQuery } from '../../services/analytics.service';

// Green ramp for the four non-empty activity levels (GitHub-style). Empty cells
// use the theme `muted` surface instead of a bright gray, so they read as a quiet
// part of the theme (a touch lighter than the background) in light and dark.
const FILL_COLORS = ['#9be9a8', '#40c463', '#30a14e', '#216e39'];

// Per-unit heatmap geometry. `rows` cells stack per column (a day column is 24
// hours, a week column is 7 days, a week is one cell); cell/gap size the grid,
// maxColumns matches the server cap.
const GRID: Record<
  PulseUnit,
  { cell: number; gap: number; rows: number; maxColumns: number; unitLabel: string }
> = {
  hour: { cell: 11, gap: 2, rows: 24, maxColumns: 140, unitLabel: 'By hour' },
  day: { cell: 15, gap: 3, rows: 7, maxColumns: 160, unitLabel: 'By day' },
  week: { cell: 15, gap: 3, rows: 4, maxColumns: 130, unitLabel: 'By week' },
};

// Fetch a few columns beyond what is drawn so a small resize can grow the graph
// from cache before the refetch lands. Only the columns that fully fit are drawn
// (no horizontal scroll); the extra are held in reserve.
const COLUMN_BUFFER = 4;

// Bucket a cell's count into 0..4 relative to the busiest cell in the window.
function level(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((count / max) * 4));
}

// An activity heatmap whose window auto-fits the widget width: the number of
// columns is derived from the available space, not a chosen date range. It draws
// exactly the columns that fully fit — no scrollbar. The bucket unit
// (hour/day/week) is a configured setting; hovering a cell shows its date and
// count. The server returns a zero-filled, preformatted series (see analytics
// store), so this component only measures width and lays cells out.
export default function PulseWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const unit = config.granularity ?? 'day';
  const geo = GRID[unit];
  const step = geo.cell + geo.gap;

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Columns that fully fit the measured width (drawn), and a slightly larger fetch
  // count (reserve). Before the first measurement, fetch a sensible default.
  const fitColumns = width > 0 ? Math.max(1, Math.floor((width + geo.gap) / step)) : 0;
  const fetchColumns = fitColumns > 0 ? Math.min(fitColumns + COLUMN_BUFFER, geo.maxColumns) : 26;

  const { data, isLoading } = usePulseQuery(projectKey, unit, fetchColumns);

  const [tip, setTip] = useState<{ label: string; count: number; x: number; y: number } | null>(
    null,
  );

  // Draw the most recent `fitColumns` whole columns (the series ends at now); the
  // older reserve columns are fetched but not shown.
  const { cols, max, total, active } = useMemo(() => {
    const buckets = data ?? [];
    const drawColumns = Math.min(fitColumns || 0, Math.floor(buckets.length / geo.rows));
    const visible = drawColumns > 0 ? buckets.slice(buckets.length - drawColumns * geo.rows) : [];
    const chunks: { label: string; count: number }[][] = [];
    for (let i = 0; i < visible.length; i += geo.rows) chunks.push(visible.slice(i, i + geo.rows));
    let maxCount = 0;
    let activeCount = 0;
    let totalCount = 0;
    for (const b of visible) {
      maxCount = Math.max(maxCount, b.count);
      totalCount += b.count;
      if (b.count > 0) activeCount++;
    }
    return { cols: chunks, max: maxCount, total: totalCount, active: activeCount };
  }, [data, fitColumns, geo.rows]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{geo.unitLabel}</p>

      {/* Full-width measuring wrapper; the grid draws only what fits (no scroll). */}
      <div ref={containerRef} className="w-full overflow-hidden">
        {isLoading || cols.length === 0 ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div style={{ display: 'flex', gap: geo.gap }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: geo.gap }}>
                {col.map((cell, ri) => {
                  const lvl = level(cell.count, max);
                  return (
                    <span
                      key={ri}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setTip({
                          label: cell.label,
                          count: cell.count,
                          x: r.left + r.width / 2,
                          y: r.top,
                        });
                      }}
                      onMouseLeave={() => setTip(null)}
                      className={cn('shrink-0 rounded-[3px]', lvl === 0 && 'bg-muted')}
                      style={{
                        width: geo.cell,
                        height: geo.cell,
                        backgroundColor: lvl === 0 ? undefined : FILL_COLORS[lvl - 1],
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {total} {total === 1 ? 'event' : 'events'} · {active} active
        </span>
        <span className="flex items-center gap-1">
          Less
          <span className="size-3 rounded-[2px] bg-muted" />
          {FILL_COLORS.map((c) => (
            <span key={c} className="size-3 rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
          More
        </span>
      </div>

      {/* Portaled to the body so it can never shift the widget's layout. */}
      {tip &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{ left: tip.x, top: tip.y - 6 }}
          >
            <span className="font-medium">{tip.count}</span>{' '}
            <span className="text-muted-foreground">
              event{tip.count === 1 ? '' : 's'} · {tip.label}
            </span>
          </div>,
          document.body,
        )}
    </div>
  );
}
