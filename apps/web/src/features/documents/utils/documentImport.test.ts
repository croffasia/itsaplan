import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { markdownTitle } from './documentImport';

describe('markdownTitle', () => {
  test('takes the page title from the file name', () => {
    assert.equal(markdownTitle('Release notes.md'), 'Release notes');
    assert.equal(markdownTitle('release-notes.markdown'), 'release-notes');
  });

  test('matches the extension regardless of case', () => {
    assert.equal(markdownTitle('Notes.MD'), 'Notes');
  });

  test('keeps a name that does not end in a markdown extension', () => {
    assert.equal(markdownTitle('notes.md.bak'), 'notes.md.bak');
  });

  test('trims surrounding whitespace', () => {
    assert.equal(markdownTitle('  notes.md  '), 'notes');
  });
});
