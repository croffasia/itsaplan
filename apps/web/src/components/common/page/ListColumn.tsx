'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Direction } from 'radix-ui';
import { cn } from '@/lib/utils';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import ResizeGrip from '@/components/common/ResizeGrip';

const MAX_W = 640;

// A list beside what it opens, dragged wider than its narrowest width, which it starts at.
// On a phone, and with `fill`, it takes the whole width.
export default function ListColumn({
  storageKey,
  minWidth,
  resizeLabel,
  fill = false,
  className,
  children,
}: {
  storageKey: string;
  minWidth: number;
  resizeLabel: string;
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const direction = Direction.useDirection();
  const { width, setWidth } = usePersistedWidth(storageKey, minWidth, minWidth, MAX_W);

  return (
    <div
      className={cn(
        'relative flex w-full min-w-0 flex-col',
        !fill && 'md:w-(--list-w) md:shrink-0',
        className,
      )}
      style={{ '--list-w': `${width}px` } as CSSProperties}
    >
      {!fill && (
        <ResizeGrip
          label={resizeLabel}
          className="absolute inset-y-0 end-0 z-10 -me-[3px] hidden md:block"
          onDrag={(deltaX) => setWidth(width + (direction === 'rtl' ? -deltaX : deltaX))}
          onReset={() => setWidth(minWidth)}
        />
      )}
      {children}
    </div>
  );
}
