import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentAncestors, documentBranchIds, documentChildren } from './documentTree';

function document(id: number, parentId: number | null, title: string): ProjectDocumentSummary {
  return {
    id,
    projectId: 1,
    parentId,
    title,
    icon: null,
    metadata: {},
    fullWidth: false,
    isPrivate: false,
    visibility: 'public',
    isLocked: false,
    isPinned: false,
    pinPosition: null,
    isFavorite: false,
    archivedAt: null,
    position: id,
    version: 1,
    ownerUserId: null,
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('documentAncestors', () => {
  it('returns the root-first path for a nested document', () => {
    const root = document(1, null, 'Root');
    const section = document(2, 1, 'Section');
    const page = document(3, 2, 'Page');

    assert.deepEqual(documentAncestors(page, [page, root, section]), [root, section]);
  });

  it('stops safely when malformed data contains a cycle', () => {
    const first = document(1, 2, 'First');
    const second = document(2, 1, 'Second');

    assert.deepEqual(documentAncestors(first, [first, second]), [second]);
  });
});

describe('documentChildren', () => {
  it('returns the direct children of a page in manual order', () => {
    const root = document(1, null, 'Root');
    const second = { ...document(2, 1, 'Second'), position: 2 };
    const first = { ...document(3, 1, 'First'), position: 1 };
    const grandchild = document(4, 3, 'Grandchild');

    assert.deepEqual(documentChildren(1, [root, second, first, grandchild]), [first, second]);
  });

  it('lists a page whose parent is not visible as a top-level page', () => {
    const root = document(1, null, 'Root');
    const orphan = document(2, 99, 'Orphan');

    assert.deepEqual(documentChildren(null, [orphan, root]), [root, orphan]);
  });
});

describe('documentBranchIds', () => {
  it('lists each page that has a subpage in the same tree', () => {
    const root = document(1, null, 'Root');
    const section = document(2, 1, 'Section');
    const leaf = document(3, 2, 'Leaf');
    const sibling = document(4, 2, 'Sibling');
    const orphan = document(5, 99, 'Orphan');
    const privatePage = { ...document(6, 3, 'Private'), isPrivate: true };

    assert.deepEqual(
      documentBranchIds([root, section, leaf, sibling, orphan, privatePage]),
      [1, 2],
    );
  });
});
