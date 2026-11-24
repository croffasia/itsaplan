import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useSidePanel } from './useSidePanel';

const OPEN_KEY = 'aiChat:panel:open:eng.RUN';
const replacedGlobals = ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let panel: ReturnType<typeof useSidePanel>;

function Probe({ showChatByDefault }: { showChatByDefault: boolean }) {
  panel = useSidePanel('eng.RUN', showChatByDefault);
  return null;
}

const render = (showChatByDefault = false) =>
  act(async () => root.render(<Probe showChatByDefault={showChatByDefault} />));

async function visitAgain(showChatByDefault = false) {
  await act(async () => root.render(null));
  await render(showChatByDefault);
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    localStorage: { configurable: true, value: dom.window.localStorage },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
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

describe('useSidePanel', () => {
  it('reopens the chat a device stored before the panel had tabs', async () => {
    localStorage.setItem(OPEN_KEY, 'open');
    await render();
    assert.deepEqual([panel.open, panel.tab], [true, 'chat']);
  });

  it('keeps the tab of a closed panel across visits', async () => {
    await render();
    assert.equal(panel.open, false);
    await act(async () => panel.show('runs'));
    assert.deepEqual([panel.open, panel.tab], [true, 'runs']);
    await act(async () => panel.close());
    await visitAgain();
    assert.deepEqual([panel.open, panel.tab], [false, 'runs']);
  });

  it('opens the chat by default only where the panel was never opened or closed', async () => {
    await render(true);
    assert.deepEqual([panel.open, panel.tab], [true, 'chat']);
    await act(async () => panel.close());
    await visitAgain(true);
    assert.equal(panel.open, false);
  });
});
