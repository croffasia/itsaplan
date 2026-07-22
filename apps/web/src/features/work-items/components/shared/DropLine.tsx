import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// The insertion marker shown while dragging a card: a line in the gap where the
// card would land, rather than a highlight on the card it is hovering. Positioned
// by its parent, which must be `relative`.
export function DropLine({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute right-0 left-0 h-0.5 rounded-full bg-primary',
        className,
      )}
      style={style}
    />
  );
}
