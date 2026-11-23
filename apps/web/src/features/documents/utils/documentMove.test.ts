import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  adjacentDocumentMove,
  applyOptimisticDocumentMove,
  documentMoveParents,
  documentMoveToParent,
  projectedDocumentMove,
} from './documentMove';

const page = (id: number, parentId: number | null, position: number): ProjectDocumentSummary =>
  ({ id, parentId, position, version: 1, title: `Page ${id}` }) as ProjectDocumentSummary;

describe('projectedDocumentMove', () => {
  it('indents a page below the target when dragged toward the content', () => {
    const one = page(1, null, 0);
    const two = page(2, null, 1);
    const byParent = new Map<number | null, ProjectDocumentSummary[]>([[null, [one, two]]]);
    assert.deepEqual(
      projectedDocumentMove({
        source: two,
        target: one,
        deltaX: 32,
        ordered: [one, two],
        byParent,
        byId: new Map([
          [1, one],
          [2, two],
        ]),
      }),
      { parentId: 1, position: 1, previousSiblingId: null, nextSiblingId: null },
    );
  });

  it('refuses a drop between a pinned page and one that is not', () => {
    const pinned = { ...page(1, null, 2), isPinned: true };
    const other = { ...page(2, null, 1), isPinned: false };
    assert.equal(
      projectedDocumentMove({
        source: other,
        target: pinned,
        deltaX: 0,
        ordered: [pinned, other],
        byParent: new Map([[null, [pinned, other]]]),
        byId: new Map([
          [1, pinned],
          [2, other],
        ]),
      }),
      null,
    );
  });

  it('refuses to move a page below one of its descendants', () => {
    const parent = page(1, null, 0);
    const child = page(2, 1, 0);
    assert.equal(
      projectedDocumentMove({
        source: parent,
        target: child,
        deltaX: 32,
        ordered: [parent, child],
        byParent: new Map([
          [null, [parent]],
          [1, [child]],
        ]),
        byId: new Map([
          [1, parent],
          [2, child],
        ]),
      }),
      null,
    );
  });

  it('outdents beside the parent in logical tree order', () => {
    const parent = page(1, null, 2);
    const first = page(2, 1, 0);
    const second = page(3, 1, 1);
    const next = page(4, null, 4);
    assert.deepEqual(
      projectedDocumentMove({
        source: second,
        target: first,
        deltaX: -32,
        ordered: [parent, first, second, next],
        byParent: new Map([
          [null, [parent, next]],
          [1, [first, second]],
        ]),
        byId: new Map([
          [1, parent],
          [2, first],
          [3, second],
          [4, next],
        ]),
      }),
      { parentId: null, position: 3, previousSiblingId: 1, nextSiblingId: 4 },
    );
  });

  it('refuses a self-target even when called outside the drag handler', () => {
    const source = page(1, null, 1);
    assert.equal(
      projectedDocumentMove({
        source,
        target: source,
        deltaX: 0,
        ordered: [source],
        byParent: new Map([[null, [source]]]),
        byId: new Map([[source.id, source]]),
      }),
      null,
    );
  });

  it('uses the sibling anchors when numeric positions no longer have a midpoint', () => {
    const source = page(1, 9, 1);
    const target = page(2, null, 10_000_000_000_000_000);
    const next = page(3, null, 10_000_000_000_000_002);
    const result = projectedDocumentMove({
      source,
      target,
      deltaX: 0,
      ordered: [source, target, next],
      byParent: new Map([
        [null, [target, next]],
        [9, [source]],
      ]),
      byId: new Map([
        [source.id, source],
        [target.id, target],
        [next.id, next],
      ]),
    });

    assert.deepEqual(result, {
      parentId: null,
      position: 2048,
      previousSiblingId: target.id,
      nextSiblingId: next.id,
    });
  });
});

