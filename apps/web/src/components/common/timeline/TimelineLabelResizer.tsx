import { useTranslations } from 'next-intl';
import ResizeGrip from '@/components/common/ResizeGrip';

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
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="sticky left-0 h-full" style={{ width: labelW }}>
        <ResizeGrip
          label={t('resizeTitleColumn')}
          className="pointer-events-auto absolute inset-y-0 right-0"
          onDrag={(deltaX) => onResize(labelW + deltaX)}
        />
      </div>
    </div>
  );
}
