import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The grid IssueRefRows share, so the status icons, identifiers and titles of all
// rows line up: each column takes the width of its widest cell.
export default function IssueRefList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('-mx-2 grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2.5', className)}>
      {children}
    </div>
  );
}
