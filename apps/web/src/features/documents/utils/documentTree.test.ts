import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api';
import { documentAncestors } from './documentTree';

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
    isLocked: false,
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
