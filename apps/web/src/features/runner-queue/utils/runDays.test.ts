import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { setDisplayTimezone } from '@/utils/dates';
import { runDays } from './runDays';

const run = (id: number, createdAt: string) => ({ id, createdAt }) as RunnerQueueRun;

it('splits runs by the day they were queued on in the display zone', () => {
  setDisplayTimezone('UTC');
  try {
    const days = runDays([
      run(3, '2026-11-16T09:00:00Z'),
      run(2, '2026-11-16T01:00:00Z'),
      run(1, '2026-11-15T23:00:00Z'),
    ]);
    assert.deepEqual(
      days.map(({ day, runs }) => [day, runs.map((item) => item.id)]),
      [
        ['2026-11-16', [3, 2]],
        ['2026-11-15', [1]],
      ],
    );
  } finally {
    setDisplayTimezone('');
  }
});
