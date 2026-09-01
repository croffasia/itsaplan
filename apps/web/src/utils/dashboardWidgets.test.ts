import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDetail } from '@/lib/api';
import { myFocusDashboardLayout, stackLayout, type WidgetInstance } from './dashboardWidgets';
import { CURRENT_USER_FILTER_VALUE } from './filters';

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

describe('myFocusDashboardLayout', () => {
  it('uses dynamic ownership and the project started columns', () => {
    const project = {
      columns: [
        { id: 1, name: 'Todo', stateType: 'unstarted' },
        { id: 2, name: 'In Progress', stateType: 'started' },
        { id: 3, name: 'Review', stateType: 'started' },
      ],
    } as ProjectDetail;
    const layout = myFocusDashboardLayout(project, (key) => key);

    assert.deepEqual(
      layout.map((widget) => widget.title),
      ['todo', 'inProgress', 'review', 'overdue', 'next7Days'],
    );
    for (const widget of layout) {
      assert.equal(widget.config?.filters?.conditions[0]?.values[0], CURRENT_USER_FILTER_VALUE);
    }
    assert.equal(layout[1].config?.filters?.conditions[1]?.values[0], 2);
    assert.equal(layout[2].config?.filters?.conditions[1]?.values[0], 3);
  });

  it('uses Todo but does not invent Review in a generic workflow', () => {
    const project = {
      columns: [
        { id: 1, name: 'Backlog', stateType: 'backlog' },
        { id: 2, name: 'Todo', stateType: 'unstarted' },
        { id: 3, name: 'Doing', stateType: 'started' },
      ],
    } as ProjectDetail;
    const layout = myFocusDashboardLayout(project, (key) => key);

    assert.deepEqual(
      layout.map((widget) => widget.title),
      ['todo', 'inProgress', 'overdue', 'next7Days'],
    );
    assert.equal(layout[0].config?.filters?.conditions[1]?.field, 'status');
    assert.equal(layout[0].config?.filters?.conditions[1]?.values[0], 2);
    assert.equal(
      layout.some((widget) => widget.title === 'review'),
      false,
    );
  });
});
