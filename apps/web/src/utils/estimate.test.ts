import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMinutes, parseMinutes, parsePoints } from './estimate';

describe('formatMinutes', () => {
  it('writes hours and minutes', () => {
    assert.equal(formatMinutes(90), '1h 30m');
    assert.equal(formatMinutes(120), '2h');
    assert.equal(formatMinutes(30), '30m');
    assert.equal(formatMinutes(0), '0m');
  });
});

describe('parseMinutes', () => {
  it('reads back what formatMinutes wrote', () => {
    for (const minutes of [0, 30, 90, 120, 605]) {
      assert.equal(parseMinutes(formatMinutes(minutes)), minutes);
    }
  });

  it('takes the units in either order and a bare number as minutes', () => {
    assert.equal(parseMinutes('90'), 90);
    assert.equal(parseMinutes('1h30m'), 90);
    assert.equal(parseMinutes('  2H '), 120);
  });

  it('returns null for text it cannot read', () => {
    assert.equal(parseMinutes('soon'), null);
    assert.equal(parseMinutes('1d'), null);
    assert.equal(parseMinutes('-30m'), null);
    assert.equal(parseMinutes(''), null);
  });
});

describe('parsePoints', () => {
  it('takes whole and fractional numbers', () => {
    assert.equal(parsePoints('3'), 3);
    assert.equal(parsePoints('0.5'), 0.5);
    assert.equal(parsePoints('1,5'), 1.5);
  });

  it('returns null for a negative or unreadable value', () => {
    assert.equal(parsePoints('-1'), null);
    assert.equal(parsePoints('big'), null);
    assert.equal(parsePoints(''), null);
  });
});
