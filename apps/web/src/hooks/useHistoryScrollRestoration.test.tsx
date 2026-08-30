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
  anchor?: {
    key: string;
    offsetTop: number;
  };
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
  'Element',
  'HTMLElement',
  'Event',
  'MouseEvent',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let maxScrollTop: number;
let anchorContentTop: number;
let resizeObservers: ResizeObserverHarness[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function ScrollContainer({
  pathname,
  anchorKey = 'subtask:4',
}: {
  pathname: string;
  anchorKey?: string | null;
}) {
  const restorationProps = useHistoryScrollRestoration({ pathname });

  return (
    <div data-testid="scroll-container" {...restorationProps}>
      <div>
        Content
        {anchorKey && (
          <button type="button" data-history-scroll-restoration-anchor={anchorKey}>
            Subtask
          </button>
        )}
      </div>
    </div>
  );
}

function currentPosition(): SavedScrollPosition {
  const state = window.history.state as TestHistoryState;
  assert.ok(state.__itsaplanScrollRestoration);
  return state.__itsaplanScrollRestoration;
}

function render(pathname: string, anchorKey?: string | null): HTMLDivElement {
  act(() => root.render(<ScrollContainer pathname={pathname} anchorKey={anchorKey} />));
  const container = document.querySelector<HTMLDivElement>('[data-testid="scroll-container"]');
  assert.ok(container);
  return container;
}

function dispatch(target: HTMLElement, type: string) {
  act(() => target.dispatchEvent(new window.Event(type, { bubbles: true })));
}

function click(target: HTMLElement) {
  act(() => target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 })));
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: `https://example.test${parentPath}`,
  });
  maxScrollTop = Number.POSITIVE_INFINITY;
  anchorContentTop = 2100;
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
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      if (this.dataset.testid === 'scroll-container') {
        return new dom.window.DOMRect(0, 100, 800, 600);
      }
      if (this.dataset.historyScrollRestorationAnchor) {
        const container = this.closest<HTMLElement>('[data-testid="scroll-container"]');
        return new dom.window.DOMRect(
          0,
          100 + anchorContentTop - (container?.scrollTop ?? 0),
          400,
          24,
        );
      }
      return new dom.window.DOMRect();
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
    Element: { configurable: true, value: dom.window.Element },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Event: { configurable: true, value: dom.window.Event },
    MouseEvent: { configurable: true, value: dom.window.MouseEvent },
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

  it('keeps the activated anchor in place while content above it changes height', () => {
    const container = render(parentPath);
    const anchor = container.querySelector<HTMLElement>(
      '[data-history-scroll-restoration-anchor="subtask:4"]',
    );
    assert.ok(anchor);

    container.scrollTop = 1800;
    dispatch(container, 'scroll');
    dispatch(anchor, 'pointerdown');
    const parentState = window.history.state;
    assert.deepEqual(currentPosition().anchor, { key: 'subtask:4', offsetTop: 300 });

    act(() => {
      window.history.pushState({}, '', childPath);
      root.render(<ScrollContainer pathname={childPath} />);
    });
    act(() => {
      window.history.replaceState(parentState, '', parentPath);
      root.render(<ScrollContainer pathname={parentPath} />);
    });
    assert.equal(container.scrollTop, 1800);

    anchorContentTop += 80;
    const observer = resizeObservers.at(-1);
    assert.ok(observer);
    act(() => observer.trigger());

    assert.equal(container.scrollTop, 1880);
    assert.equal(anchor.getBoundingClientRect().top - container.getBoundingClientRect().top, 300);
    assert.equal(currentPosition().scrollTop, 1880);
    assert.equal(observer.disconnected, false);

    container.scrollTop = 1900;
    dispatch(container, 'scroll');
    assert.equal(observer.disconnected, true);
    anchorContentTop += 80;
    act(() => observer.trigger());
    assert.equal(container.scrollTop, 1900);
  });

  it('captures the final anchor position after momentum scroll between pointerdown and click', async () => {
    const container = render(parentPath);
    const anchor = container.querySelector<HTMLElement>(
      '[data-history-scroll-restoration-anchor="subtask:4"]',
    );
    assert.ok(anchor);

    container.scrollTop = 1800;
    dispatch(container, 'scroll');
    dispatch(anchor, 'pointerdown');

    container.scrollTop = 1860;
    dispatch(container, 'scroll');
    click(anchor);

    assert.deepEqual(currentPosition().anchor, { key: 'subtask:4', offsetTop: 240 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.deepEqual(currentPosition().anchor, { key: 'subtask:4', offsetTop: 240 });
  });

  it('does not reapply the absolute fallback after it has been reached without the anchor', () => {
    const container = render(parentPath);
    const anchor = container.querySelector<HTMLElement>(
      '[data-history-scroll-restoration-anchor="subtask:4"]',
    );
    assert.ok(anchor);

    container.scrollTop = 1800;
    dispatch(container, 'scroll');
    dispatch(anchor, 'pointerdown');
    const parentState = window.history.state;

    act(() => {
      window.history.pushState({}, '', childPath);
      root.render(<ScrollContainer pathname={childPath} />);
    });
    act(() => {
      window.history.replaceState(parentState, '', parentPath);
      root.render(<ScrollContainer pathname={parentPath} anchorKey={null} />);
    });
    assert.equal(container.scrollTop, 1800);

    container.scrollTop = 1700;
    const observer = resizeObservers.at(-1);
    assert.ok(observer);
    act(() => observer.trigger());

    assert.equal(container.scrollTop, 1700);
    assert.equal(observer.disconnected, false);
  });

  it('stops restoration when an anchor that was restored disappears', () => {
    const container = render(parentPath);
    const anchor = container.querySelector<HTMLElement>(
      '[data-history-scroll-restoration-anchor="subtask:4"]',
    );
    assert.ok(anchor);

    container.scrollTop = 1800;
    dispatch(container, 'scroll');
    dispatch(anchor, 'pointerdown');
    const parentState = window.history.state;

    act(() => {
      window.history.pushState({}, '', childPath);
      root.render(<ScrollContainer pathname={childPath} />);
    });
    act(() => {
      window.history.replaceState(parentState, '', parentPath);
      root.render(<ScrollContainer pathname={parentPath} />);
    });

    const observer = resizeObservers.at(-1);
    assert.ok(observer);
    act(() => root.render(<ScrollContainer pathname={parentPath} anchorKey={null} />));
    act(() => observer.trigger());

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
