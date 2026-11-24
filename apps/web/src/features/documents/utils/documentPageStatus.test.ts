import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { documentPageStatus } from './documentPageStatus';

const page = {
  archived: false,
  canEdit: true,
  locked: false,
  sync: 'saved' as const,
  recovery: false,
  save: 'saved' as const,
  dirty: false,
};

describe('documentPageStatus', () => {
  it('reports a saved page', () => {
    assert.equal(documentPageStatus(page), 'saved');
  });

  it('puts read-only states before sync states', () => {
    assert.equal(documentPageStatus({ ...page, archived: true, canEdit: false }), 'archived');
    assert.equal(documentPageStatus({ ...page, canEdit: false, locked: true }), 'viewOnly');
    assert.equal(documentPageStatus({ ...page, locked: true, sync: 'error' }), 'locked');
  });

  it('reports the session before the draft', () => {
    assert.equal(documentPageStatus({ ...page, recovery: true, sync: 'conflict' }), 'recovery');
    assert.equal(
      documentPageStatus({ ...page, sync: 'conflict', save: 'error' }),
      'sessionConflict',
    );
    assert.equal(documentPageStatus({ ...page, sync: 'offline', dirty: true }), 'offline');
    assert.equal(documentPageStatus({ ...page, sync: 'connecting' }), 'connecting');
    assert.equal(documentPageStatus({ ...page, sync: null, save: 'error' }), 'error');
    assert.equal(documentPageStatus({ ...page, sync: null, save: 'conflict' }), 'conflict');
  });

  it('reports unsaved edits as saving', () => {
    assert.equal(documentPageStatus({ ...page, dirty: true }), 'saving');
    assert.equal(documentPageStatus({ ...page, sync: 'saving' }), 'saving');
  });
});
