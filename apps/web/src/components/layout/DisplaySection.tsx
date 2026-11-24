import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function DisplaySection({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative pb-2 before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-border/60 first:before:hidden',
        title ? 'pt-3' : 'pt-2',
      )}
    >
      {title && (
        <div className="flex items-baseline justify-between gap-2 px-2 pb-1">
          <h3 className="text-xs leading-4 font-medium text-muted-foreground">{title}</h3>
          {hint && <span className="text-xs leading-4 text-muted-foreground/60">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
