import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { importedMarkdownJson, markdownTitle } from './documentImport';

describe('importedMarkdownJson', () => {
  const globals = ['window', 'document', 'navigator', 'Node'] as const;
  const previous = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  before(() => {
    const { window } = new JSDOM('<!doctype html>');
    for (const name of globals) {
      Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
    }
  });
  after(() => {
    globals.forEach((name, index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  });

  test('parses a file that fits on one page', () => {
    assert.deepEqual(importedMarkdownJson('# Notes')?.content?.[0]?.type, 'heading');
  });

  test('rejects a file over the character limit', () => {
    assert.equal(importedMarkdownJson('a'.repeat(250_001)), null);
  });

  test('rejects a file whose page has more nodes than the api accepts', () => {
    const list = Array.from({ length: 4000 }, (_, index) => `- item ${index}`).join('\n');
    assert.equal(importedMarkdownJson(list), null);
  });
});

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
