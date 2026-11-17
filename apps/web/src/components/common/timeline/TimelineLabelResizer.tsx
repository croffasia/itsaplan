import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import ResizeGrip from '@/components/common/ResizeGrip';
import { inlineSign } from '@/utils/inlineSign';

// The grip on the end edge of a timeline's label column: dragging it sets how
// much room the labels get. It spans the whole column, header to last row, and
// sticks to the start edge so it stays reachable however far the timeline is
// scrolled.
export function TimelineLabelResizer({
  labelW,
  onResize,
}: {
  labelW: number;
  onResize: (width: number) => void;
}) {
  const t = useTranslations('common');
  const columnRef = useRef<HTMLDivElement>(null);
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div ref={columnRef} className="sticky start-0 h-full" style={{ width: labelW }}>
        <ResizeGrip
          label={t('resizeTitleColumn')}
          className="pointer-events-auto absolute inset-y-0 end-0"
          onDrag={(deltaX) =>
            onResize(labelW + (columnRef.current ? inlineSign(columnRef.current) : 1) * deltaX)
          }
        />
      </div>
    </div>
  );
}