describe('applyOptimisticDocumentMove', () => {
  it('projects the complete target sibling order without duplicate positions', () => {
    const one = page(1, null, 1024);
    const two = page(2, null, 2048);
    const three = page(3, null, 3072);

    const result = applyOptimisticDocumentMove([one, two, three], {
      documentId: 3,
      parentId: null,
      position: 1536,
      previousSiblingId: 1,
      nextSiblingId: 2,
    });

    assert.deepEqual(
      result
        .filter((document) => document.parentId === null)
        .sort((left, right) => left.position - right.position)
        .map(({ id, position, version }) => ({ id, position, version })),
      [
        { id: 1, position: 1024, version: 1 },
        { id: 3, position: 2048, version: 2 },
        { id: 2, position: 3072, version: 1 },
      ],
    );
  });

  it('normalizes only the destination siblings for a nested move', () => {
    const parent = page(1, null, 1024);
    const source = page(2, null, 2048);
    const child = page(3, 1, 4096);

    const result = applyOptimisticDocumentMove([parent, source, child], {
      documentId: 2,
      parentId: 1,
      position: 5120,
      previousSiblingId: 3,
      nextSiblingId: null,
    });

    assert.deepEqual(
      result.map(({ id, parentId, position, version }) => ({ id, parentId, position, version })),
      [
        { id: 1, parentId: null, position: 1024, version: 1 },
        { id: 2, parentId: 1, position: 2048, version: 2 },
        { id: 3, parentId: 1, position: 1024, version: 1 },
      ],
    );
  });

  it('keeps the cache unchanged when an anchor is absent', () => {
    const documents = [page(1, null, 1024), page(2, null, 2048)];
    const result = applyOptimisticDocumentMove(documents, {
      documentId: 2,
      parentId: null,
      position: 1,
      previousSiblingId: 999,
      nextSiblingId: null,
    });

    assert.equal(result, documents);
  });
});

describe('adjacentDocumentMove', () => {
  const first = page(1, null, 1024);
  const second = page(2, null, 2048);
  const child = page(5, 2, 1024);
  const third = page(3, null, 3072);
  const fourth = page(4, null, 4096);
  const tree = {
    ordered: [first, second, child, third, fourth],
    byParent: new Map<number | null, ProjectDocumentSummary[]>([
      [null, [first, second, third, fourth]],
      [2, [child]],
    ]),
    byId: new Map([first, second, child, third, fourth].map((item) => [item.id, item])),
  };

  it('anchors a step up between the two pages above', () => {
    assert.deepEqual(adjacentDocumentMove({ source: third, direction: -1, ...tree }), {
      parentId: null,
      position: 1536,
      previousSiblingId: 1,
      nextSiblingId: 2,
    });
  });

  it('anchors a step down between the two pages below, past the subpages of the next one', () => {
    assert.deepEqual(adjacentDocumentMove({ source: second, direction: 1, ...tree }), {
      parentId: null,
      position: 3584,
      previousSiblingId: 3,
      nextSiblingId: 4,
    });
  });

  it('anchors a step to the first and to the last place on one side only', () => {
    assert.deepEqual(adjacentDocumentMove({ source: second, direction: -1, ...tree }), {
      parentId: null,
      position: 1023,
      previousSiblingId: null,
      nextSiblingId: 1,
    });
    assert.deepEqual(adjacentDocumentMove({ source: third, direction: 1, ...tree }), {
      parentId: null,
      position: 4097,
      previousSiblingId: 4,
      nextSiblingId: null,
    });
  });

  it('has no step past the first or the last page', () => {
    assert.equal(adjacentDocumentMove({ source: first, direction: -1, ...tree }), null);
    assert.equal(adjacentDocumentMove({ source: fourth, direction: 1, ...tree }), null);
    assert.equal(adjacentDocumentMove({ source: child, direction: 1, ...tree }), null);
  });

  it('steps among the pinned pages and among the others, never across the two', () => {
    const pin = (id: number, position: number, isPinned: boolean) => ({
      ...page(id, null, position),
      isPinned,
    });
    const plainA = pin(1, 1024, false);
    const pinnedA = pin(2, 2048, true);
    const plainB = pin(3, 3072, false);
    const pinnedB = pin(4, 4096, true);
    const all = [pinnedA, pinnedB, plainA, plainB];
    const list = {
      ordered: all,
      byParent: new Map<number | null, ProjectDocumentSummary[]>([[null, all]]),
      byId: new Map(all.map((item) => [item.id, item])),
    };

    assert.equal(adjacentDocumentMove({ source: pinnedA, direction: -1, ...list }), null);
    assert.equal(adjacentDocumentMove({ source: pinnedB, direction: 1, ...list }), null);
    assert.equal(adjacentDocumentMove({ source: plainA, direction: -1, ...list }), null);
    assert.equal(adjacentDocumentMove({ source: plainB, direction: 1, ...list }), null);
    assert.deepEqual(adjacentDocumentMove({ source: pinnedA, direction: 1, ...list }), {
      parentId: null,
      position: 4097,
      previousSiblingId: 4,
      nextSiblingId: null,
    });
    assert.deepEqual(adjacentDocumentMove({ source: plainB, direction: -1, ...list }), {
      parentId: null,
      position: 1023,
      previousSiblingId: null,
      nextSiblingId: 1,
    });
  });
});

