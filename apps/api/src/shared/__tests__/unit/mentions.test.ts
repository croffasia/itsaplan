import { describe, expect, it } from 'bun:test';
import { addedMentionHandles, parseMentionHandles } from '#shared/mentions';

// A mention is written as @handle in a comment, an issue description or a markdown
// custom field. parseMentionHandles extracts the handles; addedMentionHandles is what
// keeps an edit from notifying the people the text already named.

describe('parseMentionHandles', () => {
  it('reads a handle', () => {
    expect(parseMentionHandles('hey @design_bot look')).toEqual(['design_bot']);
  });

  it('lowercases and de-duplicates', () => {
    expect(parseMentionHandles('@Ada asked @bob, @ada answered')).toEqual(['ada', 'bob']);
  });

  it('keeps sentence punctuation out of the handle', () => {
    expect(parseMentionHandles('ping @ada. and @bob-')).toEqual(['ada', 'bob']);
  });

  it('reads a handle holding a dot, a dash and digits', () => {
    expect(parseMentionHandles('@ada.lovelace-2 shipped it')).toEqual(['ada.lovelace-2']);
  });

  it('ignores an email address', () => {
    expect(parseMentionHandles('write to ada@example.com')).toEqual([]);
  });

  it('reads a handle at the start of a line and inside markdown emphasis', () => {
    expect(parseMentionHandles('@ada\n**@bob** and (@carol)')).toEqual(['ada', 'bob', 'carol']);
  });

  it('returns nothing for a text with no mention', () => {
    expect(parseMentionHandles('plain comment, no tags')).toEqual([]);
  });

  it('ignores an @ inside code', () => {
    expect(parseMentionHandles('install `@types/node`')).toEqual([]);
    expect(parseMentionHandles('```ts\n@Injectable()\n```\nand @ada')).toEqual(['ada']);
  });

  it('ignores an @ inside a link and a bare url', () => {
    expect(parseMentionHandles('see [the thread](https://x.com/@ada)')).toEqual([]);
    expect(parseMentionHandles('https://x.com/@ada is theirs')).toEqual([]);
  });
});

describe('addedMentionHandles', () => {
  it('returns only the handles the edit added', () => {
    expect(addedMentionHandles('cc @ada', 'cc @ada and @bob')).toEqual(['bob']);
  });

  it('returns nothing when the edit removed a mention', () => {
    expect(addedMentionHandles('cc @ada and @bob', 'cc @ada')).toEqual([]);
  });
});
