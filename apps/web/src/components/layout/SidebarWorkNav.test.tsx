import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import {
  PathParamsContext,
  PathnameContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ShellCtx, type ShellContext } from '@/context/shellContext';
import { SyncProvider } from '@/context/syncContext';
import type { InitiativeOption } from '@/lib/api/endpoints/initiatives';
import { qk } from '@/services/queryKeys';
import nav from '../../../messages/en/nav.json';
import common from '../../../messages/en/common.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'matchMedia',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

const ownerShell = {
  project: {
    project: {
      id: 1,
      ref: 'eng.P01',
      initiativesEnabled: true,
      dashboardsEnabled: false,
      cyclesEnabled: false,
      documentsEnabled: false,
      notesEnabled: false,
    },
    viewer: { role: 'owner', via: 'member' },
    permissions: {},
  },
} as unknown as ShellContext;

async function renderSidebar(pathname: string, favorites: InitiativeOption[]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(qk.views('eng.P01'), []);
  qc.setQueryData(qk.notificationsUnread('eng.P01'), 0);
  qc.setQueryData(qk.favoriteInitiatives('eng.P01'), favorites);

  const { default: SidebarWorkNav } = await import('./SidebarWorkNav');
  await act(async () =>
    root.render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={{ nav, common }} timeZone="UTC">
          <PathnameContext.Provider value={pathname}>
            <PathParamsContext.Provider value={{ teamRef: 'eng', projectKey: 'P01' }}>
              <SyncProvider>
                <ShellCtx.Provider value={ownerShell}>
                  <SidebarProvider>
                    <SidebarWorkNav projectKey="eng.P01" projectId={1} />
                  </SidebarProvider>
                </ShellCtx.Provider>
              </SyncProvider>
            </PathParamsContext.Provider>
          </PathnameContext.Provider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  const matchMedia = () =>
    ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: matchMedia });
  Object.defineProperties(globalThis, {
    matchMedia: { configurable: true, value: matchMedia },
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
      value: () =>
        Promise.resolve(
          new Response(JSON.stringify({ revs: {} }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('SidebarWorkNav favorite initiatives', () => {
  it('renders a plain Initiatives link when there are no favorite initiatives', async () => {
    await renderSidebar('/eng/P01/initiatives/active', []);
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a')].map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent?.trim(),
    }));
    assert.ok(links.some((l) => l.href === '/eng/P01/initiatives' && l.text === nav.initiatives));
    assert.ok(!links.some((l) => l.text === nav.allInitiatives));
  });

  it('lists favorite initiatives under Initiatives and marks the open sub-route active', async () => {
    await renderSidebar('/eng/P01/initiatives/7/progress', [
      { id: 7, title: 'Q3 Launch', status: 'active' },
      { id: 12, title: 'Billing v2', status: 'planned' },
    ]);
    const subLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>('[data-sidebar="menu-sub-button"]'),
    ].map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent?.trim(),
      active: a.getAttribute('data-active') === 'true',
    }));
    assert.deepEqual(subLinks, [
      { href: '/eng/P01/initiatives', text: nav.allInitiatives, active: false },
      { href: '/eng/P01/initiatives/7', text: 'Q3 Launch', active: true },
      { href: '/eng/P01/initiatives/12', text: 'Billing v2', active: false },
    ]);
  });

  it('keeps All initiatives active on a non-favorite initiative whose id shares a prefix', async () => {
    await renderSidebar('/eng/P01/initiatives/70', [
      { id: 7, title: 'Q3 Launch', status: 'active' },
    ]);
    const subLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>('[data-sidebar="menu-sub-button"]'),
    ].map((a) => ({
      href: a.getAttribute('href'),
      active: a.getAttribute('data-active') === 'true',
    }));
    assert.deepEqual(subLinks, [
      { href: '/eng/P01/initiatives', active: true },
      { href: '/eng/P01/initiatives/7', active: false },
    ]);
  });
});
