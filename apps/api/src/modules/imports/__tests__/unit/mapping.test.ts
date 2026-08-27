import { describe, it, expect } from 'bun:test';
import { applyMapping, validateMapping, type MappingContext } from '../../mapping';

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
