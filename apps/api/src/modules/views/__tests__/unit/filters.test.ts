import { describe, expect, it } from 'bun:test';
import type { ColumnRow } from '#modules/columns/service';
import type { IssueRow } from '#modules/issues/service';
import { applyFilters } from '../../filters';

function issue(id: number, dueDate: string | null, assigneeUserId = 'me'): IssueRow {
  return {
    id,
    columnId: 1,
    dueDate,
    assigneeUserId,
    delegateUserId: null,
    priority: null,
    typeId: null,
    initiative: null,
    cycle: null,
    labelIds: [],
    fieldValues: [],
    startDate: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as unknown as IssueRow;
}

const columns = [{ id: 1, stateType: 'started' }] as ColumnRow[];

describe('shared view dynamic filters', () => {
  it('evaluates Current user only when the caller supplies an identity', () => {
    const filters = {
      conditions: [{ field: 'assignee', op: 'is', values: ['$currentUser'] }],
    };
    const issues = [issue(1, null), issue(2, null, 'other')];

    expect(
      applyFilters(issues, filters, columns, { currentUserId: 'me' }).map((row) => row.id),
    ).toEqual([1]);
    expect(applyFilters(issues, filters, columns).map((row) => row.id)).toEqual([]);
    expect(
      applyFilters(
        issues,
        { conditions: [{ field: 'assignee', op: 'is_not', values: ['$currentUser'] }] },
        columns,
      ).map((row) => row.id),
    ).toEqual([]);
  });

  it('evaluates relative due dates against a fixed day', () => {
    const issues = [issue(1, '2026-08-28'), issue(2, '2026-08-29'), issue(3, '2026-09-05')];
    const filters = { conditions: [{ field: 'dueDate', op: 'next_7_days', values: [] }] };

    expect(
      applyFilters(issues, filters, columns, { today: '2026-08-29' }).map((row) => row.id),
    ).toEqual([2, 3]);
  });
});
