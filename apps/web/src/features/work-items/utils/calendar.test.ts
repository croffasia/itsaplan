import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toDateStr } from '@/utils/dates';
import type { CalendarMode } from '@/utils/viewSettings';
import {
  dayInWeek,
  dropId,
  parseDropId,
  UNSCHEDULED_ID,
  visibleDays,
  weekNumber,
} from './calendar';

// A Thursday.
const cursor = new Date(2026, 10, 12);

const span = (calendarMode: CalendarMode, calendarDays = 7, calendarWeeks = 4) => {
  const days = visibleDays(cursor, { calendarMode, calendarDays, calendarWeeks, weekStart: 1 });
  return [days.length, toDateStr(days[0]), toDateStr(days[days.length - 1])];
};

describe('visibleDays', () => {
  it('lays out six weeks from the week that holds the first of the month', () => {
    assert.deepEqual(span('month'), [42, '2026-10-26', '2026-12-06']);
  });

  it('lays out a full week from its first day, and fewer days from the cursor', () => {
    assert.deepEqual(span('byDay'), [7, '2026-11-09', '2026-11-15']);
    assert.deepEqual(span('byDay', 3), [3, '2026-11-12', '2026-11-14']);
  });

  it('lays out the weeks from the week that holds the cursor', () => {
    assert.deepEqual(span('byWeek'), [28, '2026-11-09', '2026-12-06']);
    assert.deepEqual(span('byWeek', 7, 2), [14, '2026-11-09', '2026-11-22']);
  });
});

describe('dayInWeek', () => {
  it('keeps the weekday, and puts an issue without a date on the first day', () => {
    assert.equal(dayInWeek('2026-11-12', '2026-11-23', 1), '2026-11-26');
    assert.equal(dayInWeek('2026-11-15', '2026-11-23', 1), '2026-11-29');
    assert.equal(dayInWeek('2026-11-14', '2026-11-22', 0), '2026-11-28');
    assert.equal(dayInWeek(null, '2026-11-23', 1), '2026-11-23');
  });
});

describe('parseDropId', () => {
  it('reads back what dropId builds and rejects other ids', () => {
    assert.deepEqual(parseDropId(dropId('day', '2026-11-12')), { kind: 'day', date: '2026-11-12' });
    assert.deepEqual(parseDropId(dropId('week', '2026-11-09')), {
      kind: 'week',
      date: '2026-11-09',
    });
    assert.equal(parseDropId(UNSCHEDULED_ID), null);
    assert.equal(parseDropId(42), null);
  });
});

describe('weekNumber', () => {
  it('numbers Monday weeks the ISO way and Sunday weeks the US way', () => {
    assert.equal(weekNumber(new Date(2026, 10, 9), 1), 46);
    assert.equal(weekNumber(new Date(2026, 0, 1), 1), 1);
    assert.equal(weekNumber(new Date(2026, 10, 8), 0), 46);
    assert.equal(weekNumber(new Date(2025, 11, 28), 0), 1);
  });
});
