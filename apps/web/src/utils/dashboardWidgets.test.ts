import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stackLayout, type WidgetInstance } from './dashboardWidgets';

function widget(id: string, x: number, y: number, w: number, h = 3): WidgetInstance {
  return { id, type: 'stat', x, y, w, h };
}

describe('stackLayout', () => {
  it('pairs quarter-width tiles and gives everything wider the full width', () => {
    const stacked = stackLayout([
      widget('a', 0, 0, 3),
      widget('b', 3, 0, 3),
      widget('c', 6, 0, 3),
      widget('d', 0, 3, 6, 6),
    ]);
    assert.deepEqual(
      stacked.map((w) => [w.id, w.x, w.y, w.w, w.h]),
      [
        ['a', 0, 0, 1, 3],
        ['b', 1, 0, 1, 3],
        ['c', 0, 3, 1, 3],
        ['d', 0, 6, 2, 6],
      ],
    );
  });

  it('keeps the saved reading order, top row first', () => {
    const stacked = stackLayout([widget('bottom', 0, 5, 12), widget('top', 6, 0, 12)]);
    assert.deepEqual(
      stacked.map((w) => w.id),
      ['top', 'bottom'],
    );
  });
});
