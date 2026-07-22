import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseScheduleInput } from './cronSchedule';

describe('natural language schedules', () => {
  const cases: Array<[string, string]> = [
    ['hourly', '0 * * * *'],
    ['every 15 minutes', '*/15 * * * *'],
    ['every 2 hours', '0 */2 * * *'],
    ['daily at 9:30am', '30 9 * * *'],
    ['every day at 9:00 AM', '0 9 * * *'],
    ['every weekday at 9am', '0 9 * * 1-5'],
    ['every weekend at noon', '0 12 * * 0,6'],
    ['every Monday and Friday at 5pm', '0 17 * * 1,5'],
    ['at 9am and 5pm every day', '0 9,17 * * *'],
    ['monthly on the 1st at midnight', '0 0 1 * *'],
    ['on the 1st and 15th at 9am', '0 9 1,15 * *'],
    ['quarterly at midnight', '0 0 1 1,4,7,10 *'],
    ['every 15 minutes between 9am and 5pm', '*/15 9-17 * * *'],
    ['every hour between 9am and 5pm', '0 9-17 * * *'],
    ['every 2 hours at 30 minutes past the hour', '30 */2 * * *'],
    ['at 30 minutes past the hour', '30 * * * *'],
    ['on the 1st through 5th at 9am', '0 9 1-5 * *'],
    ['yearly in March on the 10th at noon', '0 12 10 3 *'],
  ];

  for (const [input, cron] of cases) {
    test(`converts ${input} to cron`, () => {
      const result = parseScheduleInput(input);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.source, 'text');
      assert.equal(result.cron, cron);
    });
  }
});

describe('round trips', () => {
  const cases = [
    '*/15 * * * *',
    '0 */2 * * *',
    '30 */2 * * *',
    '0 9-17 * * *',
    '15 9-17 * * *',
    '0 9-17/2 * * *',
    '*/15 9-17 * * 1-5',
    '0 9,17 * * 1,5',
    '0 9 1-5 1-3 *',
  ];

  for (const cron of cases) {
    test(`preserves ${cron} through its English description`, () => {
      const described = parseScheduleInput(cron);
      assert.equal(described.ok, true);
      if (!described.ok) return;
      const reparsed = parseScheduleInput(described.description);
      assert.equal(reparsed.ok, true);
      if (!reparsed.ok) return;
      assert.equal(reparsed.cron, cron);
    });
  }
});

describe('cron schedules', () => {
  const cases: Array<[string, string]> = [
    ['*/5 * * * *', 'Every 5 minutes'],
    ['0 * * * *', 'Every hour'],
    ['0 9 * * 1-5', 'At 9:00 AM on weekdays'],
    ['0 9,17 * * 1,5', 'At 9:00 AM and 5:00 PM on Monday and Friday'],
    ['0 0 1 1,4,7,10 *', 'At midnight on 1st in January, April, July and October'],
  ];

  for (const [cron, description] of cases) {
    test(`describes ${cron}`, () => {
      assert.deepEqual(parseScheduleInput(cron), { ok: true, source: 'cron', cron, description });
    });
  }

  test('normalizes named fields', () => {
    const result = parseScheduleInput('0 9 * * MON-FRI');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.cron, '0 9 * * 1-5');
  });
});

describe('invalid schedules', () => {
  const cases = [
    'tomorrow at 9am',
    'every business day at 9am',
    'every 60 minutes',
    'every 2 days at 9am',
    'every 30 seconds',
    'every 2 weeks on Monday at 9am',
    'every 2 hours starting at 1:30am',
    'daily at 30 minutes past the hour',
    'every 15 minutes at 30 minutes past the hour',
    'every month on the 32nd at 9am',
    'on the 5th through 1st at 9am',
    'every Friday through Monday at 9am',
    'yearly March through January at 9am',
    'at 9:15am and 5:30pm every day',
    '0 60 * * *',
    '0 9 * *',
  ];

  for (const input of cases) {
    test(`rejects ${input}`, () => {
      assert.equal(parseScheduleInput(input).ok, false);
    });
  }
});
