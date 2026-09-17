import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor } from '@tiptap/react';
import { JSDOM } from 'jsdom';
import { useEditorLinkPreview } from './useEditorLinkPreview';
import { previewableLink } from './previewableLink';

let dom: JSDOM;
let reactRoot: Root;
let editorRoot: HTMLElement;
let state: ReturnType<typeof useEditorLinkPreview>;
let originals: Map<string, PropertyDescriptor | undefined>;
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

function Harness({ editor }: { editor: Editor }) {
  state = useEditorLinkPreview(editor);
  return null;
}

beforeEach(async () => {
  dom = new JSDOM('<div id="react"></div><div id="editor"></div>', { url: 'https://planner.test' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    Node: dom.window.Node,
    PointerEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  editorRoot = dom.window.document.getElementById('editor')!;
  editorRoot.innerHTML =
    '<a href="https://example.com/a">A</a><a href="https://example.com/b">B</a>';
  reactRoot = createRoot(dom.window.document.getElementById('react')!);
  await act(() =>
    reactRoot.render(createElement(Harness, { editor: { view: { dom: editorRoot } } as Editor })),
  );
});

afterEach(async () => {
  await act(() => reactRoot.unmount());
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

async function point(link: Element, type: 'pointerover' | 'pointerout') {
  await act(() => {
    link.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true }));
  });
}

describe('editor link preview interaction', () => {
  it('keeps the outgoing anchor while every new link waits its full hover delay', async () => {
    const [first, second] = editorRoot.querySelectorAll('a');
    await point(first!, 'pointerover');
    await wait(670);
    assert.equal(state.open, true);
    await point(first!, 'pointerout');
    await point(second!, 'pointerover');
    assert.equal(state.anchor, first);
    assert.equal(state.candidateAnchor, second);
    assert.equal(state.open, false);
    await wait(500);
    assert.equal(state.anchor, first);
    assert.equal(state.open, false);
    const third = dom.window.document.createElement('a');
    third.href = 'https://example.com/c';
    editorRoot.append(third);
    await point(second!, 'pointerout');
    await point(third, 'pointerover');
    await wait(500);
    assert.equal(state.anchor, first);
    assert.equal(state.candidateAnchor, third);
    assert.equal(state.open, false);
    await wait(170);
    assert.equal(state.anchor, third);
    assert.equal(state.open, true);
    await point(third, 'pointerout');
    await wait(140);
    assert.equal(state.open, false);
  });
  it('waits for deliberate hover and can reopen after leaving before the delay', async () => {
    const link = editorRoot.querySelector('a')!;
    await point(link, 'pointerover');
    assert.equal(state.candidateAnchor, link);
    assert.equal(state.anchor, null);
    assert.equal(state.open, false);
    await point(link, 'pointerout');
    await wait(140);
    await point(link, 'pointerover');
    await wait(670);
    assert.equal(state.open, true);
    let parentEscapes = 0;
    const parentEscape = () => {
      parentEscapes += 1;
    };
    dom.window.addEventListener('keydown', parentEscape);
    await act(() => {
      dom.window.document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    assert.equal(state.open, false);
    assert.equal(parentEscapes, 0);
    dom.window.removeEventListener('keydown', parentEscape);
    await wait(180);
    assert.equal(state.anchor, null);
  });

  it('keeps the preview open when the pointer enters the card and cancels stale openings', async () => {
    const [first, second] = editorRoot.querySelectorAll('a');
    await point(first!, 'pointerover');
    await wait(400);
    await point(second!, 'pointerover');
    await wait(300);
    assert.equal(state.open, false);
    assert.equal(state.candidateAnchor, second);
    assert.equal(state.anchor, null);
    await wait(370);
    assert.equal(state.open, true);
    await point(second!, 'pointerout');
    await act(() => state.keepOpen());
    await wait(300);
    assert.equal(state.open, true);
  });

  it('accepts relative internal links and rejects unsafe, credential-bearing or download links', () => {
    editorRoot.innerHTML = '<a href="/project/EX">Project</a>';
    const internal = editorRoot.querySelector('a');
    assert.equal(previewableLink(internal, editorRoot), internal);
    for (const href of [
      'javascript:alert(1)',
      'mailto:test@example.com',
      'https://user:secret@example.com',
    ]) {
      editorRoot.innerHTML = `<a href="${href}">Link</a>`;
      assert.equal(previewableLink(editorRoot.querySelector('a'), editorRoot), null);
    }
    editorRoot.innerHTML = '<a href="https://example.com" download>File</a>';
    assert.equal(previewableLink(editorRoot.querySelector('a'), editorRoot), null);
  });
});
