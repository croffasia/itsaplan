import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor, type JSONContent } from '@tiptap/core';
import { JSDOM } from 'jsdom';
import { documentEditorExtensions } from '../components/DocumentMarkdownEditor';
import {
  LOCKED_LINK_CLASS,
  parsePageParam,
  rewriteSharedLinks,
  sharedIssueHref,
  sharedLinkTarget,
  sharedPageHref,
  sharedPageOf,
} from './sharedLinks';

const origin = 'https://pm.example.test';
const pageIds = new Set([10, 11, 12]);

describe('sharedLinkTarget', () => {
  it('opens a shared page under the share, absolute or relative', () => {
    assert.deepEqual(sharedLinkTarget(`${origin}/team/PG/docs/11`, origin, pageIds), {
      pageId: 11,
    });
    assert.deepEqual(sharedLinkTarget('/team/PG/docs/12/', origin, pageIds), { pageId: 12 });
    assert.deepEqual(sharedLinkTarget('/team/PG/docs/12#block-1', origin, pageIds), {
      pageId: 12,
    });
  });

  it('locks app links the share does not open', () => {
    assert.equal(sharedLinkTarget(`${origin}/team/PG/docs/99`, origin, pageIds), 'locked');
    assert.equal(sharedLinkTarget('/team/issue/PG-1', origin, pageIds), 'locked');
    assert.equal(sharedLinkTarget('/team/PG/docs/11/history', origin, pageIds), 'locked');
  });

  it('leaves external, public and in-page links as they are', () => {
    assert.equal(sharedLinkTarget('https://example.com/team/PG/docs/11', origin, pageIds), null);
    assert.equal(sharedLinkTarget('/share/document/abc', origin, pageIds), null);
    assert.equal(sharedLinkTarget('/media/share/document/abc/assets/x/raw', origin, pageIds), null);
    assert.equal(sharedLinkTarget('mailto:team@example.com', origin, pageIds), null);
  });
});

describe('share page addresses', () => {
  it('gives the shared page the share link and a subpage its ?page', () => {
    assert.equal(sharedPageHref('tok', 10, 10), '/share/document/tok');
    assert.equal(sharedPageHref('tok', 11, 10), '/share/document/tok?page=11');
  });

  it('reads the page back from an address of the same share only', () => {
    assert.equal(sharedPageOf(`${origin}/share/document/tok?page=11`, origin, 'tok'), 11);
    assert.equal(sharedPageOf(`${origin}/share/document/tok`, origin, 'tok'), null);
    assert.equal(sharedPageOf(`${origin}/share/document/other?page=11`, origin, 'tok'), undefined);
    assert.equal(sharedPageOf('https://example.com/share/document/tok', origin, 'tok'), undefined);
  });

  it('adds the open issue to the page address', () => {
    assert.equal(sharedIssueHref('tok', 10, 10, 5), '/share/document/tok?issue=5');
    assert.equal(sharedIssueHref('tok', 11, 10, 5), '/share/document/tok?page=11&issue=5');
  });

  it('accepts only a positive page id', () => {
    assert.equal(parsePageParam('11'), 11);
    for (const value of [null, '', '0', '-1', '1e3', '11abc']) {
      assert.equal(parsePageParam(value), null);
    }
  });
});

describe('rewriteSharedLinks', () => {
  let dom: JSDOM;
  const globals = ['window', 'document', 'navigator', 'Node'] as const;
  const previous = new Map<string, PropertyDescriptor | undefined>();

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="editor"></div>');
    for (const name of globals) {
      previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: name === 'window' ? dom.window : dom.window[name],
      });
    }
  });

  afterEach(() => {
    dom.window.close();
    for (const name of globals) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });

  const linked = (text: string, href: string): JSONContent => ({
    type: 'text',
    text,
    marks: [{ type: 'link', attrs: { href } }],
  });

  it('points shared pages at the share and marks the rest as locked', () => {
    const editor = new Editor({
      element: document.getElementById('editor')!,
      editable: false,
      extensions: documentEditorExtensions({ placeholder: '', codeBlockLabel: '', tableLabel: '' }),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              linked('sub', `${origin}/team/PG/docs/11`),
              { type: 'text', text: ' ' },
              linked('root', '/team/PG/docs/10'),
              { type: 'text', text: ' ' },
              linked('other', `${origin}/team/PG/docs/99`),
              { type: 'text', text: ' ' },
              linked('web', 'https://example.com/'),
            ],
          },
        ],
      },
    });
    rewriteSharedLinks(editor, { token: 'tok', origin, rootId: 10, pageIds }, 'Locked');

    const links = [...editor.view.dom.querySelectorAll('a')].map((a) => ({
      text: a.textContent,
      href: a.getAttribute('href'),
      class: a.getAttribute('class'),
      title: a.getAttribute('title'),
    }));
    assert.deepEqual(
      links.map(({ text, href }) => [text, href]),
      [
        ['sub', '/share/document/tok?page=11'],
        ['root', '/share/document/tok'],
        ['other', `${origin}/team/PG/docs/99`],
        ['web', 'https://example.com/'],
      ],
    );
    assert.ok(links[2].class?.split(' ').includes(LOCKED_LINK_CLASS));
    assert.equal(links[2].title, 'Locked');
    assert.ok(!links[3].class?.split(' ').includes(LOCKED_LINK_CLASS));
    editor.destroy();
  });
});
