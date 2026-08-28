import { describe, it, expect } from 'bun:test';
import { applyMapping, previewTable, validateMapping, type MappingContext } from '../../mapping';

const ctx: MappingContext = {
  labels: [
    { id: 1, name: 'api' },
    { id: 2, name: 'Docs' },
  ],
  members: [
    { userId: 'u1', name: 'Ann', email: 'ann@example.com' },
    { userId: 'u2', name: null, email: 'bob@example.com' },
  ],
};

describe('mapping validation', () => {
  it('requires title and drops unknown fields', () => {
    expect(() => validateMapping({ description: 'Notes' })).toThrow('title');
    const mapping = validateMapping({ title: 'Task', nonsense: 'X', priority: 'Urgency' });
    expect(mapping).toEqual({ title: 'Task', priority: 'Urgency' });
  });
});

describe('applyMapping', () => {
  const parsed = {
    headers: ['Task', 'Details', 'Urgency', 'Deadline', 'Tags', 'Owner'],
    totalRows: 4,
    rowNumbers: [2, 3, 4, 5],
    rows: [
      ['A', 'first', 'high', '2026-09-01', 'api, Docs', 'ann@example.com'],
      ['B', '', '', '07/09/2026', 'nope', 'Nobody'],
      ['', '', '', '', '', ''],
      ['D', 'last', 'low', 'bad-date', '', ''],
    ],
  };

  it('builds drafts, resolves labels and assignees, and reports skips', () => {
    const applied = applyMapping(
      parsed,
      validateMapping({
        title: 'Task',
        description: 'Details',
        priority: 'Urgency',
        dueDate: 'Deadline',
        labels: 'Tags',
        assignee: 'Owner',
      }),
      ctx,
    );
    expect(applied[0].draft).toEqual({
      title: 'A',
      description: 'first',
      priority: 'high',
      dueDate: '2026-09-01',
      labelIds: [1, 2],
      assigneeUserId: 'u1',
    });
    // An unknown label and an unmatched assignee resolve to nothing, not to an error.
    expect(applied[1].draft).toEqual({ title: 'B', dueDate: '2026-09-07' });
    // Skips name the sheet row, blank lines included.
    expect(applied[2]).toEqual({ rowNumber: 4, reason: 'Empty title' });
    expect(applied[3].reason).toBe('"bad-date" is not a readable date');
  });

  it('fails when the mapped column is gone from the file', () => {
    expect(() =>
      applyMapping({ ...parsed, headers: ['Name'] }, validateMapping({ title: 'Task' }), ctx),
    ).toThrow('not in the file anymore');
  });
});

describe('previewTable', () => {
  const parsed = {
    headers: ['Task', 'Details', 'Due', 'Watchers'],
    totalRows: 4,
    rows: [
      ['A', 'x'.repeat(250), '', 'ann'],
      ['B', 'short', '', ''],
      [' a ', 'again', '', ''],
      ['', 'no title', '', ''],
    ],
  };

  it('keeps the mapped columns in field order, cuts cells short, and holds every row', () => {
    const { columns, rows } = previewTable(
      parsed,
      { description: 'details', title: 'Task' },
      new Set(),
    );
    expect(columns).toEqual([
      { field: 'title', header: 'Task' },
      { field: 'description', header: 'Details' },
    ]);
    expect(rows).toHaveLength(4);
    expect(rows[0]!.cells[1]).toHaveLength(200);
    expect(rows[1]!.cells).toEqual(['B', 'short']);
  });

  it('marks a title the project already has, and a repeat of an earlier row', () => {
    const { rows } = previewTable(parsed, { title: 'Task' }, new Set(['b']));
    expect(rows.map((row) => row.skip)).toEqual([
      null,
      'An issue with this title exists',
      'An issue with this title exists',
      'Empty title',
    ]);
  });

  it('gives a row confirm rejects that reason, and leaves its title for a later row', () => {
    const { rows } = previewTable(
      {
        ...parsed,
        rows: [
          ['A', '', 'someday', ''],
          ['A', '', '', ''],
        ],
      },
      { title: 'Task', dueDate: 'Due' },
      new Set(),
    );
    expect(rows.map((row) => row.skip)).toEqual(['"someday" is not a readable date', null]);
  });

  it('drops a mapped column the file no longer has', () => {
    expect(previewTable(parsed, { title: 'Task', labels: 'Gone' }, new Set()).columns).toEqual([
      { field: 'title', header: 'Task' },
    ]);
  });
});
