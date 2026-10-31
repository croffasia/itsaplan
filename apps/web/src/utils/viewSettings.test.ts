import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultViewSettings, normalizeSavedDisplay } from './viewSettings';

describe('normalizeSavedDisplay', () => {
  it('falls back to the kanban defaults for a display that is not an object', () => {
    for (const blob of [null, undefined, 'kanban', 42, []]) {
      assert.deepEqual(normalizeSavedDisplay(blob), {
        layout: 'kanban',
        ...defaultViewSettings('kanban'),
      });
    }
  });

  it('falls back to kanban for an unknown layout', () => {
    assert.equal(normalizeSavedDisplay({ layout: 'board' }).layout, 'kanban');
  });

  it('keeps a known layout and its valid settings', () => {
    const display = normalizeSavedDisplay({ layout: 'table', showEmptyGroups: false });
    assert.equal(display.layout, 'table');
    assert.equal(display.showEmptyGroups, false);
  });

  it('forces a non-boolean flag to its default', () => {
    assert.equal(
      normalizeSavedDisplay({ layout: 'kanban', showEmptyGroups: 'yes' }).showEmptyGroups,
      defaultViewSettings('kanban').showEmptyGroups,
    );
  });
});
