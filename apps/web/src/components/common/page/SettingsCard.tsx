import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The body of a settings group: a filled block under a plain section heading. The
// group is set apart by the fill and the space around it, not by a border.
//
// For a list of rows pass `divide-y divide-border/60` and let each row carry its own
// padding; for a field form pass the padding here.
export default function SettingsCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('overflow-hidden rounded-lg bg-muted/30', className)}>{children}</div>;
}
