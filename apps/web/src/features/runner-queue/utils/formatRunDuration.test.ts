import assert from 'node:assert/strict';
import { it } from 'node:test';
import { formatRunDuration } from './formatRunDuration';

it('formats a run duration in its two largest units', () => {
  assert.equal(formatRunDuration(48_200), '48s');
  assert.equal(formatRunDuration(66_743), '1m 07s');
  assert.equal(formatRunDuration(7_500_000), '2h 05m');
  assert.equal(formatRunDuration(-5), '0s');
});
