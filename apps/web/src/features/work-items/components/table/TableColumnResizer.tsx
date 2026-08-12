import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

// The grip on the right edge of a table column's header cell: dragging it sets
// that column's width. The starting width is measured from the cell itself, so a
// column that still sits on its default track resizes from where it is.
export function TableColumnResizer({
  onResize,
  onResizeEnd,
}: {
  onResize: (width: number) => void;
  onResizeEnd: () => void;
}) {
  const t = useTranslations('workItems');
  // The drag listens on the window, since the pointer leaves the 6px grip as soon
  // as it moves. Switching layout or project unmounts the header mid-drag, and the
  // pointerup that would drop the listeners never reaches this component.
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  function beginResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const cell = e.currentTarget.parentElement;
    if (!cell) return;
    const startX = e.clientX;
    const startWidth = cell.getBoundingClientRect().width;
    const onMove = (ev: PointerEvent) => onResize(startWidth + (ev.clientX - startX));
    // pointercancel ends the drag as well: a touch the browser takes over for
    // scrolling never sends pointerup, and the move listener would keep resizing
    // on every later gesture.
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      endDrag.current = null;
      onResizeEnd();
    };
    endDrag.current = onEnd;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  return (
    <div
      onPointerDown={beginResize}
      aria-label={t('resizeColumn')}
      // Placed in the gap after the cell, so it does not cover the label, and
      // stretched over the header's padding to stay easy to grab. touch-none keeps
      // a touch drag on the grip from scrolling the table instead.
      className="absolute -inset-y-2 -right-2 w-1.5 cursor-col-resize touch-none hover:bg-primary/40"
    />
  );
}
