import { describe, expect, it } from 'bun:test';
import { TITLE_MAX, deriveTitle } from '../../title';

describe('deriveTitle', () => {
  it('keeps a short line as it is', () => {
    expect(deriveTitle('Winter upsell to warm leads')).toBe('Winter upsell to warm leads');
  });

  it('takes the first sentence out of a run of text', () => {
    expect(deriveTitle('Call Maxim tomorrow. Do not forget the boundaries discussion.')).toBe(
      'Call Maxim tomorrow',
    );
  });

  it('takes the first non-empty line', () => {
    expect(deriveTitle('\n\n  Tone is too clinical\nJoep asked for warmer copy.')).toBe(
      'Tone is too clinical',
    );
  });

  it('cuts a long sentence back to a word boundary', () => {
    const title = deriveTitle(
      'We should renegotiate the current financier before the summer cohort starts so the terms hold',
    );
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX + 1);
    expect(title).toEndWith('…');
    // Cut between words, not mid-word.
    expect(title.slice(0, -1)).not.toEndWith(' ');
    expect(title).toStartWith('We should renegotiate the current financier');
  });

  it('cuts a run of text with no spaces at all', () => {
    const title = deriveTitle('x'.repeat(200));
    expect(title).toHaveLength(TITLE_MAX + 1);
    expect(title).toEndWith('…');
  });

  it('collapses whitespace and drops trailing punctuation', () => {
    expect(deriveTitle('Approve   the\tbudget shift,')).toBe('Approve the budget shift');
  });

  it('falls back to a fixed name when there is nothing to read', () => {
    expect(deriveTitle('')).toBe('Untitled dump');
    expect(deriveTitle('   \n  ')).toBe('Untitled dump');
  });
});
