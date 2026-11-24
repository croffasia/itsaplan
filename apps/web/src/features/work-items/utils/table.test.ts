import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { IssueGroup } from '@/utils/project';
import type { ViewSettings } from '@/utils/viewSettings';
import { buildTableItems, type FlatItem } from './table';

const column = (id: number, takesIssues = true): IssueGroup => ({
  key: `c${id}`,
  name: `Column ${id}`,
  assign: takesIssues ? { patch: { columnId: id }, fields: [] } : null,
  values: [id],
});
const issue = (id: number, columnId: number) =>
  ({ id, columnId, position: id, fieldValues: [] }) as unknown as BoardIssue;
const settings = (group: string) =>
  ({ group, subgroup: 'none', showEmptyGroups: true }) as unknown as ViewSettings;

function describeItem(it: FlatItem): string {
  switch (it.kind) {
    case 'header':
      return `header:${it.group.key}`;
    case 'subheader':
      return `sub:${it.dropKey}`;
    case 'row':
      return `row:${it.issue.id}`;
    case 'add':
      return `add:${it.dropKey}`;
  }
}

describe('buildTableItems', () => {
  it('ends each expanded section that takes new issues with an add row', () => {
    const items = buildTableItems({
      groups: [column(1), column(2, false), column(3), column(4)],
      subGroups: [],
      sorted: [issue(1, 1), issue(2, 2), issue(3, 3), issue(4, 4)],
      settings: settings('status'),
      collapsed: new Set(['c3']),
      // Column 4 stands for one at its hard WIP limit.
      canAddTo: (assign) => assign?.patch.columnId !== 4,
    });
    assert.deepEqual(items.map(describeItem), [
      'header:c1',
      'row:1',
      'add:c1',
      'header:c2',
      'row:2',
      'header:c3',
      'header:c4',
      'row:4',
    ]);
    const add = items.find((i) => i.kind === 'add');
    assert.deepEqual(add?.assign?.patch, { columnId: 1 });
  });

  it('adds one row to an ungrouped table when issues may be created', () => {
    const base = { groups: [], subGroups: [], sorted: [], collapsed: new Set<string>() };
    const items = (canAdd: boolean) =>
      buildTableItems({ ...base, settings: settings('none'), canAddTo: () => canAdd });
    assert.deepEqual(items(true).map(describeItem), ['add:all']);
    assert.deepEqual(items(false), []);
  });
});
