import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { subtreeRows } from './subtasks';

const rows = (issues: { id: number; parentId: number }[], rootIds: number[]) =>
  subtreeRows(issues, rootIds).map(({ issue, depth }) => [issue.id, depth]);

describe('subtreeRows', () => {
  it('lists every level under the roots in tree order', () => {
    const issues = [
      { id: 2, parentId: 1 },
      { id: 4, parentId: 3 },
      { id: 3, parentId: 2 },
      { id: 5, parentId: 1 },
    ];
    assert.deepEqual(rows(issues, [1]), [
      [2, 0],
      [3, 1],
      [4, 2],
      [5, 0],
    ]);
  });

  it('lists a root that is under another root inside that root’s tree', () => {
    const issues = [
      { id: 3, parentId: 2 },
      { id: 2, parentId: 1 },
    ];
    assert.deepEqual(rows(issues, [2, 1]), [
      [2, 0],
      [3, 1],
    ]);
  });
});
