import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ProjectDocumentSummary } from '@/lib/api';
import { documentBelongsToTab } from './documentList';

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
