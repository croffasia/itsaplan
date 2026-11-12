import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CustomField, CustomFieldType } from '@/lib/api/endpoints/customFields';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { EMPTY_FILTER_SET } from '@/utils/filters';
import type { GroupLabels } from '@/utils/project';
import type { GroupField, PropertyKey } from '@/utils/viewSettings';
import { columnKey } from './table';
import { buildTimeline, timelineColumns } from './timeline';

const field = (id: number, fieldType: CustomFieldType): CustomField => ({
  id,
  issueTypeId: null,
  name: `Field ${id}`,
  fieldType,
  memberScope: null,
  showInBody: false,
  position: id,
  options: [],
});

describe('timelineColumns', () => {
  it('keeps the display order and leaves out the identifier, long text and stale keys', () => {
    const keys: PropertyKey[] = ['cf:2', 'id', 'priority', 'cf:1', 'cf:3', 'cf:99', 'assignee'];
    const fields = [field(1, 'text'), field(2, 'select'), field(3, 'markdown')];
    const columns = timelineColumns(keys, fields);
    assert.deepEqual(
      columns.map((c) => columnKey(c.column)),
      ['cf2', 'priority', 'assignee'],
    );
    assert.deepEqual(
      columns.map((c) => c.width),
      [132, 100, 132],
    );
  });
});

describe('buildTimeline', () => {
  const project = {
    issues: [],
    columns: [{ id: 1, name: 'Todo', color: '#000', stateType: 'unstarted' }],
  } as unknown as ProjectDetail;
  const addRows = (group: GroupField, canAdd: boolean) =>
    buildTimeline({
      project,
      filters: EMPTY_FILTER_SET,
      group,
      subgroup: 'none',
      sort: { field: 'manual', dir: 'asc' },
      groupLabels: {} as GroupLabels,
      showEmptyGroups: true,
      collapsedGroups: new Set(),
      canAddTo: () => canAdd,
      viewportW: 0,
      labelW: 0,
      dayW: 32,
    }).rows.filter((row) => row.kind === 'add');

  it('ends each section with an add row, including the ungrouped one', () => {
    assert.deepEqual(addRows('none', true), [{ kind: 'add', key: 'all', assign: null }]);
    assert.deepEqual(addRows('status', true), [
      { kind: 'add', key: 'c1', assign: { patch: { columnId: 1 }, fields: [] } },
    ]);
    assert.deepEqual(addRows('none', false), []);
  });
});
