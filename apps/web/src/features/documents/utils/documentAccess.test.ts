import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { managesDocument, sharedThroughAncestor } from './documentAccess';

function page(id: number, patch: Partial<ProjectDocumentSummary> = {}): ProjectDocumentSummary {
  return {
    id,
    projectId: 1,
    parentId: null,
    title: `Page ${id}`,
    icon: null,
    metadata: {},
    fullWidth: false,
    isPrivate: false,
    visibility: 'public',
    isLocked: false,
    isPinned: false,
    isFavorite: false,
    archivedAt: null,
    position: id,
    version: 1,
    ownerUserId: null,
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  };
}

describe('sharedThroughAncestor', () => {
  it('returns the nearest ancestor shared with its subpages', () => {
    const ancestors = [page(1), page(2), page(3)];
    assert.equal(sharedThroughAncestor(ancestors, new Set([1, 2]))?.id, 2);
  });

  it('returns null when no ancestor is shared with its subpages', () => {
    assert.equal(sharedThroughAncestor([page(1), page(2)], new Set([9])), null);
  });

  it('stops at a private or archived page between the share and this page', () => {
    const shared = new Set([1]);
    assert.equal(sharedThroughAncestor([page(1), page(2, { isPrivate: true })], shared), null);
    assert.equal(
      sharedThroughAncestor([page(1), page(2, { archivedAt: '2026-09-02T00:00:00.000Z' })], shared),
      null,
    );
  });
});

describe('managesDocument', () => {
  it('lets the page owner or a project owner manage the page', () => {
    const owned = { ownerUserId: 'u1' };
    assert.equal(managesDocument(owned, 'u1', false), true);
    assert.equal(managesDocument(owned, 'u2', true), true);
    assert.equal(managesDocument(owned, 'u2', false), false);
    assert.equal(managesDocument(owned, null, true), false);
  });
});
