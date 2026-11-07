import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { JSDOM } from 'jsdom';
import palette from '../../../messages/en/palette.json';
import common from '../../../messages/en/common.json';
import documents from '../../../messages/en/documents.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'localStorage',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const hit = {
  sequenceNumber: 1,
  columnId: 1,
  typeId: null,
  initiativeId: null,
  cycleId: null,
  parentId: null,
  assigneeUserId: null,
  delegateUserId: null,
  priority: null,
  dueDate: null,
  labelIds: [],
  archived: false,
};
const currentHit = { ...hit, id: 1, identifier: 'MKT-1', title: 'Launch plan' };
const otherHit = {
  ...hit,
  id: 2,
  identifier: 'OPS-1',
  title: 'Launch runbook',
  projectId: 2,
  projectRef: 'eng.OPS',
  projectKey: 'OPS',
  projectName: 'Operations',
  teamName: 'Engineering',
};

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let requests: URL[];
let held: Promise<void> | null;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

const allProjectRequests = () => requests.filter((url) => url.pathname === '/issues/search');
const headings = () =>
  [...document.querySelectorAll('[cmdk-group-heading]')].map((el) => el.textContent);
const tabs = () => [...document.querySelectorAll<HTMLElement>('[role="tab"]')];

async function settle(ms = 0) {
  await act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
}

async function render(project: { key: string; id: number } | null) {
  const { default: CommandPalette } = await import('./CommandPalette');
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={{ push() {}, prefetch() {} } as never}>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider
            locale="en"
            messages={{ palette, common, documents }}
            timeZone="UTC"
          >
            <CommandPalette
              open
              onOpenChange={() => {}}
              sections={[]}
              currentProjectKey={project?.key ?? null}
              currentProjectId={project?.id ?? null}
              onOpenIssue={() => {}}
            />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    ),
  );
  await settle();
}

// Types into the search input the way React sees a keystroke, then waits out the
// palette's debounce and the requests it sends.
async function type(value: string) {
  const input = document.querySelector<HTMLInputElement>('[cmdk-input]')!;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  await settle(300);
  await settle(20);
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/eng/MKT',
    pretendToBeVisual: true,
  });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  requests = [];
  held = null;
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    fetch: {
      configurable: true,
      value: async (input: string | URL) => {
        const url = new URL(String(input));
        requests.push(url);
        if (url.pathname === '/issues/search') {
          await held;
          return Response.json([otherHit]);
        }
        if (url.pathname.endsWith('/issues/search')) return Response.json([currentHit]);
        return Response.json(null);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  // Better Auth's stores dispose their browser listeners one second after unmount.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('CommandPalette search scope', () => {
  it('searches every project by default, below the open one', async () => {
    await render({ key: 'eng.MKT', id: 1 });
    assert.deepEqual(
      tabs().map((tab) => [tab.textContent, tab.getAttribute('aria-selected')]),
      [
        ['This project', 'false'],
        ['All projects', 'true'],
      ],
    );

    await type('launch');
    assert.equal(allProjectRequests()[0]!.searchParams.get('excludeProjectId'), '1');
    assert.deepEqual(headings(), ['Issues', 'Engineering / OperationsOPS']);
  });

  it('searches only the open project once narrowed, and remembers the choice', async () => {
    await render({ key: 'eng.MKT', id: 1 });
    await act(async () => tabs()[0]!.click());
    await type('launch');

    assert.equal(allProjectRequests().length, 0);
    assert.deepEqual(headings(), ['Issues']);
    assert.equal(localStorage.getItem('command-palette:search-scope'), 'current');
  });

  it('searches every project with no switch when no project is open', async () => {
    localStorage.setItem('command-palette:search-scope', 'current');
    await render(null);
    assert.equal(tabs().length, 0);

    await type('launch');
    assert.equal(allProjectRequests()[0]!.searchParams.has('excludeProjectId'), false);
    assert.deepEqual(headings(), ['Engineering / OperationsOPS']);
  });

  it('drops the other projects, still searching, once narrowed to the open project', async () => {
    held = new Promise(() => {});
    await render({ key: 'eng.MKT', id: 1 });
    await type('launch');
    assert.deepEqual(headings(), ['Issues', 'Issues in other projects']);

    await act(async () => tabs()[0]!.click());
    await settle();
    assert.deepEqual(headings(), ['Issues']);
  });
});
