import type { Cycle } from '@/lib/api';
import { addDays, daysBetween, toDateStr } from '@/utils/dates';
import { occupiedUntil } from './cycleRanges';

// The lengths offered as one click each, in days. Two weeks is what a new cycle
// opens with.
export const CYCLE_LENGTHS = [7, 14, 21, 28];

const DEFAULT_LENGTH = 14;

// What a new cycle opens with, so it can be created without filling anything in: it
// picks up where the last one ended and continues its numbering.
export interface CycleDefaults {
  name: string;
  startDate: string;
  endDate: string;
}

// Cycles are numbered rather than named, so the next one follows the last one:
// "Sprint 12" gives "Sprint 13", and any prefix works the same way ("Q3 W4" →
// "Q3 W5"). A last cycle whose name ends in no number, or no cycles at all, falls
// back to `fallbackName`, which numbers them from the count.
function nextName(cycles: Cycle[], fallbackName: (n: number) => string): string {
  const last = cycles[cycles.length - 1];
  const numbered = last?.name.match(/^(.*?)(\d+)\s*$/);
  if (numbered) return `${numbered[1]}${Number(numbered[2]) + 1}`;
  return fallbackName(cycles.length + 1);
}

// The next Monday after `from`, never `from` itself — cycles are planned ahead, so
// a new one starts on a week boundary that has not passed yet.
function nextMonday(from: Date): Date {
  const untilMonday = (8 - from.getDay()) % 7;
  return addDays(from, untilMonday === 0 ? 7 : untilMonday);
}

// `cycles` comes oldest first, so the last one is the one to continue from. A cycle
// still running or still ahead is followed the day after it ends — back to back, and
// never overlapping, which the API rejects. With nothing ahead (the last cycle is
// over, or there is none) the new cycle starts on the coming Monday rather than
// mid-week.
export function cycleDefaults(cycles: Cycle[], fallbackName: (n: number) => string): CycleDefaults {
  const today = new Date();
  const last = cycles[cycles.length - 1];
  const previousEnd = last ? occupiedUntil(last) : null;
  const start =
    previousEnd && daysBetween(today, previousEnd) >= 0
      ? addDays(previousEnd, 1)
      : nextMonday(today);
  return {
    name: nextName(cycles, fallbackName),
    startDate: toDateStr(start),
    endDate: toDateStr(addDays(start, DEFAULT_LENGTH - 1)),
  };
}
