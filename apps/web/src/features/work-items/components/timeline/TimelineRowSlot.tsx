import { memo, type ReactNode } from 'react';
import type { TimelineRow } from '../../utils/timeline';

// Memoized so a scroll step, which renders TimelineRows again, skips the rows that
// stay in view: their row and renderRow are the same as before.
export const TimelineRowSlot = memo(function TimelineRowSlot({
  row,
  renderRow,
}: {
  row: TimelineRow;
  renderRow: (row: TimelineRow) => ReactNode;
}) {
  return renderRow(row);
});
