import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortForField } from '@/utils/viewTypes';
import {
  defaultViewSettings,
  effectiveColumnSort,
  normalizeSavedDisplay,
  normalizeViewSettings,
  withColumnSort,
} from '@/utils/viewSettings';

describe('view sorting settings', () => {
  it('keeps valid column orderings and drops unknown fields and directions', () => {
    const settings = normalizeViewSettings(
      {
        sort: { field: 'not-a-field', dir: 'asc' },
        columnSorts: {
          c12: { field: 'updated', dir: 'desc' },
          'a-none': { field: 'manual', dir: 'asc' },
          f8uagent123: { field: 'created', dir: 'desc' },
          c13: { field: 'unknown', dir: 'asc' },
          c14: { field: 'title', dir: 'sideways' },
        },
      } as never,
      'kanban',
    );

    assert.deepEqual(settings.sort, { field: 'manual', dir: 'asc' });
    assert.deepEqual(settings.columnSorts, {
      c12: { field: 'updated', dir: 'desc' },
      'a-none': { field: 'manual', dir: 'asc' },
      f8uagent123: { field: 'created', dir: 'desc' },
    });
  });

  it('follows the board ordering when a column has no ordering of its own', () => {
    const settings = {
      ...defaultViewSettings('kanban'),
      sort: { field: 'created', dir: 'desc' } as const,
      columnSorts: { c1: { field: 'title', dir: 'asc' } as const },
    };

    assert.deepEqual(effectiveColumnSort(settings, 'c1'), { field: 'title', dir: 'asc' });
    assert.equal(effectiveColumnSort(settings, 'c2'), settings.sort);
  });

  it('sets and removes a column ordering without touching the others', () => {
    const base = {
      ...defaultViewSettings('kanban'),
      columnSorts: { c1: { field: 'title', dir: 'asc' } as const },
    };

    const withDone = withColumnSort(base, 'c2', { field: 'updated', dir: 'desc' });
    assert.deepEqual(withDone.columnSorts, {
      c1: { field: 'title', dir: 'asc' },
      c2: { field: 'updated', dir: 'desc' },
    });
    assert.deepEqual(withColumnSort(withDone, 'c1', null).columnSorts, {
      c2: { field: 'updated', dir: 'desc' },
    });
    assert.deepEqual(base.columnSorts, { c1: { field: 'title', dir: 'asc' } });
  });

  it('normalizes saved displays and starts newly selected date fields newest first', () => {
    const display = normalizeSavedDisplay({
      layout: 'kanban',
      columnSorts: null,
    });

    assert.deepEqual(display.columnSorts, {});
    assert.deepEqual(sortForField('created', { field: 'title', dir: 'asc' }), {
      field: 'created',
      dir: 'desc',
    });
    assert.deepEqual(sortForField('updated', { field: 'updated', dir: 'asc' }), {
      field: 'updated',
      dir: 'asc',
    });
  });
});
