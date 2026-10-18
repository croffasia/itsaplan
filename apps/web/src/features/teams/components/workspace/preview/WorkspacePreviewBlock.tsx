'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// `bars` are the heights of the bars, in percent.
export default function WorkspacePreviewBlock({
  title,
  className,
  figures = true,
  bars,
  rows = 0,
}: {
  title: string;
  className?: string;
  figures?: boolean;
  bars?: number[];
  rows?: number;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <h3 className="mb-4 truncate border-b border-border/60 pb-2 text-sm font-semibold tracking-tight">
        {title}
      </h3>
      <div className="flex flex-col gap-6">
        {figures && (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {['w-24', 'w-16'].map((width) => (
              <div key={width} className="space-y-2">
                <Skeleton className={cn('h-9', width)} />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        )}
        {bars && (
          <div dir="ltr" className="flex h-22 items-end gap-[3px] border-b border-border/60">
            {bars.map((height, index) => (
              <Skeleton
                key={index}
                className="flex-1 rounded-sm"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        )}
        {rows > 0 && (
          <ul>
            {Array.from({ length: rows }, (_, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5" style={{ width: `${55 - index * 6}%` }} />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
                <Skeleton className="h-3.5 w-12" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
