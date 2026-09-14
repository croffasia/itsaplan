import { describe, expect, it } from 'bun:test';
import { noteSlug, renderNote } from '../../obsidian';

describe('noteSlug', () => {
  it('keeps letters, digits and light punctuation', () => {
    expect(noteSlug("Winter upsell (v2) for 187N's leads")).toBe(
      "Winter upsell (v2) for 187N's leads",
    );
  });

  it('strips path separators and the leading dots of a traversal', () => {
    expect(noteSlug('../../etc/passwd')).toBe('.. etc passwd');
    expect(noteSlug('a/b\\c')).toBe('a b c');
  });

  it('never returns a dotfile or an empty name', () => {
    expect(noteSlug('...')).toBe('Untitled dump');
    expect(noteSlug('   ')).toBe('Untitled dump');
    expect(noteSlug('***')).toBe('Untitled dump');
  });

  it('collapses whitespace and caps the length', () => {
    expect(noteSlug('a\t\t  b')).toBe('a b');
    expect(noteSlug('x'.repeat(200))).toHaveLength(80);
  });

  it('drops characters that are special to a filesystem or to Obsidian', () => {
    expect(noteSlug('report: q1 *draft* #2 [x] | <y>')).toBe('report q1 draft 2 x y');
  });
});

describe('renderNote', () => {
  const base = {
    title: 'Renegotiate the financier',
    body: 'Proposal: 30% interest cap, no prepay penalty.',
    kind: 'idea',
    tags: ['finance'],
    createdAt: '2026-09-09T08:47:00.000Z',
    author: 'Danil',
  };

  it('writes frontmatter and the body under a heading', () => {
    const note = renderNote(base);
    expect(note).toStartWith('---\n');
    expect(note).toContain('title: "Renegotiate the financier"');
    expect(note).toContain('kind: idea');
    expect(note).toContain('created: 2026-09-09T08:47:00.000Z');
    expect(note).toContain('source: braindump');
    expect(note).toContain('author: "Danil"');
    expect(note).toContain('  - "finance"');
    expect(note).toContain('# Renegotiate the financier');
    expect(note).toContain('Proposal: 30% interest cap, no prepay penalty.');
  });

  it('quotes a title that would otherwise break the frontmatter', () => {
    const note = renderNote({ ...base, title: 'a: b "c"\nd' });
    expect(note).toContain('title: "a: b \\"c\\"\\nd"');
  });

  it('omits the author and the tag list when there are none', () => {
    const note = renderNote({ ...base, author: null, tags: [] });
    expect(note).not.toContain('author:');
    expect(note).not.toContain('tags:');
  });
});
