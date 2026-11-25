import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import common from '../../../messages/en/common.json';
import Markdown from './Markdown';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let copied: string[];
let originals: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  copied = [];
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    navigator: {
      configurable: true,
      value: {
        userAgent: '',
        clipboard: { writeText: async (text: string) => void copied.push(text) },
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function render(source: string, complete = true) {
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common }}>
        <QueryClientProvider client={new QueryClient()}>
          <Markdown complete={complete}>{source}</Markdown>
        </QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  );
  return Array.from(document.querySelector('.md-content')!.children);
}

describe('Markdown', () => {
  it('renders every block as a direct child of the content, with its attributes', async () => {
    const blocks = await render(
      '# Title\n\ntext\n\n- item\n\n> quote\n\n---\n\n3. third\n\n| a |\n|--:|\n| 1 |',
    );
    assert.deepEqual(
      blocks.map((block) => block.tagName),
      ['H1', 'P', 'UL', 'BLOCKQUOTE', 'HR', 'OL', 'DIV'],
    );
    assert.equal(blocks[5].getAttribute('start'), '3');
    assert.equal(blocks[6].className, 'tableWrapper');
    assert.equal(blocks[6].querySelector('td')!.getAttribute('align'), 'right');
  });

  it('marks a paragraph that is one bold line as a lead', async () => {
    const blocks = await render('**Open questions**\n\n**Tone.** An engineer talks.');
    assert.deepEqual(
      blocks.map((block) => block.className),
      ['md-lead', ''],
    );
  });

  it('waits for a streamed paragraph to end before it marks it as a lead', async () => {
    assert.equal((await render('**Tone.**', false))[0].className, '');
    assert.equal((await render('**Tone.**\n\ntext', false))[0].className, 'md-lead');
  });

  it('follows a streamed block that turns into another one', async () => {
    assert.equal((await render('3', false))[0].tagName, 'P');
    const [list] = await render('3. third', false);
    assert.equal(list.tagName, 'OL');
    assert.equal(list.getAttribute('start'), '3');
  });

  it('highlights a code fence and copies it without its last line break', async () => {
    const [block] = await render('```ts\nconst a = 1;\n```');
    assert.equal(block.querySelector('.hljs-keyword')!.textContent, 'const');
    assert.equal(block.querySelector('[data-code-bar]')!.textContent, 'ts');
    await act(async () => block.querySelector('button')!.click());
    assert.deepEqual(copied, ['const a = 1;']);
  });

  it('keeps the blocks direct children next to the link controls of a touch screen', async () => {
    dom.window.matchMedia = ((media: string) => ({
      media,
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof dom.window.matchMedia;
    const blocks = await render(
      '## Title\n\nRead [the guide](https://example.com/guide).\n\nhttps://example.com/other',
    );
    assert.deepEqual(
      blocks.map((block) => block.tagName),
      ['H2', 'P', 'SPAN', 'DIV'],
    );
    assert.ok(blocks[2].querySelector('[data-link-preview-control]'));
    assert.ok(blocks[3].querySelector('[data-link-original]'));
    assert.ok(blocks[3].querySelector('[data-link-row]'));
  });

  it('keeps raw HTML that React treats in its own way where it was written', async () => {
    const blocks = await render(
      'text\n\n<textarea>a</textarea>\n\n<menuitem>b</menuitem>\n\n<title>c</title>',
    );
    assert.equal(blocks.length, 4);
    assert.ok(blocks[1].querySelector('textarea'));
    assert.equal(blocks[2].textContent, 'b');
    assert.ok(blocks[3].querySelector('title'));
    assert.equal(document.head.querySelector('title'), null);
  });

  it('highlights a streamed code fence once it is written', async () => {
    const source = '```ts\nconst a = 1;\n```';
    const [writing] = await render(source, false);
    assert.equal(writing.querySelector('.hljs-keyword'), null);
    const [written] = await render(`${source}\n\nDone`, false);
    assert.ok(written.querySelector('.hljs-keyword'));
  });

  it('shows a code fence of an unknown language as written', async () => {
    const [block] = await render('```nolang\na < b\n```');
    assert.equal(block.querySelector('pre')!.textContent, 'a < b');
  });
});
