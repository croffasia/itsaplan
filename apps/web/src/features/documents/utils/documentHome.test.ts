import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentHomeSections } from './documentHome';

const page = (id: number, parentId: number | null, extra: Partial<ProjectDocumentSummary> = {}) =>
  ({
    id,
    parentId,
    position: id,
    title: `Page ${id}`,
    isPinned: false,
    isFavorite: false,
    updatedAt: `2026-01-${String(id).padStart(2, '0')}T00:00:00.000Z`,
    ...extra,
  }) as ProjectDocumentSummary;

const ids = (documents: ProjectDocumentSummary[]) => documents.map((document) => document.id);

describe('documentHomeSections', () => {
  test('makes a card of each pinned page with its direct children in order', () => {
    const { pinned } = documentHomeSections([
      page(1, null, { isPinned: true }),
      page(2, 1, { position: 9 }),
      page(3, 1),
      page(4, 3),
      page(5, null),
      page(6, 5, { isPinned: true }),
    ]);
    assert.deepEqual(
      pinned.map((card) => [card.page.id, ids(card.children)]),
      [
        [1, [3, 2]],
        [6, []],
      ],
    );
  });

  test('makes no card when nothing is pinned', () => {
    assert.deepEqual(documentHomeSections([page(1, null), page(2, 1)]).pinned, []);
  });

  test('lists favorites from any depth', () => {
    const { favorites } = documentHomeSections([
      page(1, null, { isFavorite: true }),
      page(2, 1),
      page(3, 2, { isFavorite: true }),
    ]);
    assert.deepEqual(ids(favorites), [1, 3]);
  });

  test('lists the eight most recently updated pages of the whole tree, newest first', () => {
    const documents = Array.from({ length: 10 }, (_, index) =>
      page(index + 1, index === 0 ? null : index),
    );
    assert.deepEqual(ids(documentHomeSections(documents).recent), [10, 9, 8, 7, 6, 5, 4, 3]);
  });
});
