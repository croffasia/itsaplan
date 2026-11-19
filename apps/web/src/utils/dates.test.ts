import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addPersianMonths, toDateStr } from './dates';

describe('addPersianMonths', () => {
  it('steps to day 1 of the next or previous solar Hijri month', () => {
    const aban21 = new Date(2026, 10, 12);
    assert.equal(toDateStr(addPersianMonths(aban21, 1)), '2026-11-22');
    assert.equal(toDateStr(addPersianMonths(aban21, -1)), '2026-09-23');
    assert.equal(toDateStr(addPersianMonths(aban21, 0)), '2026-10-23');
    // 29 Esfand 1405 is the last day of the year.
    assert.equal(toDateStr(addPersianMonths(new Date(2027, 2, 20), 1)), '2027-03-21');
  });
});
