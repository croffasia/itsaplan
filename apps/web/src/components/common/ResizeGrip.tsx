'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// The grip on the edge of a resizable column or panel. It reports how far the
// pointer has moved from where the drag started; which side that grows is the
// caller's business, so a panel on the end edge can widen as the pointer goes the
// other way.
export default function ResizeGrip({
  label,
  className,
  onDrag,
}: {
  label: string;
  className?: string;
  onDrag: (deltaX: number) => void;
}) {
  // The drag listens on the window, since the pointer leaves the 6px grip as soon
  // as it moves. The host can unmount mid-drag (switching layout or project), and
  // the pointerup that would drop the listeners never reaches this component.
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  function beginResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (ev: PointerEvent) => onDrag(ev.clientX - startX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      endDrag.current = null;
    };
    endDrag.current = onUp;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div
      onPointerDown={beginResize}
      aria-label={label}
      className={cn('w-1.5 cursor-col-resize hover:bg-primary/40', className)}
    />
  );
}
