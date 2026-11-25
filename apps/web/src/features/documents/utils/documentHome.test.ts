import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  applyDocumentPinOrder,
  documentHomeDays,
  documentHomeOpened,
  documentHomePinned,
  documentHomeUpdated,
  documentPinPlacement,
} from './documentHome';

const page = (id: number, parentId: number | null, extra: Partial<ProjectDocumentSummary> = {}) =>
  ({
    id,
    parentId,
    position: id,
    title: `Page ${id}`,
    isPinned: false,
    pinPosition: null,
    isFavorite: false,
    updatedAt: `2026-01-${String(id).padStart(2, '0')}T00:00:00.000Z`,
    ...extra,
  }) as ProjectDocumentSummary;

const ids = (documents: ProjectDocumentSummary[]) => documents.map((document) => document.id);

describe('documentHomePinned', () => {
  test('makes a card of each pinned page with its direct children in order', () => {
    const pinned = documentHomePinned([
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

  test('dates a card by the latest update of the page and its direct children', () => {
    const [card] = documentHomePinned([
      page(1, null, { isPinned: true, updatedAt: '2026-01-05T00:00:00.000Z' }),
      page(2, 1, { updatedAt: '2026-01-09T00:00:00.000Z' }),
      page(3, 2, { updatedAt: '2026-01-20T00:00:00.000Z' }),
    ]);
    assert.equal(card!.updatedAt, '2026-01-09T00:00:00.000Z');
  });

  test('makes no card when nothing is pinned', () => {
    assert.deepEqual(documentHomePinned([page(1, null), page(2, 1)]), []);
  });

  test('orders the cards by the place the project chose, then by id', () => {
    const pinned = documentHomePinned([
      page(1, null, { isPinned: true, pinPosition: 3072 }),
      page(2, null, { isPinned: true, pinPosition: 1024, position: 9 }),
      page(3, 1, { isPinned: true, pinPosition: 2048 }),
      page(4, null, { isPinned: true, pinPosition: 1024 }),
    ]);
    assert.deepEqual(
      pinned.map((card) => card.page.id),
      [2, 4, 3, 1],
    );
  });
});

describe('documentPinPlacement', () => {
  test('names the pinned pages a page sits between in a new order', () => {
    assert.deepEqual(documentPinPlacement([3, 1, 2], 3), { afterId: undefined, beforeId: 1 });
    assert.deepEqual(documentPinPlacement([1, 3, 2], 3), { afterId: 1, beforeId: 2 });
    assert.deepEqual(documentPinPlacement([1, 2, 3], 3), { afterId: 2, beforeId: undefined });
  });
});

describe('applyDocumentPinOrder', () => {
  test('numbers the pinned pages in the new order and leaves the other pages alone', () => {
    const loose = page(9, null);
    const documents = applyDocumentPinOrder(
      [
        page(1, null, { isPinned: true, pinPosition: 1024 }),
        page(2, null, { isPinned: true, pinPosition: 2048 }),
        loose,
      ],
      [2, 1],
    );
    assert.deepEqual(
      documents.map((document) => [document.id, document.pinPosition]),
      [
        [1, 2048],
        [2, 1024],
        [9, null],
      ],
    );
    assert.equal(documents[2], loose);
    assert.deepEqual(
      documentHomePinned(documents).map((card) => card.page.id),
      [2, 1],
    );
  });
});

describe('documentHomeOpened', () => {
  test('keeps the visit order and drops pages no longer listed', () => {
    const opened = documentHomeOpened(
      [page(1, null), page(2, null)],
      [
        { id: 2, at: 30 },
        { id: 9, at: 20 },
        { id: 1, at: 10 },
      ],
    );
    assert.deepEqual(
      opened.map((item) => [item.document.id, item.at]),
      [
        [2, 30],
        [1, 10],
      ],
    );
  });
});

describe('documentHomeUpdated', () => {
  test('lists the eight most recently updated pages of the whole tree, newest first', () => {
    const documents = Array.from({ length: 10 }, (_, index) =>
      page(index + 1, index === 0 ? null : index),
    );
    assert.deepEqual(
      documentHomeUpdated(documents).map((item) => item.document.id),
      [10, 9, 8, 7, 6, 5, 4, 3],
    );
  });
});

describe('documentHomeDays', () => {
  test('groups by calendar day and leaves out empty groups', () => {
    const now = new Date(2026, 10, 23, 9, 0);
    const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).getTime();
    const items = [at(23, 8), at(22, 23), at(22, 1), at(17), at(16), at(1)].map((time, id) => ({
      document: page(id + 1, null),
      at: time,
    }));
    assert.deepEqual(
      documentHomeDays(items, now).map((group) => [
        group.day,
        group.items.map((i) => i.document.id),
      ]),
      [
        ['today', [1]],
        ['yesterday', [2, 3]],
        ['week', [4]],
        ['earlier', [5, 6]],
      ],
    );
    assert.deepEqual(
      documentHomeDays([items[0]!], now).map((group) => group.day),
      ['today'],
    );
  });
});
