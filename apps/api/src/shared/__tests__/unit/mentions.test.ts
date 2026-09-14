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

  it('reads a mention next to markup that never closes', () => {
    expect(parseMentionHandles('[[[ @ada <<< @bob ![ @carol `')).toEqual(['ada', 'bob', 'carol']);
    expect(parseMentionHandles('[a]( [b]( @ada')).toEqual(['ada']);
    expect(parseMentionHandles('[@ada](https://x.com/a_(b)) and [@bob')).toEqual(['bob']);
  });

  // The markup scan must stay linear: an unclosed opener repeated for the whole text
  // is the case where a scan that restarts at every opener goes quadratic.
  it('scans a text of unclosed markup openers in linear time', () => {
    const openers = ['['.repeat(100_000), '<'.repeat(100_000), '[a]('.repeat(25_000)];
    for (const text of openers) {
      const started = performance.now();
      expect(parseMentionHandles(`${text.slice(0, 99_990)} cc @ada`)).toEqual(['ada']);
      expect(performance.now() - started).toBeLessThan(50);
    }
  });

  it('reads nothing from a text longer than any the api accepts', () => {
    const started = performance.now();
    expect(parseMentionHandles('['.repeat(200_000))).toEqual([]);
    expect(parseMentionHandles(`${'x'.repeat(100_000)} @ada`)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(50);
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
