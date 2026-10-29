import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { View } from '@/lib/api/endpoints/views';
import { movedInRow } from './views.service';

function view(id: number, flags: Partial<View> = {}): View {
  return {
    id,
    projectId: 1,
    name: `V${id}`,
    icon: null,
    filters: { conditions: [] },
    display: { layout: 'kanban' } as View['display'],
    position: id,
    shareToken: null,
    shareExtended: false,
    isPrivate: false,
    favorite: false,
    hidden: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...flags,
  };
}

const ids = (views: View[] | null) => views?.map((v) => v.id);

describe('movedInRow', () => {
  // A favorite and a private view in the middle of the caller's row.
  const row = [view(1), view(2, { favorite: true }), view(3, { isPrivate: true }), view(4)];

  it('moves the view to the place of the one it is dropped on, over favorites and private ones', () => {
    assert.deepEqual(ids(movedInRow(row, 4, 2)), [1, 4, 2, 3]);
    assert.deepEqual(ids(movedInRow(row, 1, 3)), [2, 3, 1, 4]);
  });

  it('moves to the front of the row for a drop on All', () => {
    assert.deepEqual(ids(movedInRow(row, 3, null)), [3, 1, 2, 4]);
  });

  it('moves nothing when the view stays where it is', () => {
    assert.equal(movedInRow(row, 1, null), null);
    assert.equal(movedInRow(row, 2, 2), null);
    assert.equal(movedInRow(row, 9, 1), null);
  });
});
