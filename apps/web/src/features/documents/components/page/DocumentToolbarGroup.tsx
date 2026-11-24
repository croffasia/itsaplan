import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function DocumentToolbarGroup({
  end = false,
  children,
}: {
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-0.5 px-2 not-first:border-s first:ps-0',
        end && 'ms-auto pe-0 not-first:border-s-0',
      )}
    >
      {children}
    </div>
  );
}
