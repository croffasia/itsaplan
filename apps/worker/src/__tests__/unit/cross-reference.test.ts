import { describe, it, expect } from 'bun:test';
import { extractCrossReferences, applyCrossReferenceReplacements } from '../../cross-reference';

describe('extractCrossReferences', () => {
  it('finds a plain mention', () => {
    expect(extractCrossReferences('see ROOMS-524 for details', 'ROOMS')).toEqual([
      { reference: 'ROOMS-524', sequenceId: '524' },
    ]);
  });

  it('finds several distinct mentions, first-seen order', () => {
    expect(extractCrossReferences('ROOMS-2 blocks ROOMS-1, see also ROOMS-2', 'ROOMS')).toEqual([
      { reference: 'ROOMS-2', sequenceId: '2' },
      { reference: 'ROOMS-1', sequenceId: '1' },
    ]);
  });

  it('does not match a prefix or suffix that breaks the word boundary', () => {
    expect(extractCrossReferences('XROOMS-524 and ROOMS-524X', 'ROOMS')).toEqual([]);
  });

  it('does not match a different project key', () => {
    expect(extractCrossReferences('see OTHER-524', 'ROOMS')).toEqual([]);
  });

  it('is case-sensitive, matching Plane identifiers verbatim', () => {
    expect(extractCrossReferences('see rooms-524', 'ROOMS')).toEqual([]);
  });

  it('finds nothing in text with no mention', () => {
    expect(extractCrossReferences('no references here', 'ROOMS')).toEqual([]);
  });
});

describe('applyCrossReferenceReplacements', () => {
  it('substitutes a resolved mention', () => {
    const replacements = new Map([['ROOMS-524', 'MKT-9']]);
    expect(applyCrossReferenceReplacements('see ROOMS-524', 'ROOMS', replacements)).toBe(
      'see MKT-9',
    );
  });

  it('leaves an unresolved mention exactly as-is', () => {
    const replacements = new Map<string, string>();
    expect(applyCrossReferenceReplacements('see ROOMS-524', 'ROOMS', replacements)).toBe(
      'see ROOMS-524',
    );
  });

  it('replaces every occurrence of a repeated mention', () => {
    const replacements = new Map([['ROOMS-524', 'MKT-9']]);
    expect(
      applyCrossReferenceReplacements('ROOMS-524 duplicates ROOMS-524', 'ROOMS', replacements),
    ).toBe('MKT-9 duplicates MKT-9');
  });

  it('resolves one mention and leaves another unresolved in the same text', () => {
    const replacements = new Map([['ROOMS-1', 'MKT-1']]);
    expect(applyCrossReferenceReplacements('ROOMS-1 and ROOMS-2', 'ROOMS', replacements)).toBe(
      'MKT-1 and ROOMS-2',
    );
  });
});
