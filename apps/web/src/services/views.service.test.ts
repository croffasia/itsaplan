import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { View } from '@/lib/api/endpoints/views';
import { reorderedViews, tabOrder } from './views.service';

function view(id: number, position: number, flags: Partial<View> = {}): View {
  return {
    id,
    projectId: 1,
    name: `V${id}`,
    icon: null,
    filters: { conditions: [] },
    display: { layout: 'kanban' } as View['display'],
    position,
    shareToken: null,
    shareExtended: false,
    isPrivate: false,
    favorite: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...flags,
  };
}

const ids = (views: View[] | null) => views?.map((v) => v.id);

describe('reorderedViews', () => {
  // F is a favorite stored last; the tab row shows it first.
  const a = view(1, 0);
  const b = view(2, 1);
  const c = view(3, 2);
  const f = view(4, 3, { favorite: true });
  const mine = view(5, 0, { isPrivate: true });
  const tabs = tabOrder([a, b, c, f, mine]);

  it('moves the view to the stored place of the one it is dropped on', () => {
    assert.deepEqual(ids(tabs), [4, 1, 2, 3, 5]);
    assert.deepEqual(ids(reorderedViews(tabs, a.id, f.id)), [2, 3, 4, 1]);
  });

  it('gives the tab row the server will answer with, favorites still ahead', () => {
    const moved = reorderedViews(tabs, a.id, f.id)!;
    assert.deepEqual(ids(tabOrder([mine, ...moved])), [4, 2, 3, 1, 5]);
  });

  it('moves to the front of its own list for a drop on All', () => {
    assert.deepEqual(ids(reorderedViews(tabs, c.id, null)), [3, 1, 2, 4]);
  });

  it('moves nothing when the view stays where it is', () => {
    assert.equal(reorderedViews(tabs, a.id, null), null);
    assert.equal(reorderedViews(tabs, a.id, a.id), null);
  });

  it("does not move a view onto the other list's", () => {
    assert.equal(reorderedViews(tabs, mine.id, a.id), null);
  });
});
