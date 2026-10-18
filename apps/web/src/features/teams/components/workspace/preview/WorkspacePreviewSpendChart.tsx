'use client';

import { Skeleton } from '@/components/ui/skeleton';

// The spend over the period so far, rising towards the limit drawn across the chart.
const SPENT = '0,98 20,94 40,90 60,83 80,79 100,71 120,66 140,58 160,55 180,47';
const FORECAST = '180,47 220,34 260,22 300,10';

export default function WorkspacePreviewSpendChart() {
  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <svg
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        className="h-[240px] w-full overflow-visible"
      >
        {[25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1={0}
            x2={300}
            y1={y}
            y2={y}
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={0}
          x2={300}
          y1={18}
          y2={18}
          className="stroke-destructive/40"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={SPENT}
          fill="none"
          strokeWidth={2}
          className="stroke-muted-foreground/40"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={FORECAST}
          fill="none"
          strokeWidth={2}
          strokeDasharray="4 4"
          className="stroke-muted-foreground/30"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
