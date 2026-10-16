import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Issue } from '@/lib/api/endpoints/issues';
import { dropPositions, issuesToMove } from './kanban';

const issue = (id: number, position: number) => ({ id, position }) as Issue;

describe('Kanban sorted target movement', () => {
  it('keeps manual reorders, blocks sorted reorders, and allows cross-column moves', () => {
    const target = [issue(1, 100), issue(2, 200)];
    const boardOrder = [issue(3, 50), ...target];

    assert.deepEqual(issuesToMove([2], boardOrder, target, true), [2]);
    assert.deepEqual(issuesToMove([2], boardOrder, target, false), []);
    assert.deepEqual(issuesToMove([3], boardOrder, target, false), [3]);
  });

  it('places a manual drop between its neighbours', () => {
    assert.deepEqual(dropPositions([issue(1, 100), issue(2, 200)], 1, 1, true), [150]);
  });

  it('appends a drop into a sorted column to the end of the manual order', () => {
    const visuallySorted = [issue(3, 300), issue(1, 100), issue(2, 200)];

    assert.deepEqual(dropPositions(visuallySorted, 0, 1, false), [1300]);
    assert.deepEqual(
      visuallySorted.map((item) => item.id),
      [3, 1, 2],
    );
  });
});
