import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useHistoryScrollRestoration } from './useHistoryScrollRestoration';

interface SavedScrollPosition {
  entryId: string;
  pathname: string;
  scrollTop: number;
}

interface TestHistoryState {
  __itsaplanScrollRestoration?: SavedScrollPosition;
}

interface ResizeObserverHarness {
  disconnected: boolean;
  trigger: () => void;
}

const parentPath = '/project/SCRL/issue/1';
const childPath = '/project/SCRL/issue/4';
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Event',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let maxScrollTop: number;
let resizeObservers: ResizeObserverHarness[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function ScrollContainer({ pathname }: { pathname: string }) {
  const restorationProps = useHistoryScrollRestoration({ pathname });

  return (
    <div data-testid="scroll-container" {...restorationProps}>
      <div>Content</div>
    </div>
  );
}

function currentPosition(): SavedScrollPosition {
  const state = window.history.state as TestHistoryState;
  assert.ok(state.__itsaplanScrollRestoration);
  return state.__itsaplanScrollRestoration;
}

function render(pathname: string): HTMLDivElement {
  act(() => root.render(<ScrollContainer pathname={pathname} />));
  const container = document.querySelector<HTMLDivElement>('[data-testid="scroll-container"]');
  assert.ok(container);
  return container;
}

function dispatch(container: HTMLDivElement, type: string) {
  act(() => container.dispatchEvent(new window.Event(type, { bubbles: true })));
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: `https://example.test${parentPath}`,
  });
  maxScrollTop = Number.POSITIVE_INFINITY;
  resizeObservers = [];

  const scrollPositions = new WeakMap<HTMLElement, number>();
  Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get() {
      return scrollPositions.get(this) ?? 0;
    },
    set(value: number) {
      scrollPositions.set(this, Math.min(value, maxScrollTop));
    },
  });

  class TestResizeObserver {
    private readonly harness: ResizeObserverHarness;

    constructor(callback: ResizeObserverCallback) {
      this.harness = {
        disconnected: false,
        trigger: () => callback([], this as unknown as ResizeObserver),
      };
      resizeObservers.push(this.harness);
    }

    observe() {}

    unobserve() {}

    disconnect() {
      this.harness.disconnected = true;
    }
  }

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Event: { configurable: true, value: dom.window.Event },
    ResizeObserver: { configurable: true, value: TestResizeObserver },
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    },
    cancelAnimationFrame: { configurable: true, value: () => undefined },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });

  const { createRoot } = await import('react-dom/client');
  const rootElement = document.querySelector('#root');
  assert.ok(rootElement);
  root = createRoot(rootElement);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useHistoryScrollRestoration', () => {
  it('restores the parent position from its browser history entry', () => {
    const container = render(parentPath);
    container.scrollTop = 1800;
    dispatch(container, 'scroll');
    dispatch(container, 'pointerdown');
    const parentState = window.history.state;

    act(() => {
      window.history.pushState({}, '', childPath);
      root.render(<ScrollContainer pathname={childPath} />);
    });
    assert.equal(container.scrollTop, 0);

    act(() => {
      window.history.replaceState(parentState, '', parentPath);
      root.render(<ScrollContainer pathname={parentPath} />);
    });
    assert.equal(container.scrollTop, 1800);
    assert.equal(currentPosition().scrollTop, 1800);
  });

  it('retries restoration as asynchronous content increases the scroll range', () => {
    window.history.replaceState(
      {
        __itsaplanScrollRestoration: {
          entryId: 'asynchronous-entry',
          pathname: parentPath,
          scrollTop: 1800,
        },
      },
      '',
      parentPath,
    );
    maxScrollTop = 300;

    const container = render(parentPath);
    assert.equal(container.scrollTop, 300);
    assert.equal(resizeObservers.length, 1);
    const [observer] = resizeObservers;
    assert.ok(observer);

    maxScrollTop = 1800;
    act(() => observer.trigger());
    assert.equal(container.scrollTop, 1800);
    assert.equal(observer.disconnected, true);
  });

  it('cancels a pending restoration when the user scrolls', () => {
    window.history.replaceState(
      {
        __itsaplanScrollRestoration: {
          entryId: 'interrupted-entry',
          pathname: parentPath,
          scrollTop: 1800,
        },
      },
      '',
      parentPath,
    );
    maxScrollTop = 300;

    const container = render(parentPath);
    const [observer] = resizeObservers;
    assert.ok(observer);
    maxScrollTop = 500;
    container.scrollTop = 450;
    dispatch(container, 'scroll');
    assert.equal(observer.disconnected, true);

    maxScrollTop = 1800;
    act(() => observer.trigger());
    assert.equal(container.scrollTop, 450);
  });

  it('does not let a delayed save overwrite a newer history entry', async () => {
    const container = render(parentPath);
    container.scrollTop = 700;
    dispatch(container, 'scroll');

    const childState = { childEntry: true };
    window.history.pushState(childState, '', childPath);

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.deepEqual(window.history.state, childState);
    assert.equal(window.location.pathname, childPath);
  });
});
