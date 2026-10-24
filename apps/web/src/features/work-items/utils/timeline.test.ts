import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CustomField, CustomFieldType } from '@/lib/api/endpoints/customFields';
import type { PropertyKey } from '@/utils/viewSettings';
import { columnKey } from './table';
import { timelineColumns } from './timeline';

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
