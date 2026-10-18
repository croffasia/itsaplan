import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-border/60 bg-linear-to-b from-primary/[0.04] to-card p-5 shadow-xs',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-border/60 pb-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-primary ring-3 ring-primary/15"
            />
            <span className="truncate">{title}</span>
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {value !== undefined && (
          <div className="shrink-0 text-end">
            <p className="text-lg leading-tight font-semibold tracking-tight tabular-nums">
              {value}
            </p>
            {valueLabel && <p className="text-xs text-muted-foreground">{valueLabel}</p>}
          </div>
        )}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
