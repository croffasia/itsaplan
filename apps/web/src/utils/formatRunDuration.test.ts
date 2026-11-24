import assert from 'node:assert/strict';
import { it } from 'node:test';
import { formatRunDuration } from './formatRunDuration';

it('formats a run duration in its two largest units, with tenths under ten seconds', () => {
  assert.equal(formatRunDuration(380), '0.4s');
  assert.equal(formatRunDuration(9_400), '9.4s');
  assert.equal(formatRunDuration(9_960), '10s');
  assert.equal(formatRunDuration(48_200), '48s');
  assert.equal(formatRunDuration(66_743), '1m 07s');
  assert.equal(formatRunDuration(7_500_000), '2h 05m');
  assert.equal(formatRunDuration(-5), '0.0s');
});
