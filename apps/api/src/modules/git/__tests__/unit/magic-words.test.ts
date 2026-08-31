import { describe, it, expect } from 'bun:test';
import { parseIssueIdentifiers, parseMagicWords } from '../../magic-words';

const ids = (refs: { key: string; sequenceNumber: number }[]) =>
  refs.map((r) => `${r.key}-${r.sequenceNumber}`);

describe('parseMagicWords', () => {
  it('parses a closing word with one identifier', () => {
    const parsed = parseMagicWords('Fixes MKT-42');
    expect(ids(parsed.closes)).toEqual(['MKT-42']);
    expect(parsed.references).toEqual([]);
  });

  it('parses every closing word inflection', () => {
    for (const word of ['close', 'closes', 'fixed', 'resolving', 'completes', 'implemented']) {
      const parsed = parseMagicWords(`${word} MKT-1`);
      expect(ids(parsed.closes)).toEqual(['MKT-1']);
    }
  });

  it('parses several identifiers after one word', () => {
    const parsed = parseMagicWords('Closes MKT-1, MKT-2 and MKT-3');
    expect(ids(parsed.closes)).toEqual(['MKT-1', 'MKT-2', 'MKT-3']);
  });

  it('parses non-closing words as references', () => {
    const parsed = parseMagicWords('Related to MKT-7 and refs MKT-8');
    expect(parsed.closes).toEqual([]);
    expect(ids(parsed.references)).toEqual(['MKT-7', 'MKT-8']);
  });

  it('is case-insensitive and uppercases the key', () => {
    const parsed = parseMagicWords('FIXES mkt-9');
    expect(ids(parsed.closes)).toEqual(['MKT-9']);
  });

  it('accepts an optional colon after the word', () => {
    const parsed = parseMagicWords('Closes: MKT-4');
    expect(ids(parsed.closes)).toEqual(['MKT-4']);
  });

  it('drops identifiers named by skip/ignore anywhere in the text', () => {
    const parsed = parseMagicWords('Fixes MKT-1 and MKT-2.\n\nskip MKT-2');
    expect(ids(parsed.closes)).toEqual(['MKT-1']);
    expect(ids(parsed.skipped)).toEqual(['MKT-2']);
  });

  it('counts an identifier as closing when both word kinds name it', () => {
    const parsed = parseMagicWords('Refs MKT-5. Fixes MKT-5');
    expect(ids(parsed.closes)).toEqual(['MKT-5']);
    expect(parsed.references).toEqual([]);
  });

  it('ignores identifiers without a magic word', () => {
    const parsed = parseMagicWords('See MKT-6 for context');
    expect(parsed.closes).toEqual([]);
    expect(parsed.references).toEqual([]);
  });

  it('ignores a magic word inside another word', () => {
    const parsed = parseMagicWords('prefixes MKT-3');
    expect(parsed.closes).toEqual([]);
  });

  it('handles multi-word phrases with flexible whitespace', () => {
    const parsed = parseMagicWords('part  of MKT-11');
    expect(ids(parsed.references)).toEqual(['MKT-11']);
  });

  it('dedupes repeated identifiers', () => {
    const parsed = parseMagicWords('Fixes MKT-1. Closes MKT-1');
    expect(ids(parsed.closes)).toEqual(['MKT-1']);
  });
});

describe('parseIssueIdentifiers', () => {
  it('finds an issue key in a conventional branch name', () => {
    expect(ids(parseIssueIdentifiers('feature/MKT-42-short-title'))).toEqual(['MKT-42']);
  });

  it('does not treat a later dashed word as another issue key', () => {
    expect(ids(parseIssueIdentifiers('feature/MKT-42-extra-7'))).toEqual(['MKT-42']);
  });
});