describe('documentMoveParents', () => {
  const active = (
    id: number,
    parentId: number | null,
    position: number,
    patch: Partial<ProjectDocumentSummary> = {},
  ) => ({ ...page(id, parentId, position), archivedAt: null, isPrivate: false, ...patch });
  const offered = (source: ProjectDocumentSummary, documents: ProjectDocumentSummary[]) =>
    documentMoveParents(source, documents).map(({ page: item, ancestors }) => [
      item.id,
      ancestors.map((ancestor) => ancestor.id),
    ]);

  it('offers the other pages in tree order with their ancestors', () => {
    const source = active(4, null, 3072);
    const documents = [
      active(3, 1, 1024),
      active(2, null, 2048),
      source,
      active(1, null, 1024),
      active(5, 3, 1024),
    ];
    assert.deepEqual(offered(source, documents), [
      [1, []],
      [3, [1]],
      [5, [1, 3]],
      [2, []],
    ]);
  });

  it('leaves out the page, its subpages and its current parent', () => {
    const source = active(2, 1, 1024);
    const documents = [
      active(1, null, 1024),
      source,
      active(3, 2, 1024),
      active(4, 3, 1024),
      active(5, null, 2048),
    ];
    assert.deepEqual(offered(source, documents), [[5, []]]);
  });

  it('leaves out archived pages and pages with another access', () => {
    const source = active(1, null, 1024);
    const documents = [
      source,
      active(2, null, 2048, { archivedAt: '2026-01-01T00:00:00.000Z' }),
      active(3, null, 3072, { isPrivate: true }),
      active(4, 3, 1024),
    ];
    assert.deepEqual(offered(source, documents), [[4, [3]]]);
    assert.deepEqual(offered(documents[2]!, documents), []);
  });

  it('offers a page whose parent the viewer does not see as a top-level page', () => {
    const source = active(1, null, 1024);
    assert.deepEqual(offered(source, [source, active(2, 99, 1024)]), [[2, []]]);
  });
});

describe('documentMoveToParent', () => {
  it('anchors the page after the last page below the new parent', () => {
    const source = page(4, null, 1024);
    const documents = [page(1, null, 2048), page(3, 1, 2048), page(2, 1, 1024), source];
    assert.deepEqual(documentMoveToParent(source, 1, documents), {
      parentId: 1,
      position: 2049,
      previousSiblingId: 3,
      nextSiblingId: null,
    });
  });

  it('sends no anchor to a parent without pages', () => {
    const source = page(2, null, 2048);
    assert.deepEqual(documentMoveToParent(source, 1, [page(1, null, 1024), source]), {
      parentId: 1,
      position: 1,
      previousSiblingId: null,
      nextSiblingId: null,
    });
  });

  it('anchors a move to the top level after the last top-level page', () => {
    const source = page(3, 1, 1024);
    const documents = [page(1, null, 1024), page(2, null, 2048), source, page(4, 99, 9000)];
    assert.deepEqual(documentMoveToParent(source, null, documents), {
      parentId: null,
      position: 2049,
      previousSiblingId: 2,
      nextSiblingId: null,
    });
  });
});
