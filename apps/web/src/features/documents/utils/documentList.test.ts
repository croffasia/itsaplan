import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { compareDocuments, documentBelongsToTab } from './documentList';

const document = {
  isFavorite: true,
  isPrivate: true,
} as ProjectDocumentSummary;

describe('documentBelongsToTab', () => {
  test('includes private pages in personal favorites', () => {
    assert.equal(documentBelongsToTab(document, 'favorites'), true);
  });

  test('keeps private pages out of the public tab', () => {
    assert.equal(documentBelongsToTab(document, 'public'), false);
    assert.equal(documentBelongsToTab(document, 'private'), true);
  });

  test('lets the archived query define archived membership', () => {
    assert.equal(documentBelongsToTab(document, 'archived'), true);
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

  test('puts pinned pages first in manual order', () => {
    assert.deepEqual(ids('position', 'asc'), [3, 1, 2]);
  });

  test('keeps pinned pages first in both directions of another order', () => {
    assert.deepEqual(ids('updated', 'asc'), [3, 1, 2]);
    assert.deepEqual(ids('updated', 'desc'), [3, 2, 1]);
  });
});
