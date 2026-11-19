import { expect, test } from 'bun:test';
import type { WeeklyReportSettings } from '../../model';
import { calculateProgress, reportDates, type ReportIssue } from '../../progress';

const settings = {
  levelOneTypeId: 1,
  levelTwoTypeId: 2,
  levelThreeTypeId: 3,
  levelTwoWeightId: 1,
  levelThreeWeightId: 2,
  completionRateId: 3,
  levelTwoReasonId: 4,
  levelThreeReasonId: 5,
  timeZone: 'Asia/Taipei',
} satisfies WeeklyReportSettings;

function task(
  id: number,
  typeId: number,
  parentId: number | null,
  values: [number, string][],
): ReportIssue {
  return {
    id,
    typeId,
    parentId,
    title: String(id),
    dueDate: null,
    state: 'started',
    fields: new Map(values.map(([field, number]) => [field, { number, text: null }])),
  };
}

test('the project date controls the Monday boundary', () => {
  expect(reportDates(new Date('2026-11-15T15:59:59Z'), settings.timeZone)).toEqual({
    today: '2026-11-15',
    weekStart: '2026-11-09',
  });
  expect(reportDates(new Date('2026-11-15T16:00:00Z'), settings.timeZone)).toEqual({
    today: '2026-11-16',
    weekStart: '2026-11-16',
  });
});

test('compares exact stored weights and does not round a child result before rollup', () => {
  const tasks = [
    task(1, 1, null, []),
    task(2, 2, 1, [[1, '50']]),
    task(3, 2, 1, [[1, '50']]),
    task(4, 3, 2, [
      [2, '99.9'],
      [3, '0.004'],
    ]),
    task(5, 3, 2, [
      [2, '0.1'],
      [3, '0.004'],
    ]),
    task(6, 3, 3, [
      [2, '100'],
      [3, '0.008'],
    ]),
  ];
  const report = calculateProgress(tasks, settings, '2026-11-19');
  expect(report.groups[0].progress).toBe(0.01);
  expect(report.groups[0].nodes.map(({ progress }) => progress)).toEqual([0, 0.01]);

  tasks[4].fields.set(2, { number: '0.10000000000001', text: null });
  const invalid = calculateProgress(tasks, settings, '2026-11-19');
  expect(invalid.groups[0].progress).toBeNull();
  expect(invalid.groups[0].nodes[0].progress).toBeNull();
  expect(invalid.warnings).toContainEqual({ id: 2, title: '2', kind: 'weightTotal' });
});
