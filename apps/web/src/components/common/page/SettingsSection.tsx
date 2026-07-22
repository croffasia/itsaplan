import type { ReactNode } from 'react';

// A borderless settings section: a quiet header (title over an optional description)
// with a right-aligned control slot, above the section body. Separation comes from
// space and header weight, not a box around the block.
export default function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  // Optional: a section whose whole control is the header action has no body.
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}
