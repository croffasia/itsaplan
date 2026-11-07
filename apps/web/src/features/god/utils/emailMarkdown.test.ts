import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prefixLine, replaceSelection, unknownVariables, wrapSelection } from './emailMarkdown';

describe('wrapSelection', () => {
  it('wraps the selected text and keeps it selected', () => {
    assert.deepEqual(wrapSelection('one two', 4, 7, '**', '**', 'bold'), {
      value: 'one **two**',
      start: 6,
      end: 9,
    });
  });

  it('puts a sample in when nothing is selected', () => {
    assert.deepEqual(wrapSelection('one ', 4, 4, '[', '](https://)', 'link text'), {
      value: 'one [link text](https://)',
      start: 5,
      end: 14,
    });
  });
});

describe('prefixLine', () => {
  it('marks the line the cursor is on', () => {
    assert.deepEqual(prefixLine('one\ntwo', 5, '- '), { value: 'one\n- two', start: 6, end: 6 });
  });

  it('marks the first line', () => {
    assert.equal(prefixLine('one', 2, '# ').value, '# one');
  });
});

describe('replaceSelection', () => {
  it('puts a placeholder over the selection', () => {
    assert.deepEqual(replaceSelection('a old b', 2, 5, '{ref}'), {
      value: 'a {ref} b',
      start: 7,
      end: 7,
    });
  });
});

describe('unknownVariables', () => {
  it('names each variable the template does not have, once', () => {
    assert.deepEqual(unknownVariables('{ref} {nope} {nope} {other}', ['ref']), ['nope', 'other']);
  });
});
