import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api';
import { applyOptimisticDocumentMove, projectedDocumentMove } from './documentMove';

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
