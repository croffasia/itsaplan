import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { sortGroupedIssues, sortIssues } from '@/utils/project';
import { defaultViewSettings } from '@/utils/viewSettings';

function issue(id: number, patch: Partial<BoardIssue> = {}): BoardIssue {
  return {
    id,
    position: id,
    title: `Task ${id}`,
    identifier: `TEST-${id}`,
    columnId: 1,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    assigneeUserId: null,
    typeId: null,
    startDate: null,
    dueDate: null,
    priority: null,
    fieldValues: [],
    ...patch,
  } as BoardIssue;
}

const project = {
  columns: [
    { id: 1, name: 'First' },
    { id: 2, name: 'Second' },
  ],
  assignees: [],
  issueTypes: [],
} as unknown as ProjectDetail;

describe('issue ordering', () => {
  it('orders created and updated timestamps descending with manual position ties', () => {
    const issues = [
      issue(1, { position: 30, createdAt: '2026-09-03', updatedAt: '2026-09-02' }),
      issue(2, { position: 10, createdAt: '2026-09-03', updatedAt: '2026-09-04' }),
      issue(3, { position: 20, createdAt: '2026-09-01', updatedAt: '2026-09-04' }),
    ];

    assert.deepEqual(
      sortIssues(issues, { field: 'created', dir: 'desc' }, project).map((item) => item.id),
      [2, 1, 3],
    );
    assert.deepEqual(
      sortIssues(issues, { field: 'updated', dir: 'desc' }, project).map((item) => item.id),
      [2, 3, 1],
    );
    assert.deepEqual(
      issues.map((item) => item.id),
      [1, 2, 3],
    );
  });

  it('uses each primary column override in flat groups and every swimlane cell', () => {
    const settings = {
      ...defaultViewSettings('kanban'),
      sort: { field: 'created', dir: 'asc' } as const,
      columnSorts: { c1: { field: 'updated', dir: 'desc' } as const },
    };
    const firstLane = new Map([
      [
        'c1',
        [
          issue(1, { position: 20, updatedAt: '2026-09-02' }),
          issue(2, { position: 10, updatedAt: '2026-09-03' }),
        ],
      ],
      [
        'c2',
        [
          issue(3, { position: 20, createdAt: '2026-09-03' }),
          issue(4, { position: 10, createdAt: '2026-09-01' }),
        ],
      ],
    ]);
    const secondLane = new Map([
      [
        'c1',
        [
          issue(5, { position: 10, updatedAt: '2026-09-01' }),
          issue(6, { position: 20, updatedAt: '2026-09-04' }),
        ],
      ],
    ]);

    sortGroupedIssues(firstLane, settings, project);
    sortGroupedIssues(secondLane, settings, project);

    assert.deepEqual(
      firstLane.get('c1')?.map((item) => item.id),
      [2, 1],
    );
    assert.deepEqual(
      firstLane.get('c2')?.map((item) => item.id),
      [4, 3],
    );
    assert.deepEqual(
      secondLane.get('c1')?.map((item) => item.id),
      [6, 5],
    );
  });
});
