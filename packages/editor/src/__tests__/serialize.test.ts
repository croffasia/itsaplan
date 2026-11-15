import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Editor, type JSONContent } from '@tiptap/core';
import { JSDOM } from 'jsdom';
import { Markdown } from 'tiptap-markdown';
import { documentExtensions } from '../document';

// The Markdown the web editor writes for a page: what the api, MCP and agents read.

const globals = ['window', 'document', 'navigator', 'Node', 'NodeFilter', 'HTMLElement'] as const;
const previous = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
beforeAll(() => {
  const { window } = new JSDOM('<!doctype html>');
  for (const name of globals)
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
});
afterAll(() => {
  globals.forEach((name, index) => {
    const descriptor = previous[index];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
});

function markdown(content: JSONContent): string {
  const editor = new Editor({
    extensions: [...documentExtensions(), Markdown.configure({ html: true })],
    content,
  });
  const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
  const result = storage.markdown.getMarkdown();
  editor.destroy();
  return result;
}

const paragraph = (content: JSONContent[], textAlign: string | null = null) => ({
  type: 'paragraph',
  attrs: { textAlign },
  content,
});
const cell = (type: string, align: string | null, content: JSONContent[]) => ({
  type,
  attrs: { align },
  content: [paragraph(content)],
});

describe('document Markdown', () => {
  it('keeps a mention that fills a table cell and the column alignment', () => {
    expect(
      markdown({
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  cell('tableHeader', 'left', [{ type: 'text', text: 'Who' }]),
                  cell('tableHeader', 'center', [{ type: 'text', text: 'Role' }]),
                  cell('tableHeader', null, [{ type: 'text', text: 'Note' }]),
                ],
              },
              {
                type: 'tableRow',
                content: [
                  cell('tableCell', 'left', [{ type: 'mention', attrs: { username: 'alice' } }]),
                  cell('tableCell', 'center', [{ type: 'text', text: 'owner' }]),
                  cell('tableCell', null, []),
                ],
              },
            ],
          },
        ],
      }),
    ).toBe('| Who | Role | Note |\n| :--- | :---: | --- |\n| @alice | owner |  |\n');
  });

  it('writes an aligned paragraph and heading as HTML and a plain one as Markdown', () => {
    expect(
      markdown({
        type: 'doc',
        content: [
          paragraph(
            [
              { type: 'text', text: 'Centered ' },
              { type: 'mention', attrs: { username: 'bob' } },
            ],
            'center',
          ),
          {
            type: 'heading',
            attrs: { level: 2, textAlign: 'right' },
            content: [{ type: 'text', text: 'Right' }],
          },
          paragraph([{ type: 'text', text: 'Plain', marks: [{ type: 'bold' }] }]),
        ],
      }),
    ).toBe(
      '<p style="text-align: center;">Centered <span data-mention="bob" class="mention">@bob</span></p>\n\n' +
        '<h2 style="text-align: right;">Right</h2>\n\n**Plain**',
    );
  });
});
