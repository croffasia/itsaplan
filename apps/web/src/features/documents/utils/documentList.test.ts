import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { compareDocuments, documentGroup, documentMatchesFilters } from './documentList';

describe('documentMatchesFilters', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');
  const page = (createdByUserId: string, createdAt: string) =>
    ({ createdByUserId, createdAt }) as ProjectDocumentSummary;

  test('keeps pages by their creator', () => {
    assert.equal(documentMatchesFilters(page('maya', '2026-11-01'), 'maya', 'all', now), true);
    assert.equal(documentMatchesFilters(page('leo', '2026-11-01'), 'maya', 'all', now), false);
  });

  test('keeps pages created within the range', () => {
    const recent = page('maya', '2026-11-20T12:00:00.000Z');
    assert.equal(documentMatchesFilters(recent, null, 'week', now), true);
    assert.equal(documentMatchesFilters(recent, null, 'today', now), false);
  });
});

describe('documentGroup', () => {
  const page = (id: number, parentId: number | null) =>
    ({ id, parentId }) as ProjectDocumentSummary;

  test('moves a page whose parent is not in the list to the top level', () => {
    const group = documentGroup([page(1, null), page(2, 1), page(3, 9)]);
    assert.deepEqual(
      group.documents.map((document) => document.parentId),
      [null, 1, null],
    );
    assert.equal(group.reorderSafe, false);
  });

  test('is safe to reorder when every parent is in the list', () => {
    assert.equal(documentGroup([page(1, null), page(2, 1)]).reorderSafe, true);
  });
});

describe('compareDocuments', () => {
  const page = (id: number, isPinned: boolean, updatedAt: string) =>
    ({ id, isPinned, position: id, title: `Page ${id}`, updatedAt }) as ProjectDocumentSummary;
  const old = page(1, false, '2026-01-01T00:00:00.000Z');
  const recent = page(2, false, '2026-03-01T00:00:00.000Z');
  const pinned = page(3, true, '2026-02-01T00:00:00.000Z');
  const ids = (sortBy: 'position' | 'updated', direction: 'asc' | 'desc') =>
    [old, recent, pinned]
      .sort((a, b) => compareDocuments(a, b, sortBy, direction))
      .map((document) => document.id);

  test('orders pinned pages like any other page', () => {
    assert.deepEqual(ids('position', 'asc'), [1, 2, 3]);
    assert.deepEqual(ids('updated', 'asc'), [1, 3, 2]);
    assert.deepEqual(ids('updated', 'desc'), [2, 3, 1]);
  });
});
