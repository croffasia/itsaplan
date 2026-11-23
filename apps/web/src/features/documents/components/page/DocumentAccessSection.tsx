import type { ReactNode } from 'react';

export default function DocumentAccessSection({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="px-3.5 pt-3.5 pb-3">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
        {badge && (
          <span className="ms-auto rounded-full bg-secondary px-2 py-px text-[11px] tracking-normal text-foreground normal-case">
            {badge}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}
