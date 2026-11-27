import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useEditorKey } from './useEditorKey';

const replacedGlobals = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'] as const;
let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let editorKey: ReturnType<typeof useEditorKey>;

function Probe({ stored }: { stored: string | undefined }) {
  editorKey = useEditorKey(stored);
  return null;
}

const render = (stored: string | undefined) => act(() => root.render(<Probe stored={stored} />));

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  const element = document.querySelector('#root');
  assert.ok(element);
  root = createRoot(element);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useEditorKey', () => {
  it('keeps the key for text the editor saved and changes it for text from elsewhere', () => {
    render('first');
    const mounted = editorKey.key;

    act(() => editorKey.saved('typed'));
    render('typed');
    assert.equal(editorKey.key, mounted);

    render('from someone else');
    assert.notEqual(editorKey.key, mounted);
  });
});
