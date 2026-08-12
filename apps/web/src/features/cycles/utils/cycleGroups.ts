import type { Cycle, CycleStatus } from '@/lib/api';
import { CYCLE_STATUS_META, CYCLE_STATUS_ORDER } from '@/utils/cycleMeta';

export interface CycleGroup {
  status: CycleStatus;
  color: string;
  cycles: Cycle[];
}

// The planned cycles as the groups both list views render, in reading order: what
// is running, then what is next, each keeping the API's order (by start date). A
// status with no cycles is left out. Finished cycles never reach here — the table
// pages them in as an archive of its own (see CycleTableArchive).
export function groupCycles(cycles: Cycle[]): CycleGroup[] {
  return CYCLE_STATUS_ORDER.flatMap((status) => {
    const group = cycles.filter((c) => c.status === status);
    if (group.length === 0) return [];
    return [{ status, ...CYCLE_STATUS_META[status], cycles: group }];
  });
}
