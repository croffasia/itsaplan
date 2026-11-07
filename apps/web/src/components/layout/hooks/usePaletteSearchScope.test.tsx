import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { usePaletteSearchScope } from './usePaletteSearchScope';

const STORAGE_KEY = 'command-palette:search-scope';
const replaced = ['window', 'document', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'];

let dom: JSDOM;
let root: Root;
let result: ReturnType<typeof usePaletteSearchScope>;
let descriptors: Map<string, PropertyDescriptor | undefined>;

function Harness() {
  result = usePaletteSearchScope();
  return null;
}

async function render() {
  await act(async () => root.render(<Harness />));
}

beforeEach(async () => {
  descriptors = new Map(
    replaced.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    localStorage: { configurable: true, value: dom.window.localStorage },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

it('searches all projects until the browser stored a choice', async () => {
  await render();
  assert.equal(result.scope, 'all');
});

it('reads the stored choice and falls back to all projects for an unknown value', async () => {
  localStorage.setItem(STORAGE_KEY, 'current');
  await render();
  assert.equal(result.scope, 'current');

  act(() => root.unmount());
  localStorage.setItem(STORAGE_KEY, 'legacy');
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  await render();
  assert.equal(result.scope, 'all');
});

it('stores a new choice', async () => {
  await render();
  await act(async () => result.setScope('current'));
  assert.equal(result.scope, 'current');
  assert.equal(localStorage.getItem(STORAGE_KEY), 'current');
});

it('still switches when browser storage is unavailable', async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError');
    },
  });
  await render();
  assert.equal(result.scope, 'all');
  await act(async () => result.setScope('current'));
  assert.equal(result.scope, 'current');
});
