import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { documentToolbarPosition } from './DocumentEditorCanvas';

describe('DocumentEditorCanvas toolbar position', () => {
  it('pins the toolbar inside the editor scroll container', () => {
    assert.equal(documentToolbarPosition(true), 'sticky top-0');
  });

  it('keeps the toolbar in the document flow when disabled', () => {
    assert.equal(documentToolbarPosition(false), 'relative');
  });
});
