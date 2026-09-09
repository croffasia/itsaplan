import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The frame every panel of the dashboard shares: what it shows on the left, the one
// figure that sums it up on the right, and the panel's own content below. A panel is
// raised off the page by its surface and a soft shadow rather than a border: in the
// light theme the two backgrounds sit a percent apart, so the shadow carries it.
export default function Panel({
  title,
  description,
  value,
  valueLabel,
  className,
  children,
}: {
  title: string;
  description: string;
  value?: string;
  valueLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl bg-card p-5 shadow-sm', className)}>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {value !== undefined && (
          <div className="shrink-0 text-end">
            <p className="text-sm font-semibold tabular-nums">{value}</p>
            {valueLabel && <p className="text-xs text-muted-foreground">{valueLabel}</p>}
          </div>
        )}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
