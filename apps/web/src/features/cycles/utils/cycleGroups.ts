import type { Cycle, CycleStatus } from '@/lib/api';
import { CYCLE_STATUS_META, CYCLE_STATUS_ORDER } from '@/utils/cycleMeta';

export interface CycleGroup {
  status: CycleStatus;
  label: string;
  color: string;
  cycles: Cycle[];
}

// The groups both list views render, in reading order: what is running, what is
// next, what is behind. A status with no cycles is left out. Finished cycles read
// newest first; the others keep the API's order (by start date).
export function groupCycles(cycles: Cycle[]): CycleGroup[] {
  return CYCLE_STATUS_ORDER.flatMap((status) => {
    const group = cycles.filter((c) => c.status === status);
    if (group.length === 0) return [];
    return [
      {
        status,
        ...CYCLE_STATUS_META[status],
        cycles: status === 'completed' ? [...group].reverse() : group,
      },
    ];
  });
}
