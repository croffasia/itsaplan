import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useColumnSearchState } from './useColumnSearchState';
import { readColumnSearchHistory } from '../utils/columnSearchHistory';

let dom: JSDOM;
let root: Root;
let search: ReturnType<typeof useColumnSearchState>;
let fine = true;
let originals: Map<string, PropertyDescriptor | undefined>;
const pathname = '/project/TEST';

function Probe({ scope = 'viewer:TEST:status' }: { scope?: string }) {
  search = useColumnSearchState(scope, pathname);
  return (
    <div ref={search.boardRef}>
      <button
        ref={(element) => {
          if (element) search.entryRefs.current.set('c1', element);
        }}
      >
        Search
      </button>
      <div
        ref={(element) => {
          if (element) search.columnRefs.current.set('c1', element);
        }}
      />
    </div>
  );
}

beforeEach(async () => {
  originals = new Map(
    [
      'window',
      'document',
      'navigator',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'IS_REACT_ACT_ENVIRONMENT',
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: `https://planner.test${pathname}`,
    pretendToBeVisual: true,
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    },
    cancelAnimationFrame: { configurable: true, value: clearTimeout },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  fine = true;
  window.matchMedia = (() => ({ matches: fine })) as unknown as typeof window.matchMedia;
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const frame = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

describe('column search visit state', () => {
  it('freezes input mode while open and restores drafts and result position on reopen', async () => {
    search.boardRef.current!.scrollLeft = 440;
    search.columnRefs.current.get('c1')!.scrollTop = 820;
    act(() => search.open('c1'));
    assert.equal(search.active?.mode, 'inline');
    act(() => search.changeQuery('needle'));
    search.draft.scrollTop = 1_234;
    fine = false;
    act(() => root.render(<Probe />));
    assert.equal(search.active?.mode, 'inline');
    act(() => search.close());
    await frame();
    assert.equal(search.active, null);
    assert.equal(search.boardRef.current!.scrollLeft, 440);
    assert.equal(search.columnRefs.current.get('c1')!.scrollTop, 820);
    assert.equal(document.activeElement, search.entryRefs.current.get('c1'));
    act(() => search.open('c1'));
    assert.equal((search.active as { mode: string } | null)?.mode, 'modal');
    assert.equal(search.query, 'needle');
    assert.equal(search.draft.scrollTop, 1_234);
  });

  it('keeps composition draft separate from committed results and clears only its query', () => {
    act(() => search.open('c1'));
    act(() => search.changeQuery('old'));
    search.draft.scrollTop = 300;
    act(() => search.changeQuery('日本', false));
    assert.equal(search.query, '日本');
    assert.equal(search.matchQuery, 'old');
    assert.equal(search.draft.scrollTop, 300);
    act(() => search.changeQuery('日本'));
    assert.equal(search.matchQuery, '日本');
    assert.equal(search.draft.scrollTop, 0);
    act(() => search.changeQuery(''));
    assert.equal(search.active?.key, 'c1');
    assert.equal(search.matchQuery, '');
  });

  it('isolates group drafts and ends the visit when the viewer or grouping changes', () => {
    act(() => search.open('c1'));
    act(() => search.changeQuery('first column'));
    act(() => search.open('c2'));
    assert.equal(search.query, '');
    act(() => search.changeQuery('second column'));
    act(() => search.open('c1'));
    assert.equal(search.query, 'first column');
    act(() => root.render(<Probe scope="other-viewer:TEST:assignee" />));
    assert.equal(search.active, null);
    act(() => search.open('c1'));
    assert.equal(search.query, '');
  });

  it('keeps the board at the newly opened column when switching search scopes', async () => {
    search.boardRef.current!.scrollLeft = 0;
    search.columnRefs.current.get('c1')!.scrollTop = 820;
    act(() => search.open('c1'));
    search.boardRef.current!.scrollLeft = 1_024;
    search.columnRefs.current.get('c1')!.hidden = true;
    search.columnRefs.current.get('c1')!.scrollTop = 0;
    act(() => search.open('c4'));
    await frame();
    assert.equal(search.active?.key, 'c4');
    assert.equal(search.boardRef.current!.scrollLeft, 1_024);
    assert.equal(search.columnRefs.current.get('c1')!.scrollTop, 820);
  });

  it('restores a captured page origin without replacing router state', () => {
    window.history.replaceState({ ...window.history.state, __NA: true, tree: ['router'] }, '');
    act(() => search.open('c1'));
    act(() => search.changeQuery('return query'));
    search.draft.scrollTop = 900;
    search.draft.focusedId = 3053;
    search.capture();
    assert.equal(window.history.state.__NA, true);
    assert.deepEqual(window.history.state.tree, ['router']);
    act(() => root.render(null));
    act(() => root.render(<Probe />));
    assert.equal(search.active?.key, 'c1');
    assert.equal(search.query, 'return query');
    assert.equal(search.draft.scrollTop, 900);
    assert.equal(search.draft.focusedId, 3053);
    assert.equal(
      readColumnSearchHistory(
        window.history.state,
        'viewer:TEST:status',
        pathname,
        performance.timeOrigin + 1,
      ),
      null,
    );
  });

  it('rejects late origin writes after navigation and after another board mount takes ownership', () => {
    act(() => search.open('c1'));
    act(() => search.changeQuery('origin'));
    const stale = search.capture;
    window.history.pushState({ __NA: true }, '', '/project/TEST/issue/1');
    stale();
    assert.deepEqual(window.history.state, { __NA: true });
    window.history.back();
    window.history.replaceState({}, '', pathname);
    act(() => root.render(null));
    act(() => root.render(<Probe />));
    const siblingState = window.history.state;
    stale();
    assert.deepEqual(window.history.state, siblingState);
  });
});
