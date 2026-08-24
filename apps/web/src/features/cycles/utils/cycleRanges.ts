import type { Cycle } from '@/lib/api';
import { addDays, parseDate } from '@/utils/dates';

// The date-picker limits that mirror the API's rule: cycles of one project may not
// overlap. Everything they leave selectable is accepted by the server, so a picked
// range never comes back as a 400 (which still guards the API itself — MCP, direct
// calls, and a cycle created elsewhere while this dialog was open).

// The cycles a new or edited one has to fit around: all of the project's except the
// one being edited.
function others(cycles: Cycle[], editedId: number | undefined): Cycle[] {
  return editedId === undefined ? cycles : cycles.filter((c) => c.id !== editedId);
}

// The last day a cycle keeps another one out of, mirroring the API: one finished
// early gave up the rest of its planned range, and shares the day it was finished
// with whatever starts next. completedAt is a timestamp, and the API reads its day
// in UTC, the zone the cycle dates themselves are compared in.
export function occupiedUntil(cycle: Cycle): Date | null {
  const finished = parseDate(cycle.completedAt?.slice(0, 10) ?? null);
  return finished ? addDays(finished, -1) : parseDate(cycle.endDate);
}

// The days already taken by another cycle. A start date may not land on one.
export function busyRanges(cycles: Cycle[], editedId?: number): { from: Date; to: Date }[] {
  return others(cycles, editedId).flatMap((c) => {
    const from = parseDate(c.startDate);
    const to = occupiedUntil(c);
    return from && to && to >= from ? [{ from, to }] : [];
  });
}

// The last day a cycle starting on `startDate` may end on: the day before the next
// cycle begins. Null when nothing follows, which leaves the end date open. Keeps a
// range from spanning a whole cycle — both of its ends free, everything between them
// taken.
export function endLimit(cycles: Cycle[], startDate: string, editedId?: number): Date | null {
  const starts = others(cycles, editedId)
    .filter((c) => c.startDate > startDate)
    .map((c) => c.startDate)
    .sort();
  const next = parseDate(starts[0] ?? null);
  return next ? addDays(next, -1) : null;
}
