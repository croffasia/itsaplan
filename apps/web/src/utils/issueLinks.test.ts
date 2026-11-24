import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Column, StateType } from '@/lib/api/endpoints/columns';
import type { BoardIssue, Issue, IssueLinkRef } from '@/lib/api/endpoints/issues';
import { isBlocked } from './issueLinks';

const columns = (['started', 'completed', 'canceled'] as StateType[]).map(
  (stateType, i) => ({ id: i + 1, stateType }) as Column,
);
const columnById = new Map(columns.map((column) => [column.id, column]));
const [started, completed, canceled] = columns;

const issue = (id: number, columnId: number, links: IssueLinkRef[] = []) =>
  ({ id, columnId, links }) as unknown as BoardIssue;

function blockedBy(blockerColumn: Column | null) {
  const blocker = issue(2, blockerColumn?.id ?? 0);
  const issueById = new Map<number, Issue>(blockerColumn ? [[2, blocker]] : []);
  const card = issue(1, started.id, [{ id: 9, relation: 'blocked_by', issueId: 2 }]);
  return isBlocked(card, issueById, columnById);
}

describe('isBlocked', () => {
  it('holds while the blocker is open', () => {
    assert.equal(blockedBy(started), true);
  });

  it('lets go once the blocker is completed or canceled', () => {
    assert.equal(blockedBy(completed), false);
    assert.equal(blockedBy(canceled), false);
  });

  it('holds for a blocker the board cannot find, since the relation stands', () => {
    assert.equal(blockedBy(null), true);
  });

  it('ignores the relations that do not block the issue', () => {
    const other = issue(2, started.id);
    const card = issue(1, started.id, [
      { id: 9, relation: 'blocks', issueId: 2 },
      { id: 10, relation: 'relates', issueId: 2 },
    ]);
    assert.equal(isBlocked(card, new Map([[2, other]]), columnById), false);
  });
});
