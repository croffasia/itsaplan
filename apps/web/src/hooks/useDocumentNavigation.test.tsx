import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import { useRecentDocuments } from './useDocumentNavigation';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => { mockReturnValue(value: unknown): { mockRestore(): void } };

const KEY = 'docs-nav:reader:DOC:recent';
const replacedGlobals = ['window', 'document', 'Event', 'IS_REACT_ACT_ENVIRONMENT'] as const;

let dom: JSDOM;
let root: Root;
let restoreSession: () => void;
let originals: Map<string, PropertyDescriptor | undefined>;
let recent: ReturnType<typeof useRecentDocuments>;

function Probe() {
  recent = useRecentDocuments('DOC');
  return null;
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    Event: { configurable: true, value: dom.window.Event },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: { user: { id: 'reader' } },
    isPending: false,
    error: null,
  });
  restoreSession = () => session.mockRestore();
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  restoreSession();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useRecentDocuments', () => {
  it('keeps the newest visit first with its time, in localStorage', async () => {
    await act(async () => root.render(<Probe />));
    await act(async () => recent.visit(1));
    await act(async () => recent.visit(2));
    await act(async () => recent.visit(1));

    assert.deepEqual(recent.ids, [1, 2]);
    assert.deepEqual(
      recent.visits.map((visit) => visit.id),
      [1, 2],
    );
    assert.ok(recent.visits.every((visit) => Date.now() - visit.at < 5_000));
    assert.deepEqual(JSON.parse(dom.window.localStorage.getItem(KEY)!).ids, [1, 2]);
  });

  it('reads a list stored without times and keeps its ids on the next visit', async () => {
    dom.window.localStorage.setItem(KEY, JSON.stringify({ ids: [5, 6] }));
    await act(async () => root.render(<Probe />));
    assert.deepEqual(recent.ids, [5, 6]);
    assert.equal(recent.visits.length, 0);

    await act(async () => recent.visit(6));
    assert.deepEqual(recent.ids, [6, 5]);
    assert.deepEqual(
      recent.visits.map((visit) => visit.id),
      [6],
    );
  });
});
