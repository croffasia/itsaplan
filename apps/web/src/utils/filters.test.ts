import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import {
  applyFilters,
  CURRENT_USER_FILTER_VALUE,
  filterToday,
  resolveFilterSet,
  type FilterCondition,
  type FilterSet,
} from './filters';

function issue(id: number, dueDate: string | null, assigneeUserId = 'me'): Issue {
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
  } as unknown as Issue;
}

const project = {
  columns: [{ id: 1, stateType: 'started' }],
} as ProjectDetail;

function filters(condition: Omit<FilterCondition, 'id'>): FilterSet {
  return { conditions: [{ ...condition, id: 'c1' }] };
}

describe('dynamic filters', () => {
  it('keeps stored presence filters without values when resolving Current user', () => {
    const stored: FilterSet = JSON.parse(
      '{"conditions":[{"id":"no-date","field":"dueDate","op":"is_not_set"},{"id":"date","field":"startDate","op":"is_set"}]}',
    );

    assert.equal(resolveFilterSet(stored, { currentUserId: 'me' }), stored);
  });

  it('resolves Current user beside a stored presence filter without changing it', () => {
    const stored: FilterSet = JSON.parse(
      '{"conditions":[{"id":"no-date","field":"dueDate","op":"is_not_set"},{"id":"mine","field":"assignee","op":"is","values":["$currentUser"]}]}',
    );

    const resolved = resolveFilterSet(stored, { currentUserId: 'me' });
    assert.equal(resolved.conditions[0], stored.conditions[0]);
    assert.deepEqual(resolved.conditions[1]?.values, ['me']);
    assert.deepEqual(stored.conditions[1]?.values, [CURRENT_USER_FILTER_VALUE]);
  });

  it('derives today from the account timezone', () => {
    const now = new Date('2026-08-29T23:30:00.000Z');

    assert.equal(filterToday(now, 'Asia/Bangkok'), '2026-08-30');
    assert.equal(filterToday(now, 'America/New_York'), '2026-08-29');
  });

  it('resolves Current user without persisting a concrete account id', () => {
    const input = [issue(1, null), issue(2, null, 'other')];
    const result = applyFilters(
      input,
      filters({ field: 'assignee', op: 'is', values: [CURRENT_USER_FILTER_VALUE] }),
      project,
      { currentUserId: 'me', today: '2026-08-29' },
    );

    assert.deepEqual(
      result.map((item) => item.id),
      [1],
    );
  });

  it('evaluates relative due dates against the supplied local day', () => {
    const input = [
      issue(1, '2026-08-28'),
      issue(2, '2026-08-29'),
      issue(3, '2026-08-30'),
      issue(4, '2026-09-01'),
      issue(5, '2026-09-05'),
      issue(6, '2026-09-06'),
      issue(7, null),
    ];
    const idsFor = (op: FilterCondition['op']) =>
      applyFilters(input, filters({ field: 'dueDate', op, values: [] }), project, {
        today: '2026-08-29',
      }).map((item) => item.id);

    assert.deepEqual(idsFor('overdue'), [1]);
    assert.deepEqual(idsFor('today'), [2]);
    assert.deepEqual(idsFor('next_3_days'), [2, 3, 4]);
    assert.deepEqual(idsFor('next_7_days'), [2, 3, 4, 5]);
    assert.deepEqual(idsFor('is_not_set'), [7]);
  });
});
