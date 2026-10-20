import type { ReactNode } from 'react';

export default function RunnerQueueRunSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}
