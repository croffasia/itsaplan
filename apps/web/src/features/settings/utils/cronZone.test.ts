import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { setDisplayTimezone } from '@/utils/dates';
import { cronInDisplayZone, describeCronInDisplayZone } from './cronZone';

const winter = new Date('2026-11-05T12:00:30Z');
const summer = new Date('2026-07-05T12:00:30Z');

function inZone(zone: string, cron: string, at = winter) {
  setDisplayTimezone(zone);
  return cronInDisplayZone(cron, at);
}

afterEach(() => setDisplayTimezone(''));

describe('cronInDisplayZone', () => {
  it('moves a time of day by the offset the zone has then', () => {
    assert.equal(inZone('Europe/Kyiv', '0 7 * * *'), '0 9 * * *');
    assert.equal(inZone('Europe/Kyiv', '0 7 * * *', summer), '0 10 * * *');
    assert.equal(inZone('UTC', '0 7 * * *'), '0 7 * * *');
  });

  it('moves the minutes of a zone off the hour', () => {
    assert.equal(inZone('Asia/Kolkata', '30 9 * * *'), '0 15 * * *');
  });

  it('moves the weekdays when the time crosses midnight', () => {
    assert.equal(inZone('Europe/Kyiv', '0 23 * * 1-5'), '0 1 * * 2,3,4,5,6');
    assert.equal(inZone('America/New_York', '0 1 * * 0'), '0 20 * * 6');
    assert.equal(inZone('Europe/Kyiv', '0 7 * * 1-5'), '0 9 * * 1-5');
  });

  it('keeps hours in order, and a range as a range', () => {
    assert.equal(inZone('Europe/Kyiv', '0 6,23 * * *'), '0 1,8 * * *');
    assert.equal(inZone('Europe/Kyiv', '*/15 7-15 * * 1-5'), '*/15 9-17 * * 1-5');
  });

  it('keeps a day of the month while the time stays on that day', () => {
    assert.equal(inZone('Europe/Kyiv', '0 7 1 * *'), '0 9 1 * *');
  });

  it('leaves a schedule with no hours of its own and no days', () => {
    assert.equal(inZone('Europe/Kyiv', '*/15 * * * *'), '*/15 * * * *');
    assert.equal(inZone('Europe/Kyiv', '0 */2 * * *'), '0 */2 * * *');
    assert.equal(inZone('Asia/Kolkata', '*/15 * * * *'), '*/15 * * * *');
  });

  it('is null when the time leaves the day one cron names', () => {
    assert.equal(inZone('Europe/Kyiv', '0 23 1 * *'), null);
    assert.equal(inZone('Europe/Kyiv', '0 6,23 * * 1'), null);
    assert.equal(inZone('Europe/Kyiv', '0 23 * * */2'), null);
  });

  it('is null for a schedule with no hours of its own that names a day', () => {
    assert.equal(inZone('Europe/Kyiv', '*/15 * * * 1-5'), null);
    assert.equal(inZone('Europe/Kyiv', '0 */6 1 * *'), null);
  });

  it('is null for a minute a zone off the hour moves', () => {
    assert.equal(inZone('Asia/Kolkata', '*/15 9-17 * * *'), null);
    assert.equal(inZone('Asia/Kolkata', '5 * * * *'), null);
    assert.equal(inZone('Asia/Kolkata', '30 */6 * * *'), null);
  });

  it("is null for a schedule in a month, whose offset may not be today's", () => {
    assert.equal(inZone('Europe/Kyiv', '0 7 1 7 *'), null);
    assert.equal(inZone('America/New_York', '0 7 * 7 *'), null);
  });

  it('is null for what does not parse', () => {
    assert.equal(inZone('Europe/Kyiv', 'not a cron'), null);
  });
});

describe('describeCronInDisplayZone', () => {
  it('describes the cron in the display zone', () => {
    setDisplayTimezone('Asia/Dubai');
    assert.equal(describeCronInDisplayZone('0 7 * * *'), 'At 11:00 AM');
    assert.equal(describeCronInDisplayZone('*/15 * * * *'), 'Every 15 minutes');
  });

  it('is null when the cron cannot be moved', () => {
    setDisplayTimezone('Asia/Dubai');
    assert.equal(describeCronInDisplayZone('0 23 1 * *'), null);
  });
});
