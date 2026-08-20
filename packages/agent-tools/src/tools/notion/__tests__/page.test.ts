import { describe, it, expect } from 'bun:test';
import { fromRichText, pageProperties, pageTitle, titleProperty } from '../page';
import { notionId } from '../client';
import { cut } from '../read-page';

describe('notion page', () => {
  it('renders rich text annotations and links as markdown', () => {
    const items = [
      { plain_text: 'plain ' },
      { plain_text: 'bold', annotations: { bold: true } },
      { plain_text: ' and a ' },
      { plain_text: 'link', href: 'https://example.com' },
    ];
    expect(fromRichText(items)).toBe('plain **bold** and a [link](https://example.com)');
  });

  it('reads the title whatever the property is named', () => {
    const page = {
      properties: {
        Done: { type: 'checkbox', checkbox: true },
        Name: { type: 'title', title: [{ plain_text: 'Roadmap' }] },
      },
    };
    expect(pageTitle(page)).toBe('Roadmap');
  });

  it('writes a title under the id every title property carries', () => {
    expect(titleProperty('Roadmap')).toEqual({
      title: { title: [{ type: 'text', text: { content: 'Roadmap' } }] },
    });
  });

  it('flattens properties to plain values', () => {
    const page = {
      properties: {
        Status: { type: 'status', status: { name: 'In progress' } },
        Tags: { type: 'multi_select', multi_select: [{ name: 'api' }, { name: 'docs' }] },
        Key: { type: 'unique_id', unique_id: { prefix: 'ISAP', number: 306 } },
        Estimate: { type: 'formula', formula: { type: 'number', number: 3 } },
        Owner: { type: 'people', people: [{ name: 'Ann' }] },
        Cover: { type: 'files', files: [] },
      },
    };
    expect(pageProperties(page)).toEqual({
      Status: 'In progress',
      Tags: ['api', 'docs'],
      Key: 'ISAP-306',
      Estimate: 3,
      Owner: ['Ann'],
      Cover: null,
    });
  });

  it('cuts an oversized body at a line break and leaves a short one alone', () => {
    const short = 'line one\nline two';
    expect(cut(short)).toBe(short);

    const long = `${'x'.repeat(59_000)}\n${'y'.repeat(5_000)}`;
    expect(cut(long)).toBe('x'.repeat(59_000));

    const unbroken = 'z'.repeat(70_000);
    expect(cut(unbroken)).toHaveLength(60_000);
  });

  it('takes an id from a page URL, a dashed id, or a bare id', () => {
    const id = '1a2b3c4d5e6f7081920a1b2c3d4e5f60';
    expect(notionId(`https://www.notion.so/Some-Page-${id}`)).toBe(id);
    expect(notionId('1a2b3c4d-5e6f-7081-920a-1b2c3d4e5f60')).toBe(id);
    expect(notionId(id)).toBe(id);
    expect(() => notionId('a page')).toThrow('not a Notion page id or URL');
  });
});
