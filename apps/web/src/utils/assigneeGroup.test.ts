import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { applyFilters, type FilterSet } from './filters';
import {
  buildGroups,
  defaultsFromFilters,
  groupIssues,
  groupKeyOf,
  type GroupLabels,
} from './project';

const project = {
  columns: [],
  groups: [
    { id: 1, projectId: 1, name: 'Pharmacy', color: '#112233', position: 1000, memberIds: [] },
    { id: 2, projectId: 1, name: 'Nursing', color: '#445566', position: 2000, memberIds: [] },
  ],
} as unknown as ProjectDetail;

const labels = { noAssigneeGroup: 'No group' } as GroupLabels;

const issue = (id: number, assigneeGroupId: number | null) =>
  ({ id, assigneeGroupId, columnId: 1 }) as unknown as Issue;

const inGroup = (...values: (number | null)[]): FilterSet => ({
  conditions: [{ id: 'c', field: 'assigneeGroup', op: 'is', values }],
});

describe('assignee group grouping', () => {
  it('lists the project groups in order, then a group for issues with none', () => {
    const groups = buildGroups(project, 'assigneeGroup', labels, { conditions: [] });
    assert.deepEqual(
      groups.map((g) => [g.key, g.name]),
      [
        ['g1', 'Pharmacy'],
        ['g2', 'Nursing'],
        ['g-none', 'No group'],
      ],
    );
    assert.deepEqual(groups[0].assign?.patch, { assigneeGroupId: 1 });
    assert.deepEqual(groups[2].assign?.patch, { assigneeGroupId: null });
  });

  it('puts each issue under the key of its group', () => {
    assert.equal(groupKeyOf(issue(1, 2), 'assigneeGroup'), 'g2');
    assert.equal(groupKeyOf(issue(2, null), 'assigneeGroup'), 'g-none');
    const groups = buildGroups(project, 'assigneeGroup', labels, { conditions: [] });
    const byGroup = groupIssues(
      groups,
      [issue(1, 1), issue(2, null), issue(3, 1)],
      'assigneeGroup',
    );
    assert.deepEqual(
      byGroup.get('g1')?.map((i) => i.id),
      [1, 3],
    );
    assert.deepEqual(
      byGroup.get('g-none')?.map((i) => i.id),
      [2],
    );
  });

  it('drops the groups a filter on the grouping field excludes', () => {
    const groups = buildGroups(project, 'assigneeGroup', labels, inGroup(2));
    assert.deepEqual(
      groups.map((g) => g.key),
      ['g2'],
    );
  });
});

describe('assignee group filter', () => {
  const issues = [issue(1, 1), issue(2, 2), issue(3, null)];

  it('keeps the issues assigned to a chosen group', () => {
    assert.deepEqual(
      applyFilters(issues, inGroup(1, 2), project).map((i) => i.id),
      [1, 2],
    );
  });

  it('matches the issues with no group through a null value', () => {
    assert.deepEqual(
      applyFilters(issues, inGroup(null), project).map((i) => i.id),
      [3],
    );
  });

  it('excludes a group with is_not', () => {
    const filters: FilterSet = {
      conditions: [{ id: 'c', field: 'assigneeGroup', op: 'is_not', values: [1] }],
    };
    assert.deepEqual(
      applyFilters(issues, filters, project).map((i) => i.id),
      [2, 3],
    );
  });

  it('pins a new issue to the group the filter names', () => {
    const defaults = defaultsFromFilters(inGroup(2), { cycles: [], initiatives: [] });
    assert.equal(defaults.assigneeGroupId, 2);
  });
});
