import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

// The grip on the right edge of a timeline's label column: dragging it sets how
// much room the labels get. It spans the whole column, header to last row, and
// sticks to the left edge so it stays reachable however far the timeline is
// scrolled.
export function TimelineLabelResizer({
  labelW,
  onResize,
}: {
  labelW: number;
  onResize: (width: number) => void;
}) {
  const t = useTranslations('common');
  // The drag listens on the window, since the pointer leaves the 6px grip as soon
  // as it moves. Switching layout or project unmounts the timeline mid-drag, and
  // the pointerup that would drop the listeners never reaches this component.
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  function beginResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (ev: PointerEvent) => onResize(labelW + (ev.clientX - startX));
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
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="sticky left-0 h-full" style={{ width: labelW }}>
        <div
          onPointerDown={beginResize}
          aria-label={t('resizeTitleColumn')}
          className="pointer-events-auto absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-primary/40"
        />
      </div>
    </div>
  );
}
