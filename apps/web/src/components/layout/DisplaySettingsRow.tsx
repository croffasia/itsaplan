import type { ReactNode } from 'react';

export default function DisplaySettingsRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 px-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
