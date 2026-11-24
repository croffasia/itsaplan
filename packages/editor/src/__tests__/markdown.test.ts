import { describe, it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { markdownToDocumentJson } from '../markdown';

// The expected JSON is what the web editor builds from the same Markdown
// (importedMarkdownJson), so a page written through the API opens as one typed in.

const p = (content: unknown[], textAlign: string | null = null) => ({
  type: 'paragraph',
  attrs: { blockId: null, textAlign },
  content,
});
const text = (value: string, marks?: unknown[]) =>
  marks ? { type: 'text', marks, text: value } : { type: 'text', text: value };
const link = (href: string, title: string | null = null) => ({
  type: 'link',
  attrs: {
    href,
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
    class: 'cursor-pointer',
    title,
  },
});
const mention = (username: string, marks?: unknown[]) => ({
  type: 'mention',
  attrs: { username },
  ...(marks ? { marks } : {}),
});
const image = (src: string, attrs: Record<string, unknown> = {}) => ({
  type: 'image',
  attrs: { blockId: null, src, alt: null, title: null, width: null, style: null, ...attrs },
});
const cell = (type: string, align: string, content: unknown[]) => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align },
  content: [p(content)],
});
const { window } = new JSDOM('');
const json = (markdown: string) =>
  JSON.parse(JSON.stringify(markdownToDocumentJson(markdown, window)));

describe('markdownToDocumentJson', () => {
  it('keeps safe links and leaves an unsafe one as text', () => {
    expect(
      json(
        '[link](https://example.com "T") [bad](javascript:alert(1)) [rel](/p/x) <mailto:a@b.co>',
      ),
    ).toEqual({
      type: 'doc',
      content: [
        p([
          text('link', [link('https://example.com', 'T')]),
          text(' [bad](javascript:alert(1)) '),
          text('rel', [link('/p/x')]),
          text(' '),
          text('mailto:a@b.co', [link('mailto:a@b.co')]),
        ]),
      ],
    });
  });

  it('reads @handles as mentions outside code, links and email addresses', () => {
    expect(
      json(
        'Hi @alice and @bob.smith, mail a@b.com, @@double, `@code`, [@link](https://x.y), **@bold** and @trailing-',
      ),
    ).toEqual({
      type: 'doc',
      content: [
        p([
          text('Hi '),
          mention('alice'),
          text(' and '),
          mention('bob.smith'),
          text(', mail '),
          text('a@b.com', [link('mailto:a@b.com')]),
          text(', @@double, '),
          text('@code', [{ type: 'code' }]),
          text(', '),
          text('@link', [link('https://x.y')]),
          text(', '),
          mention('bold', [{ type: 'bold' }]),
          text(' and '),
          mention('trailing'),
          text('-'),
        ]),
      ],
    });
  });

  it('reads images, raw image sizing and an image inside a paragraph', () => {
    expect(
      json(
        '![alt text](https://img.example.com/a.png "Title")\n\n' +
          '<img src="https://img.example.com/b.png" alt="b" width="320" style="max-width: 50%">\n\n' +
          'text before <img src="https://img.example.com/c.png"> text after',
      ),
    ).toEqual({
      type: 'doc',
      content: [
        image('https://img.example.com/a.png', { alt: 'alt text', title: 'Title' }),
        image('https://img.example.com/b.png', { alt: 'b', width: 320, style: 'max-width: 50%' }),
        p([text('text before')]),
        image('https://img.example.com/c.png'),
        p([text('text after')]),
      ],
    });
  });

  it('reads the raw HTML the editor writes for colors and alignment', () => {
    expect(
      json(
        '<u>under</u> <mark data-color="#ffff00">hi</mark> <span style="color: #ff0000">red</span>\n\n' +
          '<p style="text-align: center">centered</p>\n\n<h2 style="text-align: right">right</h2>',
      ),
    ).toEqual({
      type: 'doc',
      content: [
        p([
          text('under', [{ type: 'underline' }]),
          text(' '),
          text('hi', [{ type: 'highlight', attrs: { color: '#ffff00' } }]),
          text(' '),
          text('red', [{ type: 'textStyle', attrs: { color: '#ff0000' } }]),
        ]),
        p([text('centered')], 'center'),
        {
          type: 'heading',
          attrs: { blockId: null, textAlign: 'right', level: 2 },
          content: [text('right')],
        },
      ],
    });
  });

  it('reads task lists, tables and code blocks', () => {
    expect(
      json(
        '- [ ] open\n- [x] done\n\n| h1 | h2 |\n| :--- | ---: |\n| a \\| b | **b** |\n\n```ts\nconst a = 1;\n```',
      ),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          attrs: { blockId: null },
          content: [
            { type: 'taskItem', attrs: { checked: false }, content: [p([text('open')])] },
            { type: 'taskItem', attrs: { checked: true }, content: [p([text('done')])] },
          ],
        },
        {
          type: 'table',
          attrs: { blockId: null },
          content: [
            {
              type: 'tableRow',
              content: [
                cell('tableHeader', 'left', [text('h1')]),
                cell('tableHeader', 'right', [text('h2')]),
              ],
            },
            {
              type: 'tableRow',
              content: [
                cell('tableCell', 'left', [text('a | b')]),
                cell('tableCell', 'right', [text('b', [{ type: 'bold' }])]),
              ],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { blockId: null, language: 'ts' },
          content: [text('const a = 1;')],
        },
      ],
    });
  });

  it('drops what a page cannot hold and keeps the text around it', () => {
    expect(
      json(
        '<span style="color: rgb(255, 0, 0);">red</span> <span style="color: red">named</span> <mark>plain</mark>\n\n' +
          '![relative](/media/x.png)\n\n' +
          '<p style="text-align: justify" data-block-id="bad id!">justified</p>\n\n' +
          '<a href="https://x.y" target="_top" class="a$b" rel="evil()">link</a> <span data-mention="bad handle!"></span>end',
      ),
    ).toEqual({
      type: 'doc',
      content: [
        p([
          text('red', [{ type: 'textStyle', attrs: { color: '#ff0000' } }]),
          text(' '),
          text('named', [{ type: 'textStyle', attrs: { color: null } }]),
          text(' '),
          text('plain', [{ type: 'highlight', attrs: { color: null } }]),
        ]),
        p([text('justified')]),
        p([text('link', [link('https://x.y')]), text(' end')]),
      ],
    });
  });

  it('splits a list that mixes tasks and plain items, and drops the numbers of a task list', () => {
    const task = (checked: boolean, value: string) => ({
      type: 'taskItem',
      attrs: { checked },
      content: [p([text(value)])],
    });
    expect(json('- plain note\n- [ ] task\n\n1. [ ] first\n2. [x] second')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          attrs: { blockId: null, tight: true },
          content: [{ type: 'listItem', content: [p([text('plain note')])] }],
        },
        { type: 'taskList', attrs: { blockId: null }, content: [task(false, 'task')] },
        {
          type: 'taskList',
          attrs: { blockId: null },
          content: [task(false, 'first'), task(true, 'second')],
        },
      ],
    });
    expect(json('3. three\n4. [ ] four\n5. five')).toMatchObject({
      content: [
        { type: 'orderedList', attrs: { start: 3 } },
        { type: 'taskList' },
        { type: 'orderedList', attrs: { start: 5 }, content: [{ content: [p([text('five')])] }] },
      ],
    });
  });
});
