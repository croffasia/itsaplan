import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { groupRuns } from './groupRuns';

const run = (id: number, issueId: number | null, scheduleId: number | null = null) =>
  ({
    id,
    issueId,
    scheduleId,
    scheduleName: scheduleId == null ? null : 'Daily',
  }) as RunnerQueueRun;

it('groups consecutive runs on one issue or of one schedule and keeps the rest apart', () => {
  const groups = groupRuns([
    run(8, 1),
    run(7, 1),
    run(6, null, 10),
    run(5, null, 10),
    run(4, null, 11),
    run(3, null),
    run(2, null),
    run(1, 1),
  ]);
  assert.deepEqual(
    groups.map((group) => group.map((item) => item.id)),
    [[8, 7], [6, 5], [4], [3], [2], [1]],
  );
});
