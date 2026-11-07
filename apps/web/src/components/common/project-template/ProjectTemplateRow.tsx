import type { ReactNode } from 'react';

// One part of a template: its name and count beside what it holds.
export default function ProjectTemplateRow({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[136px_minmax(0,1fr)] sm:gap-4">
      <p className="text-sm text-muted-foreground">
        {label}
        {count !== undefined && <span className="ms-1.5 text-xs tabular-nums">{count}</span>}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
