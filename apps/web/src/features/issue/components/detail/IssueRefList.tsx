import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The grid IssueRefRows share, so the identifiers, titles and statuses of all rows
// line up: each column takes the width of its widest cell, whatever the project
// names its columns.
export default function IssueRefList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] gap-x-2', className)}>
      {children}
    </div>
  );
}
